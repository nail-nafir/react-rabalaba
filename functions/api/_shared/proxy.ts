const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_ERROR_TTL_SECONDS = 30;
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
};

const DEFAULT_STALE_ON_STATUSES: StatusMatcher[] = [429, [500, 599]];
const DEFAULT_BYPASS_SEARCH_PARAMS = ["_"];

type ProxyContext = {
  request: Request;
  waitUntil(promise: Promise<unknown>): void;
  env?: Record<string, unknown>;
};

type HeaderFactory = (
  context: ProxyContext,
  upstreamUrl: URL,
) => HeadersInit | undefined;

export type StatusMatcher = number | [number, number];

export type ProxyCachePolicy = {
  freshTtlSeconds?: number;
  staleTtlSeconds?: number;
  errorTtlSeconds?: number;
  cacheable?: boolean;
  bypassSearchParams?: string[];
  staleOnStatuses?: StatusMatcher[];
};

type ProxyCachePolicyFactory = (
  context: ProxyContext,
  requestUrl: URL,
  upstreamUrl: URL,
) => ProxyCachePolicy | undefined;

type JsonProxyOptions = {
  upstreamOrigin: string;
  routePrefix: string;
  serviceName: string;
  cacheTtlSeconds?: number;
  staleTtlSeconds?: number;
  errorTtlSeconds?: number;
  timeoutMs?: number;
  headers?: HeadersInit | HeaderFactory;
  cachePolicy?: ProxyCachePolicy | ProxyCachePolicyFactory;
};

type ProxyJsonRequestOptions = {
  serviceName: string;
  upstreamUrl: URL;
  fetchUpstream: () => Promise<Response>;
  cachePolicy?: ProxyCachePolicy | ProxyCachePolicyFactory;
  cacheTtlSeconds?: number;
  staleTtlSeconds?: number;
  errorTtlSeconds?: number;
};

type ResolvedCachePolicy = {
  freshTtlSeconds: number;
  staleTtlSeconds: number;
  errorTtlSeconds: number;
  cacheable: boolean;
  bypassSearchParams: string[];
  staleOnStatuses: StatusMatcher[];
};

type CacheKind = "fresh" | "stale" | "error";
type CacheStatus =
  | "bypass"
  | "error"
  | "error-hit"
  | "hit"
  | "miss"
  | "stale";

const inFlight = new Map<string, Promise<Response>>();

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

export function jsonErrorResponse(
  message: string,
  status = 502,
  extraHeaders?: HeadersInit,
) {
  const headers = corsHeaders();
  headers.set("Content-Type", JSON_CONTENT_TYPE);
  headers.set("Cache-Control", "no-store");
  if (extraHeaders) {
    new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  }
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

function ttlHeader(ttlSeconds: number) {
  return ttlSeconds > 0 ? `public, max-age=${ttlSeconds}` : "no-store";
}

export function responseHeaders(
  upstream: Response,
  cacheTtlSeconds?: number,
  diagnostics?: {
    serviceName?: string;
    cacheStatus?: CacheStatus;
    upstreamStatus?: number;
    staleReason?: string;
  },
) {
  const headers = corsHeaders();
  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") ?? JSON_CONTENT_TYPE,
  );

  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) headers.set("Retry-After", retryAfter);

  headers.set(
    "Cache-Control",
    upstream.ok && cacheTtlSeconds ? ttlHeader(cacheTtlSeconds) : "no-store",
  );

  addDiagnostics(headers, diagnostics);
  return headers;
}

