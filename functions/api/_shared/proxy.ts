const DEFAULT_TIMEOUT_MS = 8_000;
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type ProxyContext = {
  request: Request;
  waitUntil(promise: Promise<unknown>): void;
  env?: Record<string, unknown>;
};

type HeaderFactory = (
  context: ProxyContext,
  upstreamUrl: URL,
) => HeadersInit | undefined;

type JsonProxyOptions = {
  upstreamOrigin: string;
  routePrefix: string;
  serviceName: string;
  cacheTtlSeconds?: number;
  timeoutMs?: number;
  headers?: HeadersInit | HeaderFactory;
};

function corsHeaders() {
  return new Headers(CORS_HEADERS);
}

export function envString(
  env: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = env?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function jsonOptionsResponse() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export function jsonErrorResponse(message: string, status = 502) {
  const headers = corsHeaders();
  headers.set("Content-Type", JSON_CONTENT_TYPE);
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify({ error: message }), { status, headers });
}

function buildUpstreamUrl(requestUrl: URL, routePrefix: string, origin: string) {
  const upstreamPath = requestUrl.pathname.replace(routePrefix, "") || "/";
  const upstreamUrl = new URL(upstreamPath, origin);
  upstreamUrl.search = requestUrl.search;
  return upstreamUrl;
}

function requestHeaders(
  context: ProxyContext,
  upstreamUrl: URL,
  headers?: HeadersInit | HeaderFactory,
) {
  const cleanHeaders = new Headers({
    Accept: "application/json",
    "User-Agent": "RabaLaba/1.0",
  });
  const extra =
    typeof headers === "function" ? headers(context, upstreamUrl) : headers;
  if (extra) {
    new Headers(extra).forEach((value, key) => cleanHeaders.set(key, value));
  }
  return cleanHeaders;
}

export function responseHeaders(
  upstream: Response,
  cacheTtlSeconds?: number,
) {
  const headers = corsHeaders();
  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") ?? JSON_CONTENT_TYPE,
  );

  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) headers.set("Retry-After", retryAfter);

  if (upstream.ok && cacheTtlSeconds) {
    headers.set("Cache-Control", `public, max-age=${cacheTtlSeconds}`);
  } else {
    headers.set("Cache-Control", "no-store");
  }

  return headers;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function cleanProxyResponse(
  upstream: Response,
  cacheTtlSeconds?: number,
) {
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders(upstream, cacheTtlSeconds),
  });
}

export async function proxyJsonGet(
  context: ProxyContext,
  options: JsonProxyOptions,
) {
  if (context.request.method === "OPTIONS") return jsonOptionsResponse();
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return jsonErrorResponse("Method not allowed", 405);
  }

  const requestUrl = new URL(context.request.url);
  const upstreamUrl = buildUpstreamUrl(
    requestUrl,
    options.routePrefix,
    options.upstreamOrigin,
  );

  const shouldCache =
    context.request.method === "GET" && Boolean(options.cacheTtlSeconds);
  const cacheKey = new Request(requestUrl.toString(), { method: "GET" });

  if (shouldCache) {
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached;
  }

  try {
    const upstream = await fetchWithTimeout(
      upstreamUrl,
      {
        method: "GET",
        headers: requestHeaders(context, upstreamUrl, options.headers),
      },
      options.timeoutMs,
    );
    const response = await cleanProxyResponse(
      upstream,
      upstream.ok ? options.cacheTtlSeconds : undefined,
    );

    if (upstream.ok && shouldCache) {
      context.waitUntil(
        caches.default.put(cacheKey, response.clone()).catch((error) => {
          console.error(
            JSON.stringify({
              event: "api_cache_put_failed",
              service: options.serviceName,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }),
      );
    }

    return response;
  } catch {
    return jsonErrorResponse(`Failed to proxy to ${options.serviceName}`);
  }
}
