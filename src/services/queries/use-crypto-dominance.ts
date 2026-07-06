import { useQuery } from "@tanstack/react-query";
import { fetchDominance } from "@/services/api/coingecko";
import type { Dominance } from "@/types/market";

/**
 * BTC/ETH market dominance from CoinGecko's free `/global` endpoint.
 *
 * Optional context — cached longer than price/sentiment because the CoinGecko
 * free tier is rate-limited. If it fails (rate limit / unavailable) consumers
 * simply omit it (graceful). Shares the ["dominance"] queryKey so every caller
 * (market context, summary row) reuses a single cache entry / request.
 */
export function useCryptoDominance() {
  return useQuery<Dominance>({
    queryKey: ["dominance"],
    queryFn: fetchDominance,
    staleTime: 1_800_000, // 30 min — edge proxy caches for the same duration
    gcTime: 3_600_000, // 1 h — keep stale data in memory even after unmount
    refetchInterval: 1_800_000,
    retry: 3, // transient 502/timeout from the edge proxy → worth retrying
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000), // 1 s → 2 s → 4 s
    placeholderData: (prev) => prev, // keep old donut visible during refetch
    meta: { silent: true }, // optional context; handled gracefully if it fails
  });
}
