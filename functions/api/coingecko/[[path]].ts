/**
 * Cloudflare Pages Function: proxy + edge-cache CoinGecko's free `/global`
 * endpoint for BTC/ETH dominance data.
 *
 * Without this function, the Vite dev-proxy (`/api/coingecko → api.coingecko.com`)
 * works fine on localhost, but in production the request has no handler and falls
 * back to the SPA's `index.html` — causing the client to parse HTML as JSON and
 * show "Dominasi lagi istirahat".
 *
 * This proxy: (1) sends a clean upstream request (no leaked Host/Cookie headers),
 * (2) re-serializes the body with fresh headers (avoids stale Content-Encoding),
 * and (3) caches successful responses at the edge for 30 min so we stay well
 * within CoinGecko's free-tier rate limit (~30 req/min shared across all visitors).
 */
const UPSTREAM_ORIGIN = "https://api.coingecko.com";
const CACHE_TTL_SECONDS = 1800; // 30 min — dominance shifts slowly
const UPSTREAM_TIMEOUT_MS = 8000;

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const upstreamPath = url.pathname.replace("/api/coingecko", "");
  const upstreamUrl = `${UPSTREAM_ORIGIN}${upstreamPath}${url.search}`;

  // --- Edge cache keyed purely by the upstream URL ---
  const cache = caches.default;
  const cacheKey = new Request(upstreamUrl, { method: "GET" });

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      // Clean request — never leak inbound Host/cookies/cf-* headers.
      headers: { Accept: "application/json", "User-Agent": "RabaLaba/1.0" },
      signal: controller.signal,
    });

    // Read the body fully so we re-serialize with clean headers (drops
    // upstream's Content-Encoding/Content-Length which no longer match).
    const body = await upstream.text();

    const response = new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
        "Access-Control-Allow-Origin": "*",
      },
    });

    // Only cache healthy responses so a transient upstream error doesn't get
    // pinned at the edge for 30 minutes.
    if (upstream.ok) {
      context.waitUntil(cache.put(cacheKey, response.clone()));
    }
    return response;
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to proxy to CoinGecko" }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } finally {
    clearTimeout(timeoutId);
  }
};
