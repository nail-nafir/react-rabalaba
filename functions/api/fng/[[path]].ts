/**
 * Cloudflare Pages Function: proxy + edge-cache the Fear & Greed index from
 * alternative.me.
 *
 * The previous version forwarded the inbound request headers (including `Host`)
 * to the upstream AND re-emitted the upstream's `Content-Encoding` header. Since
 * the edge `fetch` already decompresses the body, the browser would try to gunzip
 * an already-plain body and fail to parse it — surfacing intermittently as the
 * "sedang istirahat" state. It also hit alternative.me on every single request,
 * inviting rate-limit 5xx.
 *
 * This version: (1) sends a CLEAN upstream request, (2) re-serializes the body
 * with fresh headers (no stale Content-Encoding/Length), and (3) caches the
 * result at the edge so the F&G index (which only updates ~once/day) stays fast
 * and reliable instead of hammering the upstream.
 */
const UPSTREAM_ORIGIN = "https://api.alternative.me";
const CACHE_TTL_SECONDS = 1800; // 30 min — F&G updates ~once/day, so plenty fresh
const UPSTREAM_TIMEOUT_MS = 8000;

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const upstreamPath = url.pathname.replace("/api/fng", "");
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
      // A clean request — never leak the inbound Host/cookies/cf-* headers.
      headers: { Accept: "application/json", "User-Agent": "RabaLaba/1.0" },
      signal: controller.signal,
    });

    // Read the body fully so we can re-serialize with clean headers (drops the
    // upstream's Content-Encoding/Content-Length, which no longer match).
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
      JSON.stringify({ error: "Failed to proxy to Alternative.me" }),
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
