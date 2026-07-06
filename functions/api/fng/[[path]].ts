import { proxyJsonGet } from "../_shared/proxy";

const UPSTREAM_ORIGIN = "https://api.alternative.me";
const CACHE_TTL_SECONDS = 1_800;

export const onRequest: PagesFunction = (context) =>
  proxyJsonGet(context, {
    upstreamOrigin: UPSTREAM_ORIGIN,
    routePrefix: "/api/fng",
    serviceName: "Alternative.me",
    cacheTtlSeconds: CACHE_TTL_SECONDS,
  });
