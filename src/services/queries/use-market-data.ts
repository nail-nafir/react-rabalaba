import { useQueries, useQuery } from "@tanstack/react-query";
import {
  fetchYahooChart,
  searchYahooAssets,
} from "@/services/api/yahoo-finance";
import { adaptYahooChart } from "@/services/adapters/yahoo-adapter";
import { DEFAULT_TIMEFRAME } from "@/constants/timeframes";
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
      staleTime: 1_800_000,
      refetchInterval: 1_800_000,
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

/** Hook for searching assets by keyword. */
export function useYahooSearch(query: string) {
  return useQuery({
    queryKey: ["yahoo-search", query],
    queryFn: () => searchYahooAssets(query),
    enabled: query.length >= 2,
    staleTime: 300_000,
  });
}
