import { useMemo } from "react";
import { useMarketData } from "./use-yahoo-data";
import { useCryptoContext } from "./use-crypto-context";
import { applyCryptoContext } from "@/features/engine/crypto-context";
import { useScreenerUniverse } from "@/hooks/use-screener-universe";
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
  // Premium → admin-managed DB crypto universe; free → DEFAULT_CRYPTO (the hook
  // handles the gate + fallback). Same per-symbol cache the screener uses.
  const { crypto: cryptoTickers } = useScreenerUniverse();
  const { data: crypto, isLoading } = useMarketData(cryptoTickers);
  const { data: ctx } = useCryptoContext();

  const momentum = useMemo<Breadth | null>(() => {
    if (!crypto || crypto.length === 0) return null;
    let bullish = 0;
    let bearish = 0;
    let total = 0;
    for (const asset of crypto) {
      if (!asset.outlook) continue;
      const outlook = ctx
        ? applyCryptoContext(asset.outlook, asset, ctx)
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
