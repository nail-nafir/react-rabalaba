import { proxyJsonGet } from "../_shared/proxy";

const UPSTREAM_ORIGIN = "https://fapi.binance.com";

export const onRequest: PagesFunction = (context) =>
  proxyJsonGet(context, {
    upstreamOrigin: UPSTREAM_ORIGIN,
    routePrefix: "/api/binance",
    serviceName: "Binance",
    timeoutMs: 5_000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
  });
