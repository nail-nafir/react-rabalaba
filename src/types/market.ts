import type { TrendDirection } from "@/constants/taxonomy/trend";
import type { MarketRegime } from "@/constants/taxonomy/regime";

// Sourced from @/constants/taxonomy; re-exported so existing `@/types/market`
// imports keep resolving unchanged.
export type { TrendDirection } from "@/constants/taxonomy/trend";
export type { MarketRegime } from "@/constants/taxonomy/regime";

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

/** Top-down IDX (Indonesian equities) context — structural mirror of
 *  MarketContext with IHSG in BTC's seat. .JK stocks are beta to IHSG flow,
 *  and foreign outflow shows up in the rupiah first, so USDIDR acts as the
 *  tiebreak when IHSG is indecisive. NOTE: a bullish USDIDR trend means the
 *  rupiah is WEAKENING (= risk-off pressure). NOT a per-asset value. */
export interface IdxContext {
  ihsgTrend: TrendDirection;
  ihsgRegime: MarketRegime;
  /** IHSG regime-weighted direction score [-1..1] from the signal engine. */
  ihsgDirectionScore: number;
  /** Net risk posture derived from IHSG score + rupiah pressure tiebreak. */
  riskState: RiskState;
  /** USDIDR trend (bullish = rupiah weakening = risk-off pressure). */
  usdIdrTrend: TrendDirection;
  /** USDIDR change over ~1 trading week, percent (+ = rupiah weakening). */
  usdIdr1wChangePercent?: number;
  /** IHSG window returns in percent, reused by relative-strength display. */
  ihsgReturns?: { r1w?: number; r1m?: number };
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
