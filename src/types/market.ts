import type { TrendDirection } from "@/constants/taxonomy/trend";
import type { MarketRegime } from "@/constants/taxonomy/regime";
import type { AssetType } from "@/constants/taxonomy/asset";

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

/** Net market risk posture (BTC-led for crypto, IHSG-led for ID, S&P-led for
 *  US). Drives whether counter-trend setups are de-rated. */
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

/** Top-down crypto context, computed once per cycle and shared across the
 *  screener, summary row, and detail dialog. For crypto, BTC is the macro
 *  driver: most alts are leveraged beta, so a setup that fights the BTC regime
 *  is de-rated (see applyCryptoContext). NOT a per-asset value. */
export interface CryptoContext {
  btcTrend: TrendDirection;
  btcRegime: MarketRegime;
  /** BTC regime-weighted direction score [-1..1] from the signal engine. */
  btcDirectionScore: number;
  /** Net risk posture derived from BTC trend/score + sentiment (+ dominance). */
  riskState: RiskState;
  /** Crypto Fear & Greed value 0-100 (undefined when unavailable). */
  fearGreed?: number;
  dominance?: Dominance;
  /** BTC window returns in percent, reused by relative-strength (alt vs BTC). */
  btcReturns?: { r1w?: number; r1m?: number };
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

/** Top-down US-equities context — structural mirror of IdxContext with the S&P
 *  500 in IHSG's seat. US stocks are beta to the index, and when the S&P is
 *  indecisive both VIX (fear gauge) and the Dollar Index break the tie: a VIX
 *  spike or a surging dollar is risk-off pressure for equities. NOT a per-asset
 *  value. */
export interface UsContext {
  spxTrend: TrendDirection;
  spxRegime: MarketRegime;
  /** S&P 500 regime-weighted direction score [-1..1] from the signal engine. */
  spxDirectionScore: number;
  /** Net risk posture derived from S&P score + VIX/DXY tiebreaks. */
  riskState: RiskState;
  /** VIX spot level (undefined when unavailable). Higher = more fear. */
  vixLevel?: number;
  /** VIX change over ~1 trading week, percent (+ = fear rising = risk-off). */
  vix1wChangePercent?: number;
  /** Dollar Index (DXY) change over ~1 trading week, percent (+ = USD
   *  strengthening = risk-off pressure for equities/risk assets). */
  dxy1wChangePercent?: number;
  /** S&P 500 window returns in percent, reused by relative-strength display. */
  spxReturns?: { r1w?: number; r1m?: number };
  lastUpdated: number;
}

/** Universe momentum over a single asset class (crypto card by default). */
export interface Breadth {
  total: number;
  bullish: number;
  bearish: number;
  /** Percent of the universe that is bullish, 0-100. */
  bullishPercent: number;
  /** Percent of the universe that is bearish, 0-100. */
  bearishPercent: number;
}

export type MarketContextDirection = "up" | "down" | "flat";

/** A Yahoo quote used as the market-level context for an asset class. */
export interface QuoteMarketContext {
  kind: "quote";
  symbol: string;
  name: string;
  value: number;
  changePercent: number;
  direction: MarketContextDirection;
  precision: number;
  /** Epoch milliseconds, matching UnifiedAsset.quoteTime. */
  timestamp: number;
}

/** Realized volatility calculated from daily OHLC rather than a quoted index. */
export interface RealizedVolatilityMarketContext {
  kind: "realized-volatility";
  sourceSymbol: string;
  name: string;
  /** Annualized volatility in percentage points. */
  value: number;
  lookbackDays: number;
  precision: number;
  /** Epoch milliseconds of the latest completed candle in the calculation. */
  timestamp: number;
  /** Relative change vs the comparison window, when enough history exists. */
  changePercent?: number;
  direction?: MarketContextDirection;
  /** Trading-day offset of the comparison window (e.g. 5 = ~1 week). */
  changeOffsetDays?: number;
}

export type MarketContext =
  | QuoteMarketContext
  | RealizedVolatilityMarketContext;

export type MarketContextByAssetClass = Record<
  AssetType,
  MarketContext | null
>;

export type MarketPulseScoreKind = "risk_appetite" | "card";

export interface MarketPulseCardModel {
  id: string;
  title: string;
  assetGroup: AssetType;
  score: number;
  scoreKind: MarketPulseScoreKind;
  trend: TrendDirection;
  headlineValue: string;
  changePercent: number;
  sparkline?: number[];
  updatedAt: number;
  status: "active" | "degraded" | "error";
}
