import type { Outlook } from "@/features/signals/engine/signal-engine";

export type AssetType = "crypto" | "us-stock" | "id-stock" | "commodity" | "forex";
export type SignalDirection = "long" | "short" | "neutral";
export type SignalTier = "A" | "B" | "C";
export type RiskLevel = "low" | "medium" | "high";

export interface YahooQuoteIndicators {
  close: (number | null)[];
  volume: (number | null)[];
  high: (number | null)[];
  low: (number | null)[];
  open: (number | null)[];
}

export interface TradingPlan {
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3?: number;
  riskRewardRatio: number;
}

export interface UnifiedAsset {
  symbol: string;
  name: string;
  assetType: AssetType;
  price: number;
  changePercent: number;
  volume: number;
  high24h?: number;
  low24h?: number;
  // Signal data (computed by signal engine)
  outlook: Outlook | null;
  tradingPlan: TradingPlan | null;
  timeframe: string;
  quoteIndicators?: YahooQuoteIndicators;
  timestamps?: number[];
  isNotFound?: boolean;
}

export type AssetFilterType = "all" | AssetType | "favorite";
