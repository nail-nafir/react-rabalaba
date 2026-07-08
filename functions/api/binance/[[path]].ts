import { proxyJsonGet, type ProxyCachePolicy } from "../_shared/proxy";

const UPSTREAM_ORIGIN = "https://fapi.binance.com";
const RECOVERABLE_BINANCE_STATUSES: ProxyCachePolicy["staleOnStatuses"] = [
  403,
  418,
  429,
  451,
  [500, 599],
];

function cachePolicy(_context: unknown, _requestUrl: URL, upstreamUrl: URL) {
  const path = upstreamUrl.pathname;
  const shared = {
    errorTtlSeconds: 60,
    staleOnStatuses: RECOVERABLE_BINANCE_STATUSES,
  } satisfies Partial<ProxyCachePolicy>;

  if (
    path.includes("/futures/data/openInterestHist") ||
    path.includes("/futures/data/globalLongShortAccountRatio")
  ) {
    return {
      ...shared,
      freshTtlSeconds: 1_800,
      staleTtlSeconds: 6 * 60 * 60,
    };
  }

  if (path.includes("/fapi/v1/premiumIndex")) {
    return {
      ...shared,
      freshTtlSeconds: 900,
      staleTtlSeconds: 2 * 60 * 60,
    };
  }

  if (path.includes("/fapi/v1/ticker/24hr")) {
    return {
      ...shared,
      freshTtlSeconds: 300,
      staleTtlSeconds: 60 * 60,
    };
  }

  return {
    ...shared,
    freshTtlSeconds: 300,
    staleTtlSeconds: 60 * 60,
  };
}

export const onRequest: PagesFunction = (context) =>
  proxyJsonGet(context, {
    upstreamOrigin: UPSTREAM_ORIGIN,
    routePrefix: "/api/binance",
    serviceName: "Binance",
    timeoutMs: 5_000,
    cachePolicy,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
  });
