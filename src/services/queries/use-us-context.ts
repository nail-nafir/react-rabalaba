import { useMemo } from "react";
import { useMarketData } from "./use-yahoo-data";
import { deriveUsContext } from "@/features/engine/us-context";
import { computeWindowReturns } from "@/features/engine/relative-strength";
import {
  normalizeYahooCandles,
  resampleCandlesToDaily,
} from "@/services/adapters/yahoo-candles";
import { US_BENCHMARK_SYMBOL, VIX_SYMBOL, DXY_SYMBOL } from "@/constants/us";
import type { UsContext } from "@/types/market";

/** Module-level so the symbol list is identity-stable across renders. */
const US_CONTEXT_SYMBOLS = [US_BENCHMARK_SYMBOL, VIX_SYMBOL, DXY_SYMBOL];

/**
 * Shared top-down UsContext (S&P 500 regime/trend/score + VIX/DXY tiebreaks).
 *
 * Subscribes to the SAME per-symbol ["asset-data", ...] cache entries already
 * fetched on /terminal by the market summary row (^GSPC is in MARKET_INDICES) —
 * react-query dedupes identical queryKeys, so adding ^GSPC costs ZERO extra
 * network there; ^VIX and DX-Y.NYB are the only genuinely new fetches. VIX/DXY
 * series are resampled to daily so the 1-week changes are measured in trading
 * days, not hourly bars. Missing VIX/DXY → S&P decides alone (graceful).
 */
export function useUsContext(): {
  data: UsContext | null;
  isLoading: boolean;
} {
  const { data, isLoading } = useMarketData(US_CONTEXT_SYMBOLS);

  const usContext = useMemo<UsContext | null>(() => {
    const spx = data.find((a) => a.symbol === US_BENCHMARK_SYMBOL);
    const vix = data.find((a) => a.symbol === VIX_SYMBOL);
    const dxy = data.find((a) => a.symbol === DXY_SYMBOL);
    if (!spx?.outlook) return null;

    const spxDaily = resampleCandlesToDaily(
      normalizeYahooCandles(spx.quoteIndicators, spx.timestamps),
    );
    const spxReturns = computeWindowReturns(spxDaily.map((c) => c.close));

    const tiebreak: Parameters<typeof deriveUsContext>[1] = {};
    if (vix) {
      tiebreak.vixLevel = vix.price;
      const vixDaily = resampleCandlesToDaily(
        normalizeYahooCandles(vix.quoteIndicators, vix.timestamps),
      );
      tiebreak.vix1wChangePercent = computeWindowReturns(
        vixDaily.map((c) => c.close),
      ).r1w;
    }
    if (dxy) {
      const dxyDaily = resampleCandlesToDaily(
        normalizeYahooCandles(dxy.quoteIndicators, dxy.timestamps),
      );
      tiebreak.dxy1wChangePercent = computeWindowReturns(
        dxyDaily.map((c) => c.close),
      ).r1w;
    }

    return deriveUsContext(spx.outlook, tiebreak, spxReturns);
  }, [data]);

  return { data: usContext, isLoading };
}
