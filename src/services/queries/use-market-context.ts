import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { IDX_BENCHMARK_SYMBOL } from "@/constants/idx";
import { fetchYahooChart } from "@/services/api/yahoo-finance";
import {
  MARKET_CONTEXT_QUOTE_SYMBOLS,
  adaptIhsgVolatilityMarketContext,
  buildMarketContextByAssetClass,
} from "@/services/adapters/market-context";
import { useMarketData } from "@/services/queries/use-yahoo-data";
import { useCryptoDominance } from "@/services/queries/use-crypto-dominance";
import type { MarketContextByAssetClass } from "@/types/market";

const IHSG_VOLATILITY_RANGE = "3mo";
const IHSG_VOLATILITY_INTERVAL = "1d";
const MARKET_CONTEXT_CACHE_MS = 1_800_000;

/**
 * Market-level context for every asset card.
 *
 * Quote sources stay in useMarketData's canonical per-symbol cache. The DXY
 * symbol occurs once in that source list and the adapter shares its resulting
 * object across Forex and Commodity. BTC.D subscribes to the same ["dominance"]
 * cache as useCryptoContext. IHSG uses a separate daily-history query because
 * realized volatility cannot be calculated from the default 1h feed.
 */
export function useMarketContexts(): {
  data: MarketContextByAssetClass;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => void;
} {
  const quoteQuery = useMarketData([...MARKET_CONTEXT_QUOTE_SYMBOLS]);
  const dominanceQuery = useCryptoDominance();
  const ihsgQuery = useQuery({
    queryKey: [
      "market-context",
      "ihsg-volatility",
      IDX_BENCHMARK_SYMBOL,
      IHSG_VOLATILITY_RANGE,
      IHSG_VOLATILITY_INTERVAL,
    ],
    queryFn: () =>
      fetchYahooChart(
        IDX_BENCHMARK_SYMBOL,
        IHSG_VOLATILITY_RANGE,
        IHSG_VOLATILITY_INTERVAL,
      ),
    staleTime: MARKET_CONTEXT_CACHE_MS,
    refetchInterval: MARKET_CONTEXT_CACHE_MS,
    retry: 3,
  });

  const ihsgVolatility = useMemo(
    () => adaptIhsgVolatilityMarketContext(ihsgQuery.data),
    [ihsgQuery.data],
  );
  const contexts = useMemo(
    () =>
      buildMarketContextByAssetClass(
        quoteQuery.data,
        ihsgVolatility,
        dominanceQuery.data,
      ),
    [quoteQuery.data, ihsgVolatility, dominanceQuery.data],
  );

  return {
    data: contexts,
    isLoading:
      quoteQuery.isLoading || ihsgQuery.isLoading || dominanceQuery.isLoading,
    isFetching:
      quoteQuery.isFetching ||
      ihsgQuery.isFetching ||
      dominanceQuery.isFetching,
    refetch: () => {
      quoteQuery.refetch();
      void ihsgQuery.refetch();
      void dominanceQuery.refetch();
    },
  };
}
