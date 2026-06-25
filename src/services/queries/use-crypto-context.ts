import { useQuery } from "@tanstack/react-query";
import { fetchYahooChart } from "@/services/api/yahoo-finance";
import { adaptYahooChart } from "@/services/adapters/yahoo-adapter";
import { DEFAULT_TIMEFRAME } from "@/constants/timeframes";
import { deriveCryptoContext } from "@/features/engine/crypto-context";
import { computeWindowReturns } from "@/features/engine/relative-strength";
import {
  normalizeYahooCandles,
  resampleCandlesToDaily,
} from "@/services/adapters/yahoo-candles";
import { useFearGreedIndex } from "./use-fear-greed";
import { useCryptoDominance } from "./use-crypto-dominance";
import type { CryptoContext } from "@/types/market";

/** BTC is the macro driver for the crypto sleeve. */
const BTC_SYMBOL = "BTC-USD";

/**
 * Compute the shared top-down CryptoContext once (BTC regime/trend/score +
 * crypto Fear & Greed). Reuses the full per-asset pipeline (adaptYahooChart →
 * computeSignal) on BTC, so the context's regime classification stays identical
 * to what the engine produces everywhere else. Consumed by the screener
 * (de-rate + rank), the market summary row, and the detail dialog.
 *
 * fearGreedValue is in the queryKey so the context recomputes once sentiment
 * loads (same rationale as useMarketData).
 */
export function useCryptoContext() {
  const { range, interval } = DEFAULT_TIMEFRAME;
  const { data: fearGreed } = useFearGreedIndex();
  const fearGreedValue = fearGreed?.value;

  // Dominance is optional context — fetched separately and cached longer. If it
  // fails (rate limit / unavailable) the context simply omits it (graceful).
  const { data: dominance } = useCryptoDominance();

  return useQuery({
    queryKey: [
      "crypto-context",
      range,
      interval,
      fearGreedValue,
      dominance?.btc,
      dominance?.eth,
    ],
    queryFn: async (): Promise<CryptoContext | null> => {
      const result = await fetchYahooChart(BTC_SYMBOL, range, interval);
      const btc = adaptYahooChart(result, fearGreedValue);
      if (!btc?.outlook) return null;
      const btcReturns = computeWindowReturns(
        resampleCandlesToDaily(
          normalizeYahooCandles(btc.quoteIndicators, btc.timestamps),
        ).map((c) => c.close),
      );
      return deriveCryptoContext(
        btc.outlook,
        fearGreedValue,
        dominance ?? undefined,
        btcReturns,
      );
    },
    staleTime: 60_000,
    retry: 2,
  });
}
