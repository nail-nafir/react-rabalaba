import { useMemo } from "react";
import { useMarketData } from "./use-yahoo-data";
import { useMarketContext } from "./use-market-context";
import { applyMarketContext } from "@/features/engine/market-context";
import { DEFAULT_CRYPTO_TICKERS, TOP_CRYPTO_TICKERS } from "@/constants/assets";
import { usePremiumAccess } from "@/hooks/use-premium-access";
import type { Breadth } from "@/types/market";

/**
 * Crypto market momentum over the core liquid majors — what % are in an uptrend.
 * A participation gauge that complements the BTC regime: a "risk-on" BTC with
 * weak momentum is a narrower, more fragile move.
 *
 * Reuses the same per-symbol useMarketData cache as the screener (react-query
 * dedupes identical queryKeys), so this adds no extra network requests.
 */
export function useMarketMomentum(): {
  momentum: Breadth | null;
  isLoading: boolean;
} {
  const { hasAccess } = usePremiumAccess();
  const tickers = hasAccess ? TOP_CRYPTO_TICKERS : DEFAULT_CRYPTO_TICKERS;
  const { data: crypto, isLoading } = useMarketData(tickers);
  const { data: ctx } = useMarketContext();

  const momentum = useMemo<Breadth | null>(() => {
    if (!crypto || crypto.length === 0) return null;
    let bullish = 0;
    let bearish = 0;
    let total = 0;
    for (const asset of crypto) {
      if (!asset.outlook) continue;
      const outlook = ctx
        ? applyMarketContext(asset.outlook, asset, ctx)
        : asset.outlook;
      total += 1;
      if (outlook.trend === "bullish") bullish += 1;
      else if (outlook.trend === "bearish") bearish += 1;
    }
    if (total === 0) return null;
    return {
      total,
      bullish,
      bearish,
      bullishPercent: Math.round((bullish / total) * 100),
      bearishPercent: Math.round((bearish / total) * 100),
    };
  }, [crypto, ctx]);

  return { momentum, isLoading };
}
