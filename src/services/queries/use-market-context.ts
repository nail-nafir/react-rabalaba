import { useQuery } from "@tanstack/react-query";
import { fetchYahooChart } from "@/services/api/yahoo-finance";
import { adaptYahooChart } from "@/services/adapters/yahoo-adapter";
import { DEFAULT_TIMEFRAME } from "@/constants/timeframes";
import { deriveMarketContext } from "@/features/engine/market-context";
import { useFearGreedIndex } from "./use-fear-greed";
import { useCryptoDominance } from "./use-crypto-dominance";
import type { MarketContext } from "@/types/market";

/** BTC is the macro driver for the crypto sleeve. */
const BTC_SYMBOL = "BTC-USD";

/**
 * Compute the shared top-down MarketContext once (BTC regime/trend/score +
 * crypto Fear & Greed). Reuses the full per-asset pipeline (adaptYahooChart →
 * computeSignal) on BTC, so the context's regime classification stays identical
 * to what the engine produces everywhere else. Consumed by the screener
 * (de-rate + rank), the market summary row, and the detail dialog.
 *
 * fearGreedValue is in the queryKey so the context recomputes once sentiment
 * loads (same rationale as useMarketData).
 */
export function useMarketContext() {
  const { range, interval } = DEFAULT_TIMEFRAME;
  const { data: fearGreed } = useFearGreedIndex();
  const fearGreedValue = fearGreed?.value;

  // Dominance is optional context — fetched separately and cached longer. If it
  // fails (rate limit / unavailable) the context simply omits it (graceful).
  const { data: dominance } = useCryptoDominance();

  return useQuery({
    queryKey: [
      "market-context",
      range,
      interval,
      fearGreedValue,
      dominance?.btc,
      dominance?.eth,
    ],
    queryFn: async (): Promise<MarketContext | null> => {
      const result = await fetchYahooChart(BTC_SYMBOL, range, interval);
      const btc = adaptYahooChart(result, fearGreedValue);
      if (!btc?.outlook) return null;
      return deriveMarketContext(
        btc.outlook,
        fearGreedValue,
        dominance ?? undefined,
      );
    },
    staleTime: 60_000,
    retry: 2,
  });
}
