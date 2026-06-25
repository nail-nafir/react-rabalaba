import type { Outlook } from "@/features/engine/signals";
import type { AssetType } from "@/constants/taxonomy/asset";
import type { RelativeStrengthLabel } from "@/constants/taxonomy/indicator";

// Categorical domain types are sourced from @/constants/taxonomy (the value
// list is the source of truth). Re-exported here so the many existing
// `@/types/asset` import sites keep resolving unchanged.
export type { AssetType, AssetFilterType } from "@/constants/taxonomy/asset";
export type { SignalDirection } from "@/constants/taxonomy/signal";
export type { SignalTier } from "@/constants/taxonomy/tier";
export type { RiskLevel } from "@/constants/taxonomy/risk";

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
  /** OI×price quadrant directions behind the label, when applicable. */
  flow?: { oi: "up" | "down"; price: "up" | "down" };
}

/** OHLCV-derived accumulation/distribution flow-read for equities (US & ID
 *  stocks). Free data has no broker summary, so institutional flow is
 *  approximated from DAILY price/volume behavior only. Present only for
 *  volume-reliable equities with enough daily history (graceful otherwise). */
export interface Accumulation {
  /** Net flow score [-1..1]: + accumulation, − distribution. */
  score: number;
  /** Short interpretation, e.g. "Accumulation", "Strong distribution". */
  label: string;
  /** Components behind the composite. All in [-1..1] except `mfi`, which is
   *  the raw Money Flow Index 0-100 (display-friendly; the score uses its
   *  normalized form (MFI − 50) / 50 internally). */
  breakdown: {
    adFlow: number;
    cmf: number;
    mfi: number;
    upDownVolume: number;
    spikeBias: number;
  };
  /** Number of daily candles analyzed. */
  daysAnalyzed: number;
  /** False when some volume data is missing (still scored, but read it with
   *  more caution). Too-patchy volume yields null instead of an Accumulation. */
  reliable: boolean;
}

/** Excess performance vs the asset's OWN benchmark in percentage points
 *  (id-stock → IHSG, us-stock → S&P 500, crypto → BTC). r-windows are trading
 *  days (1w = 5, 1m ≈ 21). Drives a bounded conviction nudge + display. */
export interface RelativeStrength {
  /** Asset 1-week % return minus the benchmark's. + = outperforming. */
  r1w?: number;
  /** Asset 1-month % return minus the benchmark's. + = outperforming. */
  r1m?: number;
  label: RelativeStrengthLabel;
  /** Benchmark display name (e.g. "IHSG", "S&P 500", "BTC"). */
  benchmark?: string;
}

/** Fundamentals + analyst overlay for stocks (us-stock & id-stock), from Yahoo
 *  quoteSummary (v10). Slow-moving, fetched per-asset and cached for hours; all
 *  fields optional because the endpoint is gated on some Yahoo edges. Used for
 *  conservative warnings + a bounded analyst nudge — never flips a signal. */
export interface Fundamentals {
  /** Trailing price/earnings. */
  trailingPE?: number;
  /** Price/book. */
  priceToBook?: number;
  /** Debt/equity as Yahoo reports it (a percentage, e.g. 47.6 = 0.476×). */
  debtToEquity?: number;
  /** Analyst consensus score [-1..1]: + bullish, from the latest
   *  recommendationTrend period (strongBuy..strongSell weighted). */
  analystScore?: number;
  /** Number of analysts behind analystScore. */
  analystCount?: number;
  /** Yahoo's recommendationKey, e.g. "buy", "hold". */
  recommendationKey?: string;
  /** Next earnings date (epoch ms), when known — drives the pre-earnings
   *  blackout. */
  nextEarningsMs?: number;
}

/** OHLC-only speculative/"gorengan" heuristics for Indonesian stocks
 *  (Phase 2). Auto-reject bands are approximations from daily closes — the
 *  special monitoring board (full call auction ±10%) is NOT detectable from
 *  OHLC, so warnings are phrased as approximate. */
export interface SpeculativeRisk {
  flags: {
    nearAra: boolean;
    nearArb: boolean;
    limitLock: boolean;
    consecutiveLimitMoves: number;
    lowLiquidity: boolean;
    extremeRange: boolean;
    pennyZone: boolean;
  };
  /** Count of raised flags — drives risk escalation, never signal changes. */
  severity: number;
  warnings: string[];
  /** Auto-reject band as fractions of the reference price (ara = up limit,
   *  arb = down limit). Split so an asymmetric regime is a one-line change. */
  band: { ara: number; arb: number };
  medianDailyValueRp: number;
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
  /** Epoch ms of the latest quote (Yahoo meta.regularMarketTime). Drives the
   *  auto-journal freshness guard — a stale snapshot must NOT be journaled. */
  quoteTime?: number;
  quoteIndicators?: YahooQuoteIndicators;
  timestamps?: number[];
  isNotFound?: boolean;
  // ── Enrichment (computed AFTER per-asset signals, over the full universe) ──
  /** Crypto derivatives positioning (Phase 3), when available. */
  smartMoney?: SmartMoney;
  /** OHLCV accumulation/distribution read (equities only), when derivable. */
  accumulation?: Accumulation;
  /** Excess return vs the asset's own benchmark (id→IHSG, us→S&P, crypto→BTC),
   *  when derivable. */
  relativeStrength?: RelativeStrength;
  /** Fundamentals + analyst overlay (stocks only), when available. */
  fundamentals?: Fundamentals;
  /** Speculative/"gorengan" risk heuristics (id-stock only, Phase 2). */
  speculativeRisk?: SpeculativeRisk;
}
