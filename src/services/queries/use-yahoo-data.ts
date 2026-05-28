import { useQueries, useQuery } from "@tanstack/react-query";
import { fetchYahooChart, searchYahooAssets } from "@/services/api/yahoo-finance";
import { adaptYahooChart } from "@/services/adapters/yahoo-adapter";
import { DEFAULT_TIMEFRAME } from "@/constants/timeframes";
import { useFearGreedIndex } from "./use-fear-greed";
import type { UnifiedAsset } from "@/types/asset";

/**
 * Fetch market data for a batch of symbols.
 * Uses useQueries to cache each symbol individually, enabling synchronization
 * between different components (e.g., Table and Detail Dialog) that might
 * request the same asset at different times.
 *
 * fearGreedValue is included in the queryKey so that the cached signal is
 * always computed with the same sentiment context. Without it, the first
 * fetch (before Fear & Greed loads) would be cached with `undefined` and
 * served stale until staleTime expires.
 */
export function useMarketData(symbols: string[]) {
  const { range, interval } = DEFAULT_TIMEFRAME;
  const { data: fearGreed } = useFearGreedIndex();
  const fearGreedValue = fearGreed?.value;

  return useQueries({
    queries: symbols.map((symbol) => ({
      queryKey: ["asset-data", symbol, range, interval, fearGreedValue],
      queryFn: async (): Promise<UnifiedAsset | null> => {
        const result = await fetchYahooChart(symbol, range, interval);
        return adaptYahooChart(result, fearGreedValue);
      },
      staleTime: 60_000,
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
