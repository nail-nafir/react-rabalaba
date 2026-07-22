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

/** Top-down crypto-context gating. Most alts are leveraged beta to BTC, so a
 *  setup that fights the BTC-led risk state is de-rated (not hidden). */
export const CRYPTO_CONTEXT = {
  /** |btcDirectionScore| at/above which BTC is decisively risk-on / risk-off. */
  RISK_SCORE_THRESHOLD: 0.3,
  /** Multiplier applied to directionScore & strength when a setup fights the
   *  prevailing market risk state. <1 = de-rate. */
  COUNTER_MARKET_DERATE: 0.6,
};

/** Top-down IDX-context gating. Mirrors CRYPTO_CONTEXT with IHSG in BTC's
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

/** Top-down US-context gating. Mirrors IDX_CONTEXT with the S&P 500 in IHSG's
 *  seat: US stocks are beta to the index, so a setup that fights the S&P-led
 *  risk state is de-rated (not hidden). When the S&P is indecisive, VIX and the
 *  Dollar Index break the tie (both are ONLY tiebreaks; the S&P stays primary). */
export const US_CONTEXT = {
  /** |spxDirectionScore| at/above which the S&P 500 is decisively risk-on/off. */
  RISK_SCORE_THRESHOLD: 0.3,
  /** Multiplier applied to directionScore & strength when a setup fights the
   *  prevailing US risk state. <1 = de-rate. */
  COUNTER_MARKET_DERATE: 0.6,
  /** VIX spot level at/above which fear is elevated (risk-off lean). The classic
   *  "complacency below 20, fear above" line. */
  VIX_RISK_OFF_LEVEL: 20,
  /** VIX spot level at/below which complacency reigns (risk-on lean). */
  VIX_RISK_ON_LEVEL: 15,
  /** |VIX ~1-week % change| that confirms a fear move when the level is mid-range
   *  (+ = fear rising = risk-off). */
  VIX_PRESSURE_1W_PCT: 10.0,
  /** |DXY ~1-week % change| that breaks the tie (+ = USD strengthening =
   *  risk-off pressure for equities/risk assets). */
  DXY_PRESSURE_1W_PCT: 1.0,
};

/** Fundamentals + analyst overlay for stocks (us-stock & id-stock). Conservative
 *  by design: event-risk de-rate near earnings, a small analyst-consensus nudge,
 *  and valuation caution flags. Never flips a signal. */
export const FUNDAMENTALS = {
  /** Trading days BEFORE the next earnings date that count as the blackout
   *  window — event risk is high, so a directional call is de-rated + flagged. */
  EARNINGS_BLACKOUT_DAYS: 5,
  /** Multiplier applied to directionScore & strength inside the blackout. */
  EARNINGS_DERATE: 0.85,
  /** Max conviction multiplier from analyst consensus (±). Small — analysts lag
   *  price and are a soft confirmation, not a driver. */
  ANALYST_MAX_ADJ: 0.08,
  /** |analystScore| below this is treated as no consensus (no nudge). */
  ANALYST_MIN_SCORE: 0.2,
  /** Debt/equity (as Yahoo reports it, ~percent) above which a caution flag is
   *  raised on a LONG. Approximate — phrased as caution, not a hard rule. */
  HIGH_DEBT_TO_EQUITY: 200,
  /** Trailing P/E above which valuation is flagged rich on a LONG. */
  HIGH_TRAILING_PE: 60,
};

/** Relative strength vs the asset's own benchmark (id→IHSG, us→S&P, crypto→BTC).
 *  Excess return = asset window return − benchmark window return. A leader
 *  (outperforming in an aligned direction) gets a small conviction boost; a
 *  laggard gets dampened. Bounded and secondary — it never flips a signal. */
export const RELATIVE_STRENGTH = {
  /** |excess %| within this band over the chosen window reads as "inline"
   *  (no meaningful leadership either way). */
  INLINE_BAND_PCT: 1.0,
  /** Excess % that maps to a full-magnitude (±1) relative-strength score —
   *  beyond this the nudge saturates. */
  SCALE_PCT: 5.0,
  /** Max conviction multiplier from relative strength (±). Smaller than flow
   *  (ACCUMULATION/SMART_MONEY) because it's a secondary, slower read. */
  MAX_CONVICTION_ADJ: 0.1,
};

/** Auto-journal emission gate. The cron now enriches each candidate with its
 *  top-down context (BTC/IHSG/S&P) BEFORE emitting, so a call that fights its
 *  benchmark is de-rated first. This gate then decides whether such a
 *  counter-trend call is strong enough to still be journaled. */
export const JOURNAL_EMISSION = {
  /** When a journaled call fights its benchmark risk state, only emit it if its
   *  POST-context strength still clears this bar — i.e. the setup was strong
   *  enough that even after the de-rate it remains a high-conviction call.
   *  Counter-trend calls below this are skipped (don't trade against the index).
   *  Aligned calls and classes with no benchmark (commodity/forex) are
   *  unaffected. Tunable via `npm run gate:compare`. */
  COUNTER_TREND_MIN_STRENGTH: 60,
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
