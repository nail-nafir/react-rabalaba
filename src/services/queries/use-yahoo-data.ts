import { useQueries, useQuery } from "@tanstack/react-query";
import {
  fetchYahooChart,
  fetchYahooChartPeriod,
  searchYahooAssets,
} from "@/services/api/yahoo-finance";
import { adaptYahooChart } from "@/services/adapters/yahoo-adapter";
import {
  normalizeYahooCandles,
  type NormalizedYahooCandle,
} from "@/services/adapters/yahoo-candles";
import { DEFAULT_TIMEFRAME } from "@/constants/timeframes";
import type { TradeChartWindow } from "@/features/follow-trade/lib/trade-chart-window";
import type { UnifiedAsset } from "@/types/asset";

/**
 * Fetch market data for a batch of symbols.
 * Uses useQueries to cache each symbol individually, enabling synchronization
 * between different components (e.g., Table and Detail Dialog) that might
 * request the same asset at different times.
 */
export function useMarketData(symbols: string[]) {
  const { range, interval } = DEFAULT_TIMEFRAME;

  return useQueries({
    queries: symbols.map((symbol) => ({
      queryKey: ["asset-data", symbol, range, interval],
      queryFn: async (): Promise<UnifiedAsset | null> => {
        const result = await fetchYahooChart(symbol, range, interval);
        return adaptYahooChart(result);
      },
      staleTime: 1_800_000, // 30 minutes
      refetchInterval: 1_800_000, // signals are on 1h candles — 30 min is plenty
      retry: 3,
    })),
    combine: (results) => {
      const data = results
        .map((r) => r.data)
        .filter((asset): asset is UnifiedAsset => !!asset);

      return {
        data,
        isLoading: results.some((r) => r.isLoading),
        isFetching: results.some((r) => r.isFetching),
        isError: results.some((r) => r.isError),
        error: results.find((r) => r.error)?.error,
        refetch: () => results.forEach((r) => r.refetch()),
      };
    },
  });
}

/**
 * Normalized candles for an explicit time window — charts a CLOSED journal
 * trade over its own period (see computeTradeChartWindow) instead of the
 * rolling recent window live signals use. Returns the FULL fetched range;
 * the chart trims/buckets it to its own zoomable viewport. History behind a
 * closed trade never changes, so the cache never goes stale and there is no
 * polling.
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
      return (
        normalizeYahooCandles(
          result?.indicators.quote[0],
          result?.timestamp ?? [],
        )
          // Yahoo appends the live in-progress candle even when it lies beyond
          // period2 — it would stretch the date axis far past the trade era.
          // period2 is the current hour's floor, so a bar stamped exactly there
          // is the still-forming one: strictly-less keeps only complete bars.
          .filter(
            (c) =>
              c.timestamp >= window!.period1 && c.timestamp < window!.period2,
          )
      );
    },
  });
}

/**
 * Hook for searching assets by keyword.
 */
export function useYahooSearch(query: string) {
  return useQuery({
    queryKey: ["yahoo-search", query],
    queryFn: () => searchYahooAssets(query),
    enabled: query.length >= 2,
    staleTime: 300_000, // 5 minutes
  });
}
