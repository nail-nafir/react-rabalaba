import {
  fetchWithTimeout,
  jsonOptionsResponse,
  proxyJsonRequest,
  type ProxyCachePolicy,
} from "../_shared/proxy";
import { YAHOO_UA, getCrumb } from "../_shared/yahoo";
const UPSTREAM_TIMEOUT_MS = 8_000;
const RECOVERABLE_YAHOO_STATUSES: ProxyCachePolicy["staleOnStatuses"] = [
  429,
  [500, 599],
];

function cachePolicy(
  _context: unknown,
  _requestUrl: URL,
  upstreamUrl: URL,
): ProxyCachePolicy {
  const path = upstreamUrl.pathname;
  const shared = {
    errorTtlSeconds: 60,
    staleOnStatuses: RECOVERABLE_YAHOO_STATUSES,
  } satisfies Partial<ProxyCachePolicy>;

  if (path.includes("/v8/finance/chart/")) {
    return {
      ...shared,
      freshTtlSeconds: 1_800,
      staleTtlSeconds: 6 * 60 * 60,
    };
  }

  if (path.includes("/v10/finance/quoteSummary/")) {
    return {
      ...shared,
      freshTtlSeconds: 6 * 60 * 60,
      staleTtlSeconds: 2 * 24 * 60 * 60,
    };
  }

  if (path.includes("/v1/finance/search")) {
    return {
      ...shared,
      freshTtlSeconds: 300,
      staleTtlSeconds: 60 * 60,
    };
  }

  if (path.includes("/finance/screener")) {
    return {
      ...shared,
      freshTtlSeconds: 1_800,
      staleTtlSeconds: 6 * 60 * 60,
    };
  }

  return {
    ...shared,
    freshTtlSeconds: 300,
    staleTtlSeconds: 60 * 60,
  };
}

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === "OPTIONS") return jsonOptionsResponse();

  const url = new URL(context.request.url);
  const path = url.pathname.replace("/api/yahoo", "");
  const needsCrumb =
    path.includes("/quoteSummary") || path.includes("/finance/screener");

  const baseHeaders = new Headers({
    Accept: context.request.headers.get("accept") ?? "application/json",
    "User-Agent": YAHOO_UA,
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
    let creds: { cookie: string; crumb: string } | null = null;
    let target = upstream(creds);

    return proxyJsonRequest(context, {
      serviceName: "Yahoo",
      upstreamUrl: new URL(target.url),
      cachePolicy,
      fetchUpstream: async () => {
        if (needsCrumb && !creds) {
          creds = await getCrumb();
          target = upstream(creds);
        }

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

        return response;
      },
    });
  } catch {
    return proxyJsonRequest(context, {
      serviceName: "Yahoo",
      upstreamUrl: new URL(`https://query1.finance.yahoo.com${path}`),
      cachePolicy,
      fetchUpstream: () => Promise.reject(new Error("Failed to proxy to Yahoo")),
    });
  }
};
