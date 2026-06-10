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

/** Net market risk posture (BTC-led for crypto). Drives whether counter-market
 *  setups are de-rated. */
export type RiskState = "risk_on" | "risk_off" | "neutral";

/** Market dominance metrics (Phase 2 — CoinGecko /global). Optional until the
 *  proxy lands. */
export interface Dominance {
  /** BTC dominance, % of total crypto market cap. */
  btc: number;
  /** ETH dominance, % of total crypto market cap. */
  eth: number;
  /** Alt-season proxy 0-100 (higher = alts outperforming BTC). */
  altSeasonIndex?: number;
}

/** Top-down market context, computed once per cycle and shared across the
 *  screener, summary row, and detail dialog. For crypto, BTC is the macro
 *  driver: most alts are leveraged beta, so a setup that fights the BTC regime
 *  is de-rated (see applyMarketContext). NOT a per-asset value. */
export interface MarketContext {
  btcTrend: TrendDirection;
  btcRegime: MarketRegime;
  /** BTC regime-weighted direction score [-1..1] from the signal engine. */
  btcDirectionScore: number;
  /** Net risk posture derived from BTC trend/score + sentiment (+ dominance). */
  riskState: RiskState;
  /** Crypto Fear & Greed value 0-100 (undefined when unavailable). */
  fearGreed?: number;
  dominance?: Dominance;
  lastUpdated: number;
}

/** Universe momentum over a single asset class (crypto sleeve by default). */
export interface Breadth {
  total: number;
  bullish: number;
  bearish: number;
  /** Percent of the universe that is bullish, 0-100. */
  bullishPercent: number;
  /** Percent of the universe that is bearish, 0-100. */
  bearishPercent: number;
}
