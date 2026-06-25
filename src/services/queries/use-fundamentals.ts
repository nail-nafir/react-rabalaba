import { useQuery } from "@tanstack/react-query";
import { fetchYahooQuoteSummary } from "@/services/api/yahoo-finance";
import { adaptYahooFundamentals } from "@/services/adapters/yahoo-fundamentals";
import type { AssetType, Fundamentals } from "@/types/asset";

/** Fundamentals apply to stocks only — crypto/commodity/forex have none here. */
const STOCK_TYPES: AssetType[] = ["us-stock", "id-stock"];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Per-asset fundamentals + analyst overlay (stocks only). Slow-moving data, so
 * it's cached for a day. Disabled for non-stocks and when no symbol is open
 * (one extra quoteSummary fetch per asset — used by the detail dialog, NOT the
 * screener table). Resolves to null gracefully when Yahoo gates the endpoint.
 */
export function useFundamentals(
  symbol: string | undefined,
  assetType: AssetType | undefined,
) {
  const enabled =
    !!symbol && !!assetType && STOCK_TYPES.includes(assetType);
  return useQuery({
    queryKey: ["fundamentals", symbol],
    enabled,
    queryFn: async (): Promise<Fundamentals | null> => {
      const raw = await fetchYahooQuoteSummary(symbol!);
      return adaptYahooFundamentals(raw);
    },
    staleTime: DAY_MS,
    gcTime: DAY_MS,
    retry: 1,
  });
}
