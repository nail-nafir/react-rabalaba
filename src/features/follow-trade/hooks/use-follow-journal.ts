import { useEffect, useMemo } from "react";
import { useFollowStore } from "@/store/follow-store";
import { useMarketData } from "@/services/queries/use-yahoo-data";

/**
 * Feeds live prices for currently-open followed trades into the store so they
 * auto-close when a terminal level (final TP / SL) is hit. Mount once where the
 * tracker lives (terminal page). Reuses the per-symbol Yahoo query cache.
 */
export function useFollowJournal() {
  const openTrades = useFollowStore((s) => s.openTrades);
  const syncPrices = useFollowStore((s) => s.syncPrices);

  const symbols = useMemo(
    () => [...new Set(openTrades.map((t) => t.symbol))],
    [openTrades],
  );
  const { data } = useMarketData(symbols);

  const prices = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of data) m[a.symbol] = a.price;
    return m;
  }, [data]);

  useEffect(() => {
    if (Object.keys(prices).length > 0) syncPrices(prices);
  }, [prices, syncPrices]);
}
