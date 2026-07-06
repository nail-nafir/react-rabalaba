import {
  cleanProxyResponse,
  fetchWithTimeout,
  jsonErrorResponse,
  jsonOptionsResponse,
} from "../_shared/proxy";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const UPSTREAM_TIMEOUT_MS = 8_000;

/** Yahoo's v10 quoteSummary (fundamentals/analyst) and the v1 screener (the
 *  asset-discovery cron's custom IDX query needs it; the predefined lists work
 *  either way) are gated behind a per-session cookie + matching "crumb" token —
 *  everything else (v8 chart, v1 search) is open. We fetch a cookie/crumb pair
 *  once, cache it per isolate, and refresh on a 401. Cache is in-memory (warm
 *  isolate); a cold start just re-fetches. */
let crumbCache: { cookie: string; crumb: string; at: number } | null = null;
const CRUMB_TTL_MS = 30 * 60 * 1000;

/** Join Set-Cookie entries into a `name=value; name=value` Cookie header. */
function cookieHeaderFrom(res: Response): string {
  const getSetCookie = (res.headers as unknown as {
    getSetCookie?: () => string[];
  }).getSetCookie;
  const list = getSetCookie
    ? getSetCookie.call(res.headers)
    : res.headers.get("set-cookie")
      ? [res.headers.get("set-cookie") as string]
      : [];
  return list
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

/** Obtain (and cache) a matching cookie + crumb pair. */
async function getCrumb(
  force = false,
): Promise<{ cookie: string; crumb: string } | null> {
  if (
    !force &&
    crumbCache &&
    Date.now() - crumbCache.at < CRUMB_TTL_MS &&
    crumbCache.crumb
  ) {
    return crumbCache;
  }
  try {
    // 1) Seed a session cookie (A1/A3). fc.yahoo.com may 404 but still sets it.
    const seed = await fetchWithTimeout(
      "https://fc.yahoo.com/",
      {
        headers: { "User-Agent": UA },
      },
      UPSTREAM_TIMEOUT_MS,
    );
    const cookie = cookieHeaderFrom(seed);
    if (!cookie) return null;
    // 2) Exchange the cookie for a crumb (plain-text body).
    const crumbRes = await fetchWithTimeout(
      "https://query1.finance.yahoo.com/v1/test/getcrumb",
      { headers: { "User-Agent": UA, Cookie: cookie } },
      UPSTREAM_TIMEOUT_MS,
    );
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.includes("<")) return null; // HTML = failed, not a crumb
    crumbCache = { cookie, crumb, at: Date.now() };
    return crumbCache;
  } catch {
    return null;
  }
}

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === "OPTIONS") return jsonOptionsResponse();

  const url = new URL(context.request.url);
  const path = url.pathname.replace("/api/yahoo", "");
  const needsCrumb =
    path.includes("/quoteSummary") || path.includes("/finance/screener");

  const baseHeaders = new Headers({
    Accept: context.request.headers.get("accept") ?? "application/json",
    "User-Agent": UA,
  });
  const contentType = context.request.headers.get("content-type");
  if (contentType) baseHeaders.set("Content-Type", contentType);

  const body =
    context.request.method !== "GET" && context.request.method !== "HEAD"
      ? await context.request.blob()
      : null;

  /** Build the upstream URL + headers, optionally with crumb credentials. */
  const upstream = (creds: { cookie: string; crumb: string } | null) => {
    const u = new URL(`https://query1.finance.yahoo.com${path}`);
    u.search = url.search;
    const headers = new Headers(baseHeaders);
    if (creds) {
      u.searchParams.set("crumb", creds.crumb);
      headers.set("Cookie", creds.cookie); // overwrite any app cookie
    }
    return { url: u.toString(), headers };
  };

  try {
    let creds = needsCrumb ? await getCrumb() : null;
    let target = upstream(creds);
    let response = await fetchWithTimeout(
      target.url,
      {
        method: context.request.method,
        headers: target.headers,
        body,
      },
      UPSTREAM_TIMEOUT_MS,
    );

    // Stale/invalid crumb → refresh once and retry.
    if (needsCrumb && response.status === 401) {
      creds = await getCrumb(true);
      if (creds) {
        target = upstream(creds);
        response = await fetchWithTimeout(
          target.url,
          {
            method: context.request.method,
            headers: target.headers,
            body,
          },
          UPSTREAM_TIMEOUT_MS,
        );
      }
    }

    return cleanProxyResponse(response);
  } catch {
    return jsonErrorResponse("Failed to proxy to Yahoo");
  }
};