function addDiagnostics(
  headers: Headers,
  diagnostics?: {
    serviceName?: string;
    cacheStatus?: CacheStatus;
    upstreamStatus?: number;
    staleReason?: string;
  },
) {
  if (!diagnostics) return;
  if (diagnostics.serviceName) {
    headers.set("X-Rabalaba-Proxy", diagnostics.serviceName);
  }
  if (diagnostics.cacheStatus) {
    headers.set("X-Rabalaba-Cache", diagnostics.cacheStatus);
  }
  if (diagnostics.upstreamStatus != null) {
    headers.set("X-Rabalaba-Upstream-Status", String(diagnostics.upstreamStatus));
  }
  if (diagnostics.staleReason) {
    headers.set("X-Rabalaba-Stale-Reason", diagnostics.staleReason);
  }
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
  diagnostics?: Parameters<typeof responseHeaders>[2],
) {
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders(upstream, cacheTtlSeconds, diagnostics),
  });
}

function resolveCachePolicy(
  context: ProxyContext,
  requestUrl: URL,
  upstreamUrl: URL,
  options: {
    cachePolicy?: ProxyCachePolicy | ProxyCachePolicyFactory;
    cacheTtlSeconds?: number;
    staleTtlSeconds?: number;
    errorTtlSeconds?: number;
  },
): ResolvedCachePolicy {
  const routePolicy =
    typeof options.cachePolicy === "function"
      ? options.cachePolicy(context, requestUrl, upstreamUrl)
      : options.cachePolicy;
  const freshTtlSeconds =
    routePolicy?.freshTtlSeconds ?? options.cacheTtlSeconds ?? 0;
  return {
    freshTtlSeconds,
    staleTtlSeconds: routePolicy?.staleTtlSeconds ?? options.staleTtlSeconds ?? 0,
    errorTtlSeconds:
      routePolicy?.errorTtlSeconds ??
      options.errorTtlSeconds ??
      DEFAULT_ERROR_TTL_SECONDS,
    cacheable: routePolicy?.cacheable ?? freshTtlSeconds > 0,
    bypassSearchParams:
      routePolicy?.bypassSearchParams ?? DEFAULT_BYPASS_SEARCH_PARAMS,
    staleOnStatuses:
      routePolicy?.staleOnStatuses ?? DEFAULT_STALE_ON_STATUSES,
  };
}

function cacheKey(requestUrl: URL, kind: CacheKind) {
  const url = new URL(requestUrl.toString());
  url.searchParams.set("__rabalaba_cache", kind);
  return new Request(url.toString(), { method: "GET" });
}

function cacheAllowed(
  context: ProxyContext,
  requestUrl: URL,
  policy: ResolvedCachePolicy,
) {
  if (context.request.method !== "GET") return { ok: false };
  if (!policy.cacheable || policy.freshTtlSeconds <= 0) return { ok: false };

  const cacheControl = context.request.headers.get("cache-control") ?? "";
  if (/\bno-cache\b|\bno-store\b/i.test(cacheControl)) {
    return { ok: false, reason: "request-cache-control" };
  }
  const pragma = context.request.headers.get("pragma") ?? "";
  if (/\bno-cache\b/i.test(pragma)) return { ok: false, reason: "pragma" };

  const bypassParam = policy.bypassSearchParams.find((param) =>
    requestUrl.searchParams.has(param),
  );
  if (bypassParam) return { ok: false, reason: `cache-buster:${bypassParam}` };

  return { ok: true };
}

function statusMatches(status: number, matchers: StatusMatcher[]) {
  return matchers.some((matcher) =>
    Array.isArray(matcher)
      ? status >= matcher[0] && status <= matcher[1]
      : status === matcher,
  );
}

function cacheStoreTtl(policy: ResolvedCachePolicy, kind: CacheKind) {
  if (kind === "fresh") return policy.freshTtlSeconds;
  if (kind === "stale") {
    return policy.freshTtlSeconds + policy.staleTtlSeconds;
  }
  return policy.errorTtlSeconds;
}

