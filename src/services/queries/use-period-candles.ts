import { useQuery } from "@tanstack/react-query";
import { fetchYahooChartPeriod } from "@/services/api/yahoo-finance";
import {
  normalizeYahooCandles,
  type NormalizedYahooCandle,
} from "@/core/market/candles";
import type { TradeChartWindow } from "@/features/follow-trade/model/trade-chart-window";

/**
 * Normalized candles for an explicit time window — charts a CLOSED journal
 * trade over its own period instead of the rolling recent window live signals
 * use. History behind a closed trade never changes, so the cache never polls.
 */
export function usePeriodCandles(
  symbol: string | null,
  window: TradeChartWindow | null,
) {
  return useQuery({
    queryKey: [
      "period-candles",
      symbol,
      window?.period1,
      window?.period2,
      window?.fetchInterval,
    ],
    enabled: !!symbol && !!window,
    staleTime: Infinity,
    retry: 3,
    queryFn: async (): Promise<NormalizedYahooCandle[]> => {
      const result = await fetchYahooChartPeriod(
        symbol!,
        window!.period1,
        window!.period2,
        window!.fetchInterval,
      );
      return normalizeYahooCandles(
        result?.indicators.quote[0],
        result?.timestamp ?? [],
      ).filter(
        (candle) =>
          candle.timestamp >= window!.period1 &&
          candle.timestamp < window!.period2,
      );
    },
  });
}
