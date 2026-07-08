import { envString, proxyJsonGet } from "../_shared/proxy";

const UPSTREAM_ORIGIN = "https://api.coingecko.com";
const CACHE_TTL_SECONDS = 1_800;
const STALE_TTL_SECONDS = 6 * 60 * 60;

/**
 * CoinGecko free/public traffic is rate-limited by upstream infrastructure.
 * Keep the browser on our own Pages Function path, inject an optional demo key
 * server-side, and only cache healthy JSON responses.
 */
export const onRequest: PagesFunction = (context) =>
  proxyJsonGet(context, {
    upstreamOrigin: UPSTREAM_ORIGIN,
    routePrefix: "/api/coingecko",
    serviceName: "CoinGecko",
    cacheTtlSeconds: CACHE_TTL_SECONDS,
    staleTtlSeconds: STALE_TTL_SECONDS,
    errorTtlSeconds: 60,
    headers: ({ env }) => {
      const apiKey =
        envString(env, "COINGECKO_DEMO_API_KEY") ??
        envString(env, "COINGECKO_API_KEY");
      return apiKey ? { "x-cg-demo-api-key": apiKey } : undefined;
    },
  });
