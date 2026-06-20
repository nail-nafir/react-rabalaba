/** Signal engine thresholds and scoring configuration.
 *
 *  This module is now engine NUMERIC config only. The categorical display maps
 *  that used to live here (SIGNAL_COLORS/LABELS, TIER/RISK/REGIME/STATUS colors,
 *  TREND_DISPLAY, filter options) moved to @/constants/taxonomy/* — the single
 *  source of truth for each domain's values, colors and label keys. */
import type { CategoryKey } from "@/constants/taxonomy/category";
import type { MarketRegime } from "@/constants/taxonomy/regime";

/** Weighted scoring — each indicator contributes differently based on reliability */
export const SIGNAL_WEIGHTS = {
  EMA_ALIGNMENT: 1.5,
  MACD: 1.0,
  RSI: 1.0,
  ADX_TREND: 1.0,
  VOLUME_SPIKE: 0.75,
  BOLLINGER: 0.75,
  STOCH_RSI: 0.5,
  OBV_DIRECTION: 0.5,
  RSI_DIVERGENCE: 1.0,
  FIBONACCI_BOUNCE: 1.0,
};

export const SIGNAL_THRESHOLDS = {
  RSI_OVERSOLD: 30,
  RSI_OVERBOUGHT: 70,
  VOLUME_SPIKE_MULTIPLIER: 1.5,
  /** Max share of zero/missing-volume candles (in the recent window) tolerated
   *  before OBV and volume-spike confirmation are disabled. Crypto feeds (e.g.
   *  Yahoo) frequently return volume:0, which fakes spikes and corrupts OBV. */
  ZERO_VOLUME_MAX_RATIO: 0.3,
  /** Recent candle window used to measure volume reliability. */
  VOLUME_RELIABILITY_WINDOW: 50,
  // ADX thresholds
  ADX_STRONG_TREND: 25,
  ADX_WEAK_TREND: 20,
  // Bollinger Bands
  BOLLINGER_PERIOD: 20,
  BOLLINGER_STD_DEV: 2,
  // Stochastic RSI
  STOCH_RSI_OVERSOLD: 20,
  STOCH_RSI_OVERBOUGHT: 80,
};

/** Market regime classification thresholds (Layer 1). */
export const REGIME_THRESHOLDS = {
  /** Bollinger bandwidth (% of middle band) below this = compression/squeeze. */
  SQUEEZE_BANDWIDTH_PERCENT: 3,
  /** ADX below this counts as non-trending for squeeze detection. */
  SQUEEZE_MAX_ADX: 20,
};

/** Maximum raw (unsigned) contribution each category can accumulate, derived
 *  from the indicator weights it owns. Used to normalize categories to [-1..1]. */
export const CATEGORY_MAX_SCORE: Record<CategoryKey, number> = {
  trend:
    SIGNAL_WEIGHTS.EMA_ALIGNMENT +
    SIGNAL_WEIGHTS.MACD +
    SIGNAL_WEIGHTS.ADX_TREND,
  momentum:
    SIGNAL_WEIGHTS.RSI +
    SIGNAL_WEIGHTS.STOCH_RSI +
    SIGNAL_WEIGHTS.RSI_DIVERGENCE,
  volatility: SIGNAL_WEIGHTS.BOLLINGER + SIGNAL_WEIGHTS.FIBONACCI_BOUNCE,
  volume: SIGNAL_WEIGHTS.OBV_DIRECTION + SIGNAL_WEIGHTS.VOLUME_SPIKE,
};

/** Base category weights. Correlated indicators live in the same category, so
 *  trend is no longer counted multiple times across EMA/MACD/ADX. */
export const CATEGORY_BASE_WEIGHTS: Record<CategoryKey, number> = {
  trend: 0.4,
  momentum: 0.3,
  volatility: 0.2,
  volume: 0.1,
};

/** Per-regime multipliers applied to the base category weights. Indicators
 *  perform differently per regime: trend tools dominate trends, oscillators
 *  dominate ranges, and momentum is de-emphasized in volatility expansion. */
export const REGIME_WEIGHT_MULTIPLIERS: Record<
  MarketRegime,
  Record<CategoryKey, number>
> = {
  trending: { trend: 1.5, momentum: 0.8, volatility: 0.8, volume: 1.0 },
  ranging: { trend: 0.5, momentum: 1.5, volatility: 1.5, volume: 1.0 },
  high_volatility: { trend: 1.0, momentum: 0.6, volatility: 1.2, volume: 1.0 },
  low_volatility: { trend: 1.0, momentum: 1.0, volatility: 1.0, volume: 1.0 },
};

/** |directionScore| at/above which a counter-trend signal is allowed through. */
export const DIRECTION_OVERRIDE_SCORE = 0.6;

