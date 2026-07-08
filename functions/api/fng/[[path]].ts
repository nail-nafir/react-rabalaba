import { proxyJsonGet } from "../_shared/proxy";

const UPSTREAM_ORIGIN = "https://api.alternative.me";
const CACHE_TTL_SECONDS = 12 * 60 * 60;
const STALE_TTL_SECONDS = 2 * 24 * 60 * 60;

export const onRequest: PagesFunction = (context) =>
  proxyJsonGet(context, {
    upstreamOrigin: UPSTREAM_ORIGIN,
    routePrefix: "/api/fng",
    serviceName: "Alternative.me",
    cacheTtlSeconds: CACHE_TTL_SECONDS,
    staleTtlSeconds: STALE_TTL_SECONDS,
    errorTtlSeconds: 60,
  });
