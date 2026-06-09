import { useEffect, useMemo } from "react";
import { useFollowStore } from "@/store/follow-store";
import { useMarketData } from "@/services/queries/use-yahoo-data";
import { normalizeYahooCandles } from "@/services/adapters/yahoo-candles";
import type { FollowCandle } from "@/features/follow-trade/lib/follow-trade-model";

/**
 * Feeds live prices for currently-open followed trades into the store so they
 * auto-close when a terminal level (final TP / SL) is hit. Mount once where the
 * tracker lives (terminal page). Reuses the per-symbol Yahoo query cache.
 *
 * Besides the latest price, it passes the candle history SINCE each trade was
 * followed. A sparse price snapshot can miss a TP/SL only touched by an intraday
 * wick (price bounces back before the next sync); the candles catch it — and let
 * the store stamp the close with the REAL hit time. This also survives reloads:
 * a level hit while the app was closed is still detected on the next fetch.
 */
export function useFollowJournal() {
  const openTrades = useFollowStore((s) => s.openTrades);
  const syncPrices = useFollowStore((s) => s.syncPrices);

  const symbols = useMemo(
    () => [...new Set(openTrades.map((t) => t.symbol))],
    [openTrades],
  );
  const { data } = useMarketData(symbols);

  const { prices, candlesBySymbol } = useMemo(() => {
    const prices: Record<string, number> = {};
    const candlesBySymbol: Record<string, FollowCandle[]> = {};
    const followedAtBySymbol = new Map(
      openTrades.map((t) => [t.symbol, t.followedAt]),
    );

    for (const asset of data) {
      prices[asset.symbol] = asset.price;
      const followedAt = followedAtBySymbol.get(asset.symbol);
      if (followedAt == null) continue;

      const candles = asset.quoteIndicators
        ? normalizeYahooCandles(asset.quoteIndicators, asset.timestamps)
        : [];
      // Keep only candles AFTER the follow time; normalize timestamps to ms
      // (Yahoo gives seconds, followedAt is ms).
      const since = candles
        .filter((c) => c.timestamp * 1000 >= followedAt)
        .map<FollowCandle>((c) => ({
          high: c.high,
          low: c.low,
          timestamp: c.timestamp * 1000,
        }));
      if (since.length > 0) candlesBySymbol[asset.symbol] = since;
    }
    return { prices, candlesBySymbol };
  }, [data, openTrades]);

  useEffect(() => {
    if (Object.keys(prices).length > 0) syncPrices(prices, candlesBySymbol);
  }, [prices, candlesBySymbol, syncPrices]);
}
