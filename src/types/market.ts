export type TrendDirection = "bullish" | "bearish" | "sideways";

/** Market regime — which behavioral state the market is in. Indicators perform
 *  differently per regime, so the engine weights categories accordingly. */
export type MarketRegime =
  | "trending"
  | "ranging"
  | "high_volatility"
  | "low_volatility";

export interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  trend: TrendDirection;
}

export interface FearGreedData {
  value: number;
  label: string;
  timestamp: number;
  previousClose: number;
  change: number;
}

export interface MarketSummary {
  fearGreed: FearGreedData;
  indices: MarketIndex[];
  lastUpdated: number;
}
