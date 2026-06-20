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
    staleTime: 600_000, // 10 minutes (CoinGecko free tier is rate-limited)
    refetchInterval: 600_000,
    retry: 1,
    meta: { silent: true }, // optional context; handled gracefully if it fails
  });
}
