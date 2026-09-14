import { normalizeYahooCandles } from "@/core/market/candles";
import {
  deriveFollowProgress,
  type FollowedTrade,
  type FollowProgress,
} from "@/core/trade/follow-trade-model";
import type { UnifiedAsset } from "@/types/asset";

type LiveTradeAsset = Pick<
  UnifiedAsset,
  "symbol" | "price" | "quoteIndicators" | "timestamps"
>;

/** Replay each open row against its own setup, even when symbols repeat. */
export function buildLiveProgressByTradeId(
  openTrades: FollowedTrade[],
  liveAssets: LiveTradeAsset[],
): Record<string, FollowProgress> {
  const assetBySym = new Map(liveAssets.map((asset) => [asset.symbol, asset]));
  const progressByTradeId: Record<string, FollowProgress> = {};

  for (const trade of openTrades) {
    const asset = assetBySym.get(trade.symbol);
    const candles = asset?.quoteIndicators
      ? normalizeYahooCandles(asset.quoteIndicators, asset.timestamps)
      : undefined;
    progressByTradeId[trade.id] = deriveFollowProgress(
      trade,
      asset?.price ?? trade.entryPrice,
      candles,
    );
  }

  return progressByTradeId;
}
