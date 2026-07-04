import { useQueries } from "@tanstack/react-query";
import {
  fetchBinanceDerivatives,
  yahooToBinancePerp,
} from "@/services/api/binance";
import type { BinanceDerivatives } from "@/services/api/binance";
import { derivePositioning } from "@/features/engine/smart-money";
import type { SmartMoney, UnifiedAsset } from "@/types/asset";

export type SmartMoneyMap = Record<string, SmartMoney>;

export interface SmartMoneyResult {
  /** Positioning keyed by Yahoo symbol (only symbols that returned data). */
  data: SmartMoneyMap;
  /** At least one derivatives query is still in flight. */
  isPending: boolean;
  /**
   * True when we DID query Binance for ≥1 crypto perp but EVERY call came back
   * empty/blocked (e.g. an ISP redirects fapi.binance.com to a block page).
   * The UI uses this to show an explicit "data unavailable" alert instead of
   * silently hiding the smart-money panel.
   */
  isUnavailable: boolean;
}

/** Cap concurrent derivatives fetches — rate-limit friendliness + perf. */
const MAX_SYMBOLS = 40;

/**
 * Fetch crypto derivatives positioning ("smart money") for the given assets and
 * return a plain object keyed by Yahoo symbol. Only crypto assets with a
 * resolvable Binance perp are queried; everything else is skipped (graceful).
 *
 * The query caches the price-INDEPENDENT raw derivatives by symbol; positioning
 * (which needs live price direction) is derived in `combine` from each asset's
 * current changePercent, so it stays fresh without busting the cache.
 *
 * IMPORTANT: `combine` returns a PLAIN OBJECT, never a Map. react-query's
 * structural sharing (replaceEqualDeep) only stabilizes plain objects/arrays —
 * a Map is treated as a new reference every render, which makes the combined
 * result look "changed" each time and triggers an infinite re-render loop
 * (page-unresponsive). Plain object → stable reference when content is equal.
 */
export function useSmartMoney(assets: UnifiedAsset[]): SmartMoneyResult {
  const targets = assets
    .filter(
      (a) => a.assetType === "crypto" && yahooToBinancePerp(a.symbol) !== null,
    )
    .slice(0, MAX_SYMBOLS);

  return useQueries({
    queries: targets.map((asset) => ({
      queryKey: ["smart-money", asset.symbol],
      queryFn: async (): Promise<BinanceDerivatives | null> => {
        const perp = yahooToBinancePerp(asset.symbol);
        if (!perp) return null;
        try {
          return await fetchBinanceDerivatives(perp);
        } catch {
          return null; // no perp / unavailable → graceful
        }
      },
      staleTime: 1_800_000, // 30 minutes
      // Don't retry: when Binance is blocked (geo 451/403) or times out, a
      // retry just doubles the wait for a call that won't succeed. fetch already
      // fails fast via the shorter BINANCE_TIMEOUT, and partial/empty data is
      // handled gracefully (null → no positioning, no signal nudge).
      retry: 0,
      // Poll at 30 min (enrichment, not a live ticker). retry:0 + the fetch-layer
      // circuit breaker keep a blocked exchange (geo 451/403) to one fast-failing
      // call per interval; still opt out of reconnect refetch to avoid extra hits.
      refetchInterval: 1_800_000,
      refetchOnReconnect: false,
    })),
    combine: (results) => {
      const map: SmartMoneyMap = {};
      results.forEach((result, index) => {
        const derivatives = result.data;
        const asset = targets[index];
        if (derivatives && asset) {
          map[asset.symbol] = derivePositioning({
            ...derivatives,
            priceChangePercent: asset.changePercent,
          });
        }
      });

      // Blocked vs. simply not-crypto: only flag "unavailable" when we actually
      // attempted ≥1 query and none are still loading, yet nothing came back.
      const isPending = results.some((r) => r.isPending);
      const hasAnyData = Object.keys(map).length > 0;
      const isUnavailable =
        results.length > 0 && !isPending && !hasAnyData;

      return { data: map, isPending, isUnavailable };
    },
  });
}
