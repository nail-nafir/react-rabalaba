import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/services/api/client";
import { fetchDominance } from "@/services/api/coingecko";
import type { Dominance } from "@/types/market";

/**
 * BTC/ETH market dominance plus BTC.D's relative 24-hour change from
 * CoinGecko's free `/global` and `/coins/markets` endpoints. Both requests are
 * browser-direct so CoinGecko sees the visitor's IP.
 *
 * Optional context — cached longer than price data because the CoinGecko
 * free tier is rate-limited. If it fails (rate limit / unavailable) consumers
 * simply omit it (graceful). Shares the ["dominance"] queryKey so every caller
 * (market context, summary row) reuses a single cache entry / request.
 */
export function useCryptoDominance() {
  return useQuery<Dominance>({
    queryKey: ["dominance"],
    queryFn: fetchDominance,
    staleTime: 1_800_000, // 30 min — market context does not need tick cadence
    gcTime: 3_600_000, // 1 h — keep stale data in memory even after unmount
    refetchInterval: 1_800_000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status < 500) return false;
      return failureCount < 3;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000), // 1 s → 2 s → 4 s
    placeholderData: (prev) => prev, // keep the previous context visible on refetch
    meta: { silent: true }, // optional context; handled gracefully if it fails
  });
}
