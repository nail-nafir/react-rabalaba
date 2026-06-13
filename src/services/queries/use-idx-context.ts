import { useMemo } from "react";
import { useMarketData } from "./use-yahoo-data";
import { deriveIdxContext } from "@/features/engine/idx-context";
import { computeWindowReturns } from "@/features/engine/relative-strength";
import {
  normalizeYahooCandles,
  resampleCandlesToDaily,
} from "@/services/adapters/yahoo-candles";
import { IDX_BENCHMARK_SYMBOL, USDIDR_SYMBOL } from "@/constants/idx";
import type { IdxContext } from "@/types/market";

/** Module-level so the symbol list is identity-stable across renders. */
const IDX_CONTEXT_SYMBOLS = [IDX_BENCHMARK_SYMBOL, USDIDR_SYMBOL];

/**
 * Shared top-down IdxContext (IHSG regime/trend/score + rupiah pressure).
 *
 * Subscribes to the SAME per-symbol ["asset-data", ...] cache entries already
 * fetched on /terminal by the market summary row (^JKSE is in MARKET_INDICES)
 * and the forex sleeve (USDIDR=X is in DEFAULT_FOREX_TICKERS) — react-query
 * dedupes identical queryKeys, so this hook adds ZERO network requests there.
 * Both series are resampled to daily so the rupiah 1-week change and IHSG
 * window returns are measured in trading days, not hourly bars.
 */
export function useIdxContext(): {
  data: IdxContext | null;
  isLoading: boolean;
} {
  const { data, isLoading } = useMarketData(IDX_CONTEXT_SYMBOLS);

  const idxContext = useMemo<IdxContext | null>(() => {
    const ihsg = data.find((a) => a.symbol === IDX_BENCHMARK_SYMBOL);
    const usdIdr = data.find((a) => a.symbol === USDIDR_SYMBOL);
    if (!ihsg?.outlook) return null;

    const ihsgDaily = resampleCandlesToDaily(
      normalizeYahooCandles(ihsg.quoteIndicators, ihsg.timestamps),
    );
    const ihsgReturns = computeWindowReturns(ihsgDaily.map((c) => c.close));

    // USDIDR missing/failed → no tiebreak, IHSG decides alone (graceful).
    let usdIdrInput: Parameters<typeof deriveIdxContext>[1] = {
      trend: "sideways",
    };
    if (usdIdr?.outlook) {
      const usdIdrDaily = resampleCandlesToDaily(
        normalizeYahooCandles(usdIdr.quoteIndicators, usdIdr.timestamps),
      );
      const { r1w } = computeWindowReturns(usdIdrDaily.map((c) => c.close));
      usdIdrInput = {
        trend: usdIdr.outlook.trend,
        oneWeekChangePercent: r1w,
      };
    }

    return deriveIdxContext(ihsg.outlook, usdIdrInput, ihsgReturns);
  }, [data]);

  return { data: idxContext, isLoading };
}
