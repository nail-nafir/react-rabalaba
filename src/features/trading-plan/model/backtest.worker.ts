import { runBacktest } from "@/core/engine/backtest";
import type { BacktestMetrics } from "@/core/engine/backtest";
import type { NormalizedYahooCandle } from "@/core/market/candles";
import type { AssetType } from "@/types/asset";
import type { TimeframePresetKey } from "@/constants/timeframes";

export interface BacktestRequest {
  candles: NormalizedYahooCandle[];
  assetType: AssetType;
  timeframe: TimeframePresetKey;
}

export type BacktestResponse = { metrics: BacktestMetrics } | { error: string };

self.onmessage = ({ data }: MessageEvent<BacktestRequest>) => {
  try {
    const { candles, assetType, timeframe } = data;
    self.postMessage({
      // Same exit model as the live journal (engine-v7 scale-out).
      metrics: runBacktest(candles, {
        assetType,
        timeframe,
        exitMode: "scaleOut",
      }).metrics,
    } satisfies BacktestResponse);
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Backtest failed",
    } satisfies BacktestResponse);
  }
};
