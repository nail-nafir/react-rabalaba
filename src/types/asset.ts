import type { Outlook } from "@/features/engine/signals";

export type AssetType =
  | "crypto"
  | "us-stock"
  | "id-stock"
  | "commodity"
  | "forex";
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

/** Crypto derivatives positioning ("smart money"), from Binance public futures
 *  API (Phase 3). Present only for crypto assets that have a perpetual market;
 *  undefined otherwise (graceful). Informs conviction + ranking + display. */
export interface SmartMoney {
  /** Current open interest (base units). Absent if the OI source was blocked. */
  openInterest?: number;
  /** OI change over the lookback window as a fraction (0.05 = +5%). */
  openInterestDelta?: number;
  /** Latest funding rate as a fraction (0.0001 = 0.01%). */
  fundingRate?: number;
  /** Global long/short account ratio (>1 = crowd is net long). */
  longShortRatio?: number;
  /** Positioning score [-1..1]: + supportive of upside, - of downside. */
  positioningScore: number;
  /** Short interpretation, e.g. "New longs", "Crowded longs (squeeze risk)". */
  label: string;
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
  // ── Enrichment (computed AFTER per-asset signals, over the full universe) ──
  /** Crypto derivatives positioning (Phase 3), when available. */
  smartMoney?: SmartMoney;
}

export type AssetFilterType = "all" | AssetType | "favorite";
