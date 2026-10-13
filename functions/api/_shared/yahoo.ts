import { fetchWithTimeout } from "./proxy";

export const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/** Yahoo's v10 quoteSummary (fundamentals/analyst), the v1 screener (the
 *  asset-discovery cron's custom IDX query needs it; the predefined lists work
 *  either way) and the v1 visualization calendar are gated behind a per-session
 *  cookie + matching "crumb" token — everything else (v8 chart, v1 search) is
 *  open. We fetch a cookie/crumb pair once, cache it per isolate, and refresh on
 *  a 401. Cache is in-memory (warm isolate); a cold start just re-fetches. */
let crumbCache: { cookie: string; crumb: string; at: number } | null = null;
const CRUMB_TTL_MS = 30 * 60 * 1000;

/** Obtain (and cache) a matching cookie + crumb pair. */
export async function getCrumb(
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
    const seed = await fetchWithTimeout("https://fc.yahoo.com/", {
      headers: { "User-Agent": YAHOO_UA },
    });
    const cookie = seed.headers.getSetCookie().map((c) => c.split(";")[0]).filter(Boolean).join("; ");
    if (!cookie) return null;
    // 2) Exchange the cookie for a crumb (plain-text body).
    const crumbRes = await fetchWithTimeout(
      "https://query1.finance.yahoo.com/v1/test/getcrumb",
      { headers: { "User-Agent": YAHOO_UA, Cookie: cookie } },
    );
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.includes("<")) return null; // HTML = failed, not a crumb
    crumbCache = { cookie, crumb, at: Date.now() };
    return crumbCache;
  } catch {
    return null;
  }
}
