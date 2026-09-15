import type { BacktestMetrics } from "@/core/engine/backtest";
import type { NormalizedYahooCandle } from "@/core/market/candles";
import type { TerminalAsset } from "@/core/automation/signal-episode";
import type {
  FollowProgress,
  FollowedTrade,
} from "@/core/trade/follow-trade-model";
import type { CryptoContext, IdxContext, UsContext } from "@/types/market";
import type { TradingPlan, UnifiedAsset } from "@/types/asset";
import {
  MAX_RESEARCH_CONTEXT_CANDLES,
  type ResearchCandle,
  type TerminalResearchContext,
} from "./terminal-context";

function recentCandles(candles: NormalizedYahooCandle[]): ResearchCandle[] {
  return candles.slice(-MAX_RESEARCH_CONTEXT_CANDLES).map((candle) => ({
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    timestamp: candle.timestamp,
  }));
}

export function buildAssetResearchContext({
  asset,
  signalStatus,
  candles,
  backtest,
  marketContext,
}: {
  asset: TerminalAsset;
  signalStatus?: TerminalAsset["signalStatus"];
  candles: NormalizedYahooCandle[];
  backtest: BacktestMetrics | null | undefined;
  marketContext: {
    crypto: CryptoContext | null;
    idx: IdxContext | null;
    us: UsContext | null;
  };
}): TerminalResearchContext {
  return {
    kind: "asset",
    capturedAt: Date.now(),
    symbol: asset.symbol,
    name: asset.name,
    assetType: asset.assetType,
    price: asset.price,
    changePercent: asset.changePercent,
    quoteTime: asset.quoteTime ?? null,
    timeframe: asset.timeframe,
    signalStatus: signalStatus ?? asset.signalStatus,
    outlook: asset.outlook,
    tradingPlan: asset.tradingPlan,
    overlays: {
      smartMoney: asset.smartMoney,
      accumulation: asset.accumulation,
      relativeStrength: asset.relativeStrength,
      fundamentals: asset.fundamentals,
      speculativeRisk: asset.speculativeRisk,
    },
    marketContext,
    backtest: backtest ?? null,
    recentCandles: recentCandles(candles),
  };
}

export function buildTradeResearchContext({
  trade,
  asset,
  candles,
  tradingPlan,
  price,
  changePercent,
  pnl,
  progress,
}: {
  trade: FollowedTrade;
  asset?: UnifiedAsset;
  candles: NormalizedYahooCandle[];
  tradingPlan: TradingPlan;
  price: number;
  changePercent: number;
  pnl: { pct: number; r: number };
  progress: FollowProgress;
}): TerminalResearchContext {
  const {
    id,
    signal,
    timeframe,
    entryPrice,
    stopLoss,
    takeProfits,
    riskRewardRatio,
    strengthAtEntry,
    grade,
    regime,
    higherTimeframeTrend,
    directionScore,
    followedAt,
    highestTpReached,
    status,
    exitReason,
    reversed,
    closePrice,
    closedAt,
  } = trade;

  return {
    kind: "trade",
    capturedAt: Date.now(),
    symbol: trade.symbol,
    name: trade.name,
    assetType: trade.assetType,
    price,
    changePercent,
    quoteTime: asset?.quoteTime ?? null,
    timeframe,
    signalStatus: progress.lifecycle === "open" ? "active" : "neutral",
    outlook: asset?.outlook ?? null,
    tradingPlan,
    overlays: {
      smartMoney: asset?.smartMoney,
      accumulation: asset?.accumulation,
      relativeStrength: asset?.relativeStrength,
      fundamentals: asset?.fundamentals,
      speculativeRisk: asset?.speculativeRisk,
    },
    marketContext: { crypto: null, idx: null, us: null },
    backtest: null,
    recentCandles: recentCandles(candles),
    position: {
      id,
      signal,
      timeframe,
      entryPrice,
      stopLoss,
      takeProfits,
      riskRewardRatio,
      strengthAtEntry,
      grade,
      regime,
      higherTimeframeTrend,
      directionScore,
      followedAt,
      highestTpReached,
      status,
      exitReason,
      reversed,
      closePrice,
      closedAt,
      pnl,
      progress: {
        lifecycle: progress.lifecycle,
        tpReached: progress.tpReached,
        tpSecured: progress.tpSecured,
        tpTotal: progress.tpTotal,
        slHit: progress.slHit,
        exitReason: progress.exitReason,
      },
    },
  };
}