function responseForCache(
  response: Response,
  policy: ResolvedCachePolicy,
  kind: CacheKind,
) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", ttlHeader(cacheStoreTtl(policy, kind)));
  headers.set("X-Rabalaba-Cache-Kind", kind);
  headers.set("X-Rabalaba-Cached-At", String(Date.now()));
  return new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function putCache(
  context: ProxyContext,
  key: Request,
  response: Response,
  policy: ResolvedCachePolicy,
  kind: CacheKind,
) {
  context.waitUntil(
    caches.default
      .put(key, responseForCache(response, policy, kind))
      .catch((error) => {
        console.error(
          JSON.stringify({
            event: "api_cache_put_failed",
            kind,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }),
  );
}

function withCacheDiagnostics(
  response: Response,
  policy: ResolvedCachePolicy | null,
  diagnostics: {
    serviceName: string;
    cacheStatus: CacheStatus;
    upstreamStatus?: number;
    staleReason?: string;
  },
) {
  const headers = new Headers(response.headers);
  if (diagnostics.cacheStatus === "hit" && policy?.freshTtlSeconds) {
    headers.set("Cache-Control", ttlHeader(policy.freshTtlSeconds));
  } else if (diagnostics.cacheStatus === "stale") {
    headers.set("Cache-Control", "no-cache");
  } else if (diagnostics.cacheStatus === "error-hit") {
    headers.set("Cache-Control", "no-store");
  }
  headers.delete("X-Rabalaba-Cache-Kind");
  headers.delete("X-Rabalaba-Cached-At");
  addDiagnostics(headers, diagnostics);
  return new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function matchCached(
  key: Request,
  policy: ResolvedCachePolicy,
  diagnostics: {
    serviceName: string;
    cacheStatus: CacheStatus;
    upstreamStatus?: number;
    staleReason?: string;
  },
) {
  const cached = await caches.default.match(key);
  return cached
    ? withCacheDiagnostics(cached, policy, diagnostics)
    : undefined;
}

function recoverableErrorResponse(
  serviceName: string,
  status: number,
  upstream?: Response,
) {
  const headers = new Headers();
  const retryAfter = upstream?.headers.get("retry-after");
  if (retryAfter) headers.set("Retry-After", retryAfter);
  return jsonErrorResponse(`${serviceName} temporarily unavailable`, status, headers);
}

async function serveFromUpstream(
  context: ProxyContext,
  requestUrl: URL,
  options: ProxyJsonRequestOptions,
  policy: ResolvedCachePolicy,
  canCache: boolean,
  bypassReason?: string,
) {
  const freshKey = cacheKey(requestUrl, "fresh");
  const staleKey = cacheKey(requestUrl, "stale");
  const errorKey = cacheKey(requestUrl, "error");
  try {
    const upstream = await options.fetchUpstream();
    if (upstream.ok) {
      const response = await cleanProxyResponse(
        upstream,
        canCache ? policy.freshTtlSeconds : undefined,
        {
          serviceName: options.serviceName,
          cacheStatus: canCache ? "miss" : "bypass",
          upstreamStatus: upstream.status,
          staleReason: bypassReason,
        },
      );

      if (canCache) {
        putCache(context, freshKey, response, policy, "fresh");
        if (policy.staleTtlSeconds > 0) {
          putCache(context, staleKey, response, policy, "stale");
        }
        context.waitUntil(caches.default.delete(errorKey).catch(() => {}));
      }

      return response;
    }

    if (statusMatches(upstream.status, policy.staleOnStatuses)) {
      if (canCache && policy.staleTtlSeconds > 0) {
        const stale = await matchCached(staleKey, policy, {
          serviceName: options.serviceName,
          cacheStatus: "stale",
          upstreamStatus: upstream.status,
          staleReason: `upstream-${upstream.status}`,
        });
        if (stale) return stale;
      }

      const response = recoverableErrorResponse(
        options.serviceName,
        upstream.status,
        upstream,
      );
      const marked = withCacheDiagnostics(response, null, {
        serviceName: options.serviceName,
        cacheStatus: "error",
        upstreamStatus: upstream.status,
      });
      if (canCache && policy.errorTtlSeconds > 0) {
        putCache(context, errorKey, marked, policy, "error");
      }
      return marked;
    }

    return cleanProxyResponse(upstream, undefined, {
      serviceName: options.serviceName,
      cacheStatus: canCache ? "miss" : "bypass",
      upstreamStatus: upstream.status,
      staleReason: bypassReason,
    });
  } catch (error) {
    if (canCache && policy.staleTtlSeconds > 0) {
      const stale = await matchCached(staleKey, policy, {
        serviceName: options.serviceName,
        cacheStatus: "stale",
        staleReason: error instanceof Error ? error.name : "fetch-error",
      });
      if (stale) return stale;
    }

    const response = jsonErrorResponse(
      `Failed to proxy to ${options.serviceName}`,
      502,
    );
    const marked = withCacheDiagnostics(response, null, {
      serviceName: options.serviceName,
      cacheStatus: "error",
      staleReason: error instanceof Error ? error.name : "fetch-error",
    });
    if (canCache && policy.errorTtlSeconds > 0) {
      putCache(context, errorKey, marked, policy, "error");
    }
    return marked;
  }
}

export async function proxyJsonRequest(
  context: ProxyContext,
  options: ProxyJsonRequestOptions,
) {
  if (context.request.method === "OPTIONS") return jsonOptionsResponse();

  const requestUrl = new URL(context.request.url);
  const policy = resolveCachePolicy(
    context,
    requestUrl,
    options.upstreamUrl,
    options,
  );
  const allowed = cacheAllowed(context, requestUrl, policy);
  const canCache = allowed.ok;

  if (canCache) {
    const freshKey = cacheKey(requestUrl, "fresh");
    const fresh = await matchCached(freshKey, policy, {
      serviceName: options.serviceName,
      cacheStatus: "hit",
    });
    if (fresh) return fresh;

    const errorKey = cacheKey(requestUrl, "error");
    const recentError = await matchCached(errorKey, policy, {
      serviceName: options.serviceName,
      cacheStatus: "error-hit",
    });
    if (recentError) {
      const staleKey = cacheKey(requestUrl, "stale");
      const stale = await matchCached(staleKey, policy, {
        serviceName: options.serviceName,
        cacheStatus: "stale",
        staleReason: "recent-error",
      });
      return stale ?? recentError;
    }

    const coalesceKey = freshKey.url;
    const pending = inFlight.get(coalesceKey);
    if (pending) return (await pending).clone();

    const promise = serveFromUpstream(
      context,
      requestUrl,
      options,
      policy,
      true,
    ).finally(() => {
      inFlight.delete(coalesceKey);
    });
    inFlight.set(coalesceKey, promise);
    return (await promise).clone();
  }

  return serveFromUpstream(
    context,
    requestUrl,
    options,
    policy,
    false,
    allowed.reason,
  );
}

export async function proxyJsonGet(
  context: ProxyContext,
  options: JsonProxyOptions,
) {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    if (context.request.method === "OPTIONS") return jsonOptionsResponse();
    return jsonErrorResponse("Method not allowed", 405);
  }

  const requestUrl = new URL(context.request.url);
  const upstreamUrl = buildUpstreamUrl(
    requestUrl,
    options.routePrefix,
    options.upstreamOrigin,
  );

  return proxyJsonRequest(context, {
    serviceName: options.serviceName,
    upstreamUrl,
    cacheTtlSeconds: options.cacheTtlSeconds,
    staleTtlSeconds: options.staleTtlSeconds,
    errorTtlSeconds: options.errorTtlSeconds,
    cachePolicy: options.cachePolicy,
    fetchUpstream: () =>
      fetchWithTimeout(
        upstreamUrl,
        {
          method: "GET",
          headers: requestHeaders(context, upstreamUrl, options.headers),
        },
        options.timeoutMs,
      ),
  });
}
