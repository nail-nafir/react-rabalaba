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
import { useCryptoDominance } from "./use-crypto-dominance";
import type { CryptoContext } from "@/types/market";

/** BTC is the macro driver for the crypto card. */
const BTC_SYMBOL = "BTC-USD";

/**
 * Compute the shared top-down CryptoContext once (BTC regime/trend/score).
 * Reuses the full per-asset pipeline (adaptYahooChart → computeSignal) on BTC,
 * so the context's regime classification stays identical to what the engine
 * produces everywhere else. Consumed by the screener (de-rate + rank), the
 * market summary row, and the detail dialog.
 */
export function useCryptoContext() {
  const { range, interval } = DEFAULT_TIMEFRAME;

  // Dominance is optional context — fetched separately and cached longer. If it
  // fails (rate limit / unavailable) the context simply omits it (graceful).
  const { data: dominance } = useCryptoDominance();

  return useQuery({
    queryKey: [
      "crypto-context",
      range,
      interval,
      dominance?.btc,
      dominance?.eth,
      dominance?.btcDominanceChangePercent24h,
      dominance?.updatedAt,
    ],
    queryFn: async (): Promise<CryptoContext | null> => {
      const result = await fetchYahooChart(BTC_SYMBOL, range, interval);
      const btc = adaptYahooChart(result);
      if (!btc?.outlook) return null;
      const btcReturns = computeWindowReturns(
        resampleCandlesToDaily(
          normalizeYahooCandles(btc.quoteIndicators, btc.timestamps),
        ).map((c) => c.close),
      );
      return deriveCryptoContext(
        btc.outlook,
        dominance ?? undefined,
        btcReturns,
      );
    },
    staleTime: 1_800_000, // 30 minutes
    refetchInterval: 1_800_000,
    retry: 2,
  });
}
