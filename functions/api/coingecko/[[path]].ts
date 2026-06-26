/**
 * Cloudflare Pages Function: proxy + edge-cache the CoinGecko free API
 * (used for BTC/ETH market dominance via `/api/v3/global`).
 *
 * The CoinGecko free tier rate-limits per source IP, and that budget is SHARED
 * across every request egressing from Cloudflare's edge — so on a public site
 * the upstream returns `429 Too Many Requests` almost immediately, surfacing as
 * the "Dominasi lagi istirahat" state.
 *
 * This version: (1) sends a CLEAN upstream request, (2) re-serializes the body
 * with fresh headers (drops the upstream Content-Encoding/Length that no longer
 * match the decompressed body), (3) edge-caches healthy responses so ALL
 * visitors collapse into ~one upstream call per TTL, and (4) on a 429/5xx,
 * serves the last good cached copy (stale-on-error) instead of failing.
 */
const UPSTREAM_ORIGIN = "https://api.coingecko.com";
const CACHE_TTL_SECONDS = 600; // 10 min — dominance moves slowly; matches client staleTime
const UPSTREAM_TIMEOUT_MS = 8000;

const UPSTREAM_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const upstreamPath = url.pathname.replace("/api/coingecko", "");
  const upstreamUrl = `${UPSTREAM_ORIGIN}${upstreamPath}${url.search}`;

  // Edge cache keyed purely by the upstream URL (ignores client cookies/headers).
  const cache = caches.default;
  const cacheKey = new Request(upstreamUrl, { method: "GET" });

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: UPSTREAM_HEADERS,
      signal: controller.signal,
    });

    // Read the body fully so we can re-serialize with clean headers.
    const body = await upstream.text();

    // On a rate-limit / upstream failure, fall back to the last good cached copy
    // (keyed by a stable "last-good" request) so the UI keeps showing dominance
    // instead of flipping to "istirahat".
    if (!upstream.ok) {
      const lastGood = await cache.match(LAST_GOOD_KEY(upstreamUrl));
      if (lastGood) return lastGood;
      return jsonError(upstream.status === 429 ? 429 : 502);
    }

    const response = new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
        "Access-Control-Allow-Origin": "*",
      },
    });

    // Cache under the live key (short TTL) AND the long-lived last-good key
    // (used as the stale-on-error fallback above).
    context.waitUntil(cache.put(cacheKey, response.clone()));
    context.waitUntil(
      cache.put(LAST_GOOD_KEY(upstreamUrl), lastGoodResponse(body)),
    );
    return response;
  } catch {
    const lastGood = await cache.match(LAST_GOOD_KEY(upstreamUrl));
    if (lastGood) return lastGood;
    return jsonError(502);
  } finally {
    clearTimeout(timeoutId);
  }
};

/** Stable cache key for the "last known good" copy, separate from the live one
 *  so it survives the short live-TTL expiry and backs the stale-on-error path. */
function LAST_GOOD_KEY(upstreamUrl: string): Request {
  return new Request(`${upstreamUrl}#last-good`, { method: "GET" });
}

/** A long-lived copy of a healthy body for the stale-on-error fallback. */
function lastGoodResponse(body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=86400", // 1 day — only served when upstream is down
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function jsonError(status: number): Response {
  return new Response(
    JSON.stringify({ error: "Failed to proxy to CoinGecko" }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