export const TIER_THRESHOLDS = {
  A: 80,
  B: 60,
};

export const RISK_RULES = {
  LOW_MIN_CONFIDENCE: 75,
  MEDIUM_MIN_CONFIDENCE: 50,
};

/** Top-down market-context gating. Most alts are leveraged beta to BTC, so a
 *  setup that fights the BTC-led risk state is de-rated (not hidden). */
export const MARKET_CONTEXT = {
  /** |btcDirectionScore| at/above which BTC is decisively risk-on / risk-off. */
  RISK_SCORE_THRESHOLD: 0.3,
  /** Multiplier applied to directionScore & strength when a setup fights the
   *  prevailing market risk state. <1 = de-rate. */
  COUNTER_MARKET_DERATE: 0.6,
  /** Fear & Greed extremes that break a tie when BTC is indecisive. */
  EXTREME_FEAR: 25,
  EXTREME_GREED: 80,
};

/** Top-down IDX-context gating. Mirrors MARKET_CONTEXT with IHSG in BTC's
 *  seat: .JK stocks are beta to IHSG flow, so a setup that fights the
 *  IHSG-led risk state is de-rated (not hidden). */
export const IDX_CONTEXT = {
  /** |ihsgDirectionScore| at/above which IHSG is decisively risk-on/off. */
  RISK_SCORE_THRESHOLD: 0.3,
  /** Multiplier applied to directionScore & strength when a setup fights the
   *  prevailing IDX risk state. <1 = de-rate. */
  COUNTER_MARKET_DERATE: 0.6,
  /** |USDIDR ~1-week % change| that breaks the tie when IHSG is indecisive.
   *  + = rupiah weakening = foreign-outflow pressure (risk-off). The rupiah
   *  is ONLY a tiebreak; IHSG stays the primary driver. */
  RUPIAH_PRESSURE_1W_PCT: 1.0,
};

/** Accumulation/distribution flow scoring for equities (US & ID stocks).
 *  Derived from DAILY candles only — intraday Yahoo volume is patchy (lunch
 *  break / partial last bar on .JK), so daily is the only stable flow unit. */
export const ACCUMULATION = {
  /** Minimum daily candles for a meaningful flow read (~3 trading weeks). */
  MIN_DAILY_CANDLES: 15,
  /** Chaikin Money Flow period (industry standard). */
  CMF_PERIOD: 20,
  /** Money Flow Index period (industry standard). */
  MFI_PERIOD: 14,
  /** Volume z-score at/above which a day counts as a "spike" day. */
  VOLUME_Z_SPIKE: 2,
  /** Max share of zero-volume days tolerated before the whole read is
   *  refused (null) — same honesty rationale as ZERO_VOLUME_MAX_RATIO above. */
  ZERO_VOLUME_MAX_RATIO: 0.3,
  /** |score| at/above which the label reads accumulation/distribution. */
  SCORE_THRESHOLD: 0.25,
  /** |score| at/above which the label reads STRONG accumulation/distribution. */
  STRONG_THRESHOLD: 0.6,
  /** Max conviction multiplier from flow (±). Modest by design — flow nudges,
   *  never flips. Mirrors SMART_MONEY.MAX_CONVICTION_ADJ. */
  MAX_CONVICTION_ADJ: 0.15,
  /** Component weights (sum = 1). Full-window A/D flow dominates — it is the
   *  most direct "volume pushing price" read; spike bias is the noisiest, so it
   *  gets the least weight alongside the slower confirmations. */
  WEIGHTS: {
    adFlow: 0.3,
    cmf: 0.25,
    mfi: 0.15,
    upDownVolume: 0.15,
    spikeBias: 0.15,
  },
};

/** Backtest realism: costs applied to every entry & exit so expectancy isn't
 *  optimistic. Expressed as a fraction of price (per side). */
export const BACKTEST_COSTS = {
  crypto: { fee: 0.0004, slippage: 0.0006 },
  default: { fee: 0.0002, slippage: 0.0003 },
};

/** Crypto "smart money" (derivatives positioning). Funding/OI/long-short are
 *  CONTRARIAN at extremes — the crowded side is the one that gets squeezed. */
export const SMART_MONEY = {
  /** |OI change| over the window that counts as a meaningful build/unwind. */
  OI_DELTA_THRESHOLD: 0.03,
  /** Funding rate (per 8h) magnitude considered an overcrowding extreme. */
  FUNDING_EXTREME: 0.0005,
  /** Global long/short account ratio considered crowded (and its inverse). */
  LS_EXTREME: 2.0,
  /** Max conviction multiplier from positioning (±). Modest by design. */
  MAX_CONVICTION_ADJ: 0.15,
};
