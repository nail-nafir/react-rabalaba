import {
  calculateRSI,
  calculateEMA,
  calculateMACD,
  calculateSMA,
  calculatePivotLevels,
  calculateBollingerBands,
  calculateStochRSI,
  calculateDMI,
  calculateATR,
  calculateOBVTrend,
  calculateRSISeries,
  detectRSIDivergence,
  calculateFibLevels,
  classifyRegime,
  detectSwingLevels,
} from "./indicators";
import {
  generateSentimentAnalysis,
  fearGreedContextWarning,
} from "./sentiment";
import type {
  AssetType,
  SignalDirection,
  SignalTier,
  RiskLevel,
} from "@/types/asset";
import type { TrendDirection, MarketRegime } from "@/types/market";
import {
  SIGNAL_THRESHOLDS,
  SIGNAL_WEIGHTS,
  TIER_THRESHOLDS,
  RISK_RULES,
  REGIME_THRESHOLDS,
  CATEGORY_MAX_SCORE,
  CATEGORY_BASE_WEIGHTS,
  REGIME_WEIGHT_MULTIPLIERS,
  DIRECTION_OVERRIDE_SCORE,
} from "@/constants/signals";
import type { ObvTrend, RsiDivergence } from "@/constants/taxonomy/indicator";
import {
  TIMEFRAME_PRESETS,
  type TimeframePresetKey,
} from "@/constants/timeframes";

export interface SignalInput {
  prices: number[]; // historical close prices (oldest to newest)
  volumes: number[]; // historical volumes, aligned to prices when available
  highPrices: number[]; // historical high prices per candle
  lowPrices: number[]; // historical low prices per candle
  periodHigh: number; // period high
  periodLow: number; // period low
  fearGreedValue?: number; // 0-100
  assetType?: AssetType; // used for conservative volatility/risk thresholds
  timeframe?: TimeframePresetKey; // active signal profile; default is "swing"
  /** Higher-timeframe trend for multi-timeframe confirmation (Layer 2). When
   *  it agrees with the setup, conviction is boosted; when it conflicts, the
   *  direction score is downgraded to reduce whipsaw. */
  higherTimeframeTrend?: TrendDirection;
}

export interface SignalReasons {
  bullish: string[];
  bearish: string[];
  warnings: string[];
}

export interface SignalDataQuality {
  candleCount: number;
  ready: boolean;
  missingVolume: boolean;
  /** False when too many recent candles have zero/missing volume. When false,
   *  OBV and volume-spike confirmation are disabled to avoid noise. */
  volumeReliable: boolean;
}

export interface Outlook {
  signal: SignalDirection;
  /** Technical alignment strength 0-100. NOT a probability of profit. */
  strength: number;
  /** Qualitative label for strength. */
  technicalAlignment: "strong" | "moderate" | "weak";
  tier: SignalTier;
  /** True when a directional lean (long/short) was forced back to NEUTRAL by the
   *  chop/no-trade filter or the counter-trend guard. `strength`/`tier` still
   *  reflect the underlying directional conviction, so the UI can explain
   *  "strong lean, but held back by market conditions" instead of showing a
   *  confusing high-tier NEUTRAL with no context. */
  suppressed: boolean;
  risk: RiskLevel;
  trend: TrendDirection;
  regime: MarketRegime;
  /** Higher-timeframe trend used for confirmation (Layer 2). */
  higherTimeframeTrend: TrendDirection;
  /** Net regime-weighted alignment in [-1..1]. Sign = direction, magnitude =
   *  conviction. NOT a probability of profit. */
  directionScore: number;
  /** Per-category alignment in [-1..1] (de-correlated indicator groups). */
  categoryScores: {
    trend: number;
    momentum: number;
    volatility: number;
    volume: number;
  };
  reasons: SignalReasons;
  dataQuality: SignalDataQuality;
  indicators: {
    rsi: number;
    ema20: number;
    ema50: number;
    ema200: number;
    macd: { macdLine: number; signalLine: number; histogram: number };
    volumeMA: number;
    volumeSpike: boolean;
    support: number;
    resistance: number;
    recentSwingHigh: number;
    recentSwingLow: number;
    bollingerBands: {
      upper: number;
      middle: number;
      lower: number;
      percentB: number;
    };
    stochRSI: number;
    adx: number;
    plusDI: number;
    minusDI: number;
    atr: number;
    obvTrend: ObvTrend;
    rsiDivergence: RsiDivergence;
    fibLevels: { 0.382: number; 0.5: number; 0.618: number };
  };
  analysis: {
    trend: string;
    volume: string;
    momentum: string;
    sentiment: string;
  };
}

const EMPTY_MACD = { macdLine: 0, signalLine: 0, histogram: 0 };
const EMPTY_BOLLINGER = { upper: 0, middle: 0, lower: 0, percentB: 0.5 };
const EMPTY_FIB_LEVELS = { 0.382: 0, 0.5: 0, 0.618: 0 };

/**
 * Rule-based decision-support engine — a 5-layer pipeline, not a flat indicator
 * vote. Correlated indicators are grouped into categories so trend is not
 * counted multiple times across EMA/MACD/ADX.
 *
 * Pipeline:
 * - Volume gate     → disable OBV/spike when volume data is unreliable
 * - Layer 1 Regime  → trending / ranging / high_volatility / low_volatility
 * - Chop filter     → force NEUTRAL in a low-volatility squeeze
 * - Layer 2 Bias    → EMA + DMI direction
 * - Layer 3 Momentum→ MACD / RSI / StochRSI / OBV / divergence
 * - Layer 4 Risk    → ATR / volatility context
 * - Layer 5 Score   → category scores [-1..1] × regime weights → directionScore
 *
 * Categories (each normalized to [-1..1]):
 * - TREND      = EMA + MACD + ADX
 * - MOMENTUM   = RSI + StochRSI + RSI divergence
 * - VOLATILITY = Bollinger + Fibonacci
 * - VOLUME     = OBV + volume spike (dropped when unreliable; weights renormalize)
 *
 * directionScore ∈ [-1..1]; |directionScore| ≥ profile.directionThreshold emits
 * LONG/SHORT. strength = round(|directionScore| × 100) — pure technical
 * alignment, NOT a probability of profit (historical win-rate is reported
 * separately by the backtester).
 *
 * The engine is a screener, not an execution system. It stays neutral when data
 * quality is poor because false precision is more dangerous than a missed setup.
 */
export function computeSignal(input: SignalInput): Outlook {
  const {
    prices,
    volumes,
    highPrices,
    lowPrices,
    periodHigh,
    periodLow,
    fearGreedValue,
    assetType,
    timeframe = "swing",
    higherTimeframeTrend = "sideways",
  } = input;

  const close = prices[prices.length - 1];
  if (!Number.isFinite(close)) {
    return createUnavailableSignal(fearGreedValue);
  }

  const profile = TIMEFRAME_PRESETS[timeframe].signalProfile;
  const candleCount = Math.min(
    prices.length,
    highPrices.length,
    lowPrices.length,
  );
  const hasVolumeData = volumes.some((v) => v > 0);

  // Volume reliability: crypto feeds often return volume:0, which fakes spikes
  // and corrupts OBV. Measure the zero-volume share over a recent window and
  // disable volume confirmation when it is too high.
  const volumeWindow = volumes.slice(
    -Math.min(volumes.length, SIGNAL_THRESHOLDS.VOLUME_RELIABILITY_WINDOW),
  );
  const zeroVolumeRatio =
    volumeWindow.length > 0
      ? volumeWindow.filter((v) => !(v > 0)).length / volumeWindow.length
      : 1;
  const volumeReliable =
    hasVolumeData && zeroVolumeRatio <= SIGNAL_THRESHOLDS.ZERO_VOLUME_MAX_RATIO;

  const dataQuality: SignalDataQuality = {
    candleCount,
    ready: candleCount >= profile.minCandles,
    missingVolume: !hasVolumeData,
    volumeReliable,
  };

  const reasons: SignalReasons = {
    bullish: [],
    bearish: [],
    warnings: [],
  };

  if (!dataQuality.ready) {
    reasons.warnings.push(
      `Only ${candleCount} complete candles available; conservative engine requires ${profile.minCandles} for actionable signals.`,
    );
  }
  if (!hasVolumeData) {
    reasons.warnings.push(
      "Volume data unavailable; volume confirmation and OBV are disabled.",
    );
  } else if (!volumeReliable) {
    reasons.warnings.push(
      `Volume data unreliable (${Math.round(zeroVolumeRatio * 100)}% of recent candles report zero volume); OBV and volume-spike confirmation are disabled.`,
    );
  }

  // ─── Calculate core indicators ───────────────────────────
  const rsi = calculateRSI(prices);
  const ema20 = calculateEMA(prices, 20);
  const ema50 = calculateEMA(prices, 50);
  const ema200 = calculateEMA(prices, 200);
  const macd = calculateMACD(prices);

  // Volume analysis (skip when volume data is missing or unreliable)
  const volumeMA = volumeReliable ? calculateSMA(volumes, 20) : 0;
  const currentVolume = volumes[volumes.length - 1] ?? 0;
  const volumeSpike =
    volumeReliable &&
    volumeMA > 0 &&
    currentVolume > volumeMA * SIGNAL_THRESHOLDS.VOLUME_SPIKE_MULTIPLIER;

  const safePeriodHigh = Number.isFinite(periodHigh)
    ? periodHigh
    : Math.max(...prices.slice(-20), close);
  const safePeriodLow = Number.isFinite(periodLow)
    ? periodLow
    : Math.min(...prices.slice(-20), close);
  const { support, resistance } = calculatePivotLevels(
    safePeriodHigh,
    safePeriodLow,
    close,
  );

  // Structure-based swing levels (fractal pivots) for adaptive SL/TP.
  const { swingHigh: recentSwingHigh, swingLow: recentSwingLow } =
    detectSwingLevels(highPrices, lowPrices);

  // ─── Calculate pro indicators ────────────────────────────
  const bollingerBands = calculateBollingerBands(
    prices,
    SIGNAL_THRESHOLDS.BOLLINGER_PERIOD,
    SIGNAL_THRESHOLDS.BOLLINGER_STD_DEV,
  );
  const stochRSI = calculateStochRSI(prices);

  // ADX is strength only. DMI gives the directional bias (+DI vs -DI).
  const dmi = calculateDMI(highPrices, lowPrices, prices);
  const adx = dmi.adx;
  const atr = calculateATR(highPrices, lowPrices, prices);
  const obvTrend = volumeReliable
    ? calculateOBVTrend(prices, volumes)
    : ("flat" as const);

  const rsiSeries = calculateRSISeries(prices);
  const rsiDivergence = detectRSIDivergence(prices, rsiSeries);

  // ─── Layer 1: Market regime ──────────────────────────────
  const atrPercent = close > 0 ? (atr / close) * 100 : 0;
  const bbBandwidthPercent =
    bollingerBands.middle > 0
      ? ((bollingerBands.upper - bollingerBands.lower) / bollingerBands.middle) *
        100
      : 0;
  const regime = classifyRegime({
    adx,
    atrPercent,
    bbBandwidthPercent,
    strongAdx: SIGNAL_THRESHOLDS.ADX_STRONG_TREND,
    highVolAtrPercent: getAtrRiskThresholds(assetType).high,
    squeezeBandwidthPercent: REGIME_THRESHOLDS.SQUEEZE_BANDWIDTH_PERCENT,
    squeezeMaxAdx: REGIME_THRESHOLDS.SQUEEZE_MAX_ADX,
  });

  // Fibonacci Retracement (using a 50-period window for key swing points)
  const fibWindow = prices.slice(-50);
  const fibHigh = Math.max(...fibWindow);
  const fibLow = Math.min(...fibWindow);

  // ─── Determine trend early (needed for context scoring) ────
  const emaBullish = close > ema20 && ema20 > ema50;
  const emaBearish = close < ema20 && ema20 < ema50;
  const dmiBullish = dmi.plusDI > dmi.minusDI;
  const dmiBearish = dmi.minusDI > dmi.plusDI;

  let trend: TrendDirection;
  if (adx < SIGNAL_THRESHOLDS.ADX_WEAK_TREND) {
    trend = "sideways";
  } else if (emaBullish && dmiBullish) {
    trend = "bullish";
  } else if (emaBearish && dmiBearish) {
    trend = "bearish";
  } else {
    trend = "sideways";
    if (adx > SIGNAL_THRESHOLDS.ADX_STRONG_TREND) {
      reasons.warnings.push(
        `ADX is strong at ${adx.toFixed(1)}, but EMA and DMI direction do not agree.`,
      );
    }
  }

  const fibDirection = trend === "bearish" ? "bearish" : "bullish";
  const fibLevels = calculateDirectionalFibLevels(
    fibHigh,
    fibLow,
    fibDirection,
  );

  // ─── Category score accumulation (raw, signed) ───────────
  // Each indicator contributes to exactly ONE category. Correlated indicators
  // (EMA/MACD/ADX all measure trend) therefore cannot inflate conviction by
  // being counted multiple times — they are normalized within their category.
  let trendRaw = 0;
  let momentumRaw = 0;
  let volatilityRaw = 0;
  let volumeRaw = 0;

  // 1. EMA Alignment (weight: 1.5)
  if (emaBullish) {
    trendRaw += SIGNAL_WEIGHTS.EMA_ALIGNMENT;
    reasons.bullish.push(
      "Price above EMA20 > EMA50 (strong bullish alignment)",
    );
  } else if (emaBearish) {
    trendRaw -= SIGNAL_WEIGHTS.EMA_ALIGNMENT;
    reasons.bearish.push(
      "Price below EMA20 < EMA50 (strong bearish alignment)",
    );
  } else if (close > ema20 && ema20 < ema50) {
    trendRaw += SIGNAL_WEIGHTS.EMA_ALIGNMENT * 0.33;
    reasons.bullish.push("Price above EMA20 but below EMA50 (early recovery)");
  } else if (close < ema20 && ema20 > ema50) {
    trendRaw -= SIGNAL_WEIGHTS.EMA_ALIGNMENT * 0.33;
    reasons.bearish.push("Price below EMA20 but above EMA50 (early weakness)");
  }

  // 2. MACD (weight: 1.0)
  if (macd.histogram > 0 && macd.macdLine > macd.signalLine) {
    trendRaw += SIGNAL_WEIGHTS.MACD;
    reasons.bullish.push("MACD bullish (histogram positive, MACD > signal)");
  } else if (macd.histogram < 0 && macd.macdLine < macd.signalLine) {
    trendRaw -= SIGNAL_WEIGHTS.MACD;
    reasons.bearish.push("MACD bearish (histogram negative, MACD < signal)");
  }

  // 3. RSI (weight: 1.0)
  // RSI is context-sensitive: overbought in a strong uptrend is not a short
  // signal by itself, and oversold in a strong downtrend is not a blind buy.
  if (rsi < SIGNAL_THRESHOLDS.RSI_OVERSOLD) {
    if (emaBearish && adx > SIGNAL_THRESHOLDS.ADX_STRONG_TREND) {
      momentumRaw -= SIGNAL_WEIGHTS.RSI * 0.5;
      reasons.bearish.push(
        `RSI oversold at ${rsi.toFixed(1)} in strong downtrend — bearish continuation risk`,
      );
    } else {
      momentumRaw += SIGNAL_WEIGHTS.RSI;
      reasons.bullish.push(
        `RSI oversold at ${rsi.toFixed(1)} — potential reversal zone`,
      );
    }
  } else if (rsi > SIGNAL_THRESHOLDS.RSI_OVERBOUGHT) {
    if (emaBullish && adx > SIGNAL_THRESHOLDS.ADX_STRONG_TREND) {
      momentumRaw += SIGNAL_WEIGHTS.RSI * 0.25;
      reasons.bullish.push(
        `RSI elevated at ${rsi.toFixed(1)} in strong uptrend — momentum can stay extended`,
      );
    } else {
      momentumRaw -= SIGNAL_WEIGHTS.RSI;
      reasons.bearish.push(
        `RSI overbought at ${rsi.toFixed(1)} — overextended`,
      );
    }
  }

  // 4. ADX Trend Strength (weight: 1.0)
  if (adx > SIGNAL_THRESHOLDS.ADX_STRONG_TREND) {
    if (trend === "bullish") {
      trendRaw += SIGNAL_WEIGHTS.ADX_TREND;
      reasons.bullish.push(
        `ADX at ${adx.toFixed(1)} with +DI above -DI confirms strong bullish trend`,
      );
    } else if (trend === "bearish") {
      trendRaw -= SIGNAL_WEIGHTS.ADX_TREND;
      reasons.bearish.push(
        `ADX at ${adx.toFixed(1)} with -DI above +DI confirms strong bearish trend`,
      );
    }
  }

  // 5. Volume Spike (weight: 0.75)
  // Volume spike follows the latest candle direction instead of blindly
  // amplifying whatever the current score already says.
  if (volumeReliable && volumeSpike) {
    const previousClose = prices[prices.length - 2] ?? close;
    const volumeRatio = currentVolume / volumeMA;

    if (close > previousClose) {
      volumeRaw += SIGNAL_WEIGHTS.VOLUME_SPIKE;
      reasons.bullish.push(
        `Volume spike (${volumeRatio.toFixed(1)}x avg) confirms buying pressure`,
      );
    } else if (close < previousClose) {
      volumeRaw -= SIGNAL_WEIGHTS.VOLUME_SPIKE;
      reasons.bearish.push(
        `Volume spike (${volumeRatio.toFixed(1)}x avg) confirms sell pressure`,
      );
    } else {
      reasons.warnings.push(
        `Volume spike (${volumeRatio.toFixed(1)}x avg) detected, but latest candle closed flat.`,
      );
    }
  }

  // 6. Bollinger Bands (weight: 0.75)
  if (trend === "bullish" || trend === "bearish") {
    if (bollingerBands.percentB > 0.8 && trend === "bullish") {
      volatilityRaw += SIGNAL_WEIGHTS.BOLLINGER * 0.5;
      reasons.bullish.push(
        `Price riding upper Bollinger Band in strong trend (%B: ${(bollingerBands.percentB * 100).toFixed(0)}%) — trend strength`,
      );
    } else if (bollingerBands.percentB < 0.2 && trend === "bearish") {
      volatilityRaw -= SIGNAL_WEIGHTS.BOLLINGER * 0.5;
      reasons.bearish.push(
        `Price riding lower Bollinger Band in strong trend (%B: ${(bollingerBands.percentB * 100).toFixed(0)}%) — trend strength`,
      );
    }
  } else {
    if (bollingerBands.percentB < 0) {
      volatilityRaw += SIGNAL_WEIGHTS.BOLLINGER;
      reasons.bullish.push(
        `Price below lower Bollinger Band (%B: ${(bollingerBands.percentB * 100).toFixed(0)}%) — oversold in range`,
      );
    } else if (bollingerBands.percentB > 1) {
      volatilityRaw -= SIGNAL_WEIGHTS.BOLLINGER;
      reasons.bearish.push(
        `Price above upper Bollinger Band (%B: ${(bollingerBands.percentB * 100).toFixed(0)}%) — overbought in range`,
      );
    } else if (bollingerBands.percentB < 0.2) {
      volatilityRaw += SIGNAL_WEIGHTS.BOLLINGER * 0.5;
      reasons.bullish.push(
        `Price near lower Bollinger Band (%B: ${(bollingerBands.percentB * 100).toFixed(0)}%)`,
      );
    } else if (bollingerBands.percentB > 0.8) {
      volatilityRaw -= SIGNAL_WEIGHTS.BOLLINGER * 0.5;
      reasons.bearish.push(
        `Price near upper Bollinger Band (%B: ${(bollingerBands.percentB * 100).toFixed(0)}%)`,
      );
    }
  }

  // 7. Stochastic RSI (weight: 0.5)
  if (stochRSI < SIGNAL_THRESHOLDS.STOCH_RSI_OVERSOLD) {
    if (trend === "bearish") {
      momentumRaw -= SIGNAL_WEIGHTS.STOCH_RSI * 0.5;
      reasons.bearish.push(
        `StochRSI oversold at ${stochRSI.toFixed(1)} inside bearish trend — avoid early bottom-picking`,
      );
    } else {
      momentumRaw += SIGNAL_WEIGHTS.STOCH_RSI;
      reasons.bullish.push(
        `StochRSI oversold at ${stochRSI.toFixed(1)} — momentum reversal zone`,
      );
    }
  } else if (stochRSI > SIGNAL_THRESHOLDS.STOCH_RSI_OVERBOUGHT) {
    if (trend === "bullish") {
      momentumRaw += SIGNAL_WEIGHTS.STOCH_RSI * 0.5;
      reasons.bullish.push(
        `StochRSI overbought at ${stochRSI.toFixed(1)} inside bullish trend — momentum remains extended`,
      );
    } else {
      momentumRaw -= SIGNAL_WEIGHTS.STOCH_RSI;
      reasons.bearish.push(
        `StochRSI overbought at ${stochRSI.toFixed(1)} — momentum exhaustion`,
      );
    }
  }

  // 8. OBV Direction (weight: 0.5)
  // Score OBV independently from accumulated score to avoid circular
  // confirmation bias. Use candle direction + EMA context instead.
  if (volumeReliable) {
    const latestCandleUp = close > (prices[prices.length - 2] ?? close);
    const latestCandleDown = close < (prices[prices.length - 2] ?? close);

    if (obvTrend === "rising" && (latestCandleUp || emaBullish)) {
      volumeRaw += SIGNAL_WEIGHTS.OBV_DIRECTION;
      reasons.bullish.push(
        "OBV rising — volume confirms upward price movement",
      );
    } else if (obvTrend === "falling" && (latestCandleDown || emaBearish)) {
      volumeRaw -= SIGNAL_WEIGHTS.OBV_DIRECTION;
      reasons.bearish.push(
        "OBV falling — volume confirms downward price movement",
      );
    } else if (obvTrend === "rising" && (latestCandleDown || emaBearish)) {
      volumeRaw += SIGNAL_WEIGHTS.OBV_DIRECTION * 0.5;
      reasons.bullish.push(
        "OBV divergence — volume rising against price decline (potential reversal)",
      );
    } else if (obvTrend === "falling" && (latestCandleUp || emaBullish)) {
      volumeRaw -= SIGNAL_WEIGHTS.OBV_DIRECTION * 0.5;
      reasons.bearish.push(
        "OBV divergence — volume declining against price rise (weakening conviction)",
      );
    }
  }

  // 9. RSI Divergence (weight: 1.0)
  // Divergence AGAINST the trend is a high-value reversal signal and gets
  // full weight. Divergence WITH the trend is mere confirmation and gets
  // reduced weight — it tells you less than the other indicators already do.
  if (rsiDivergence === "bullish") {
    const weight =
      trend === "bullish"
        ? SIGNAL_WEIGHTS.RSI_DIVERGENCE * 0.75
        : SIGNAL_WEIGHTS.RSI_DIVERGENCE;
    momentumRaw += weight;
    reasons.bullish.push(
      "Bullish RSI Divergence detected — reversal signal, but still requires risk control",
    );
  } else if (rsiDivergence === "bearish") {
    const weight =
      trend === "bearish"
        ? SIGNAL_WEIGHTS.RSI_DIVERGENCE * 0.75
        : SIGNAL_WEIGHTS.RSI_DIVERGENCE;
    momentumRaw -= weight;
    reasons.bearish.push(
      "Bearish RSI Divergence detected — exhaustion signal, but still requires confirmation",
    );
  }

  // 10. Fibonacci Retracement (weight: 1.0)
  // Dynamic tolerance based on ATR — adapts to low-price altcoins and high-price assets
  const fibTolerance =
    atr > 0 && close > 0
      ? Math.max(0.003, Math.min(0.01, (atr / close) * 0.5))
      : 0.005;
  const isNearGoldenPocket = isNearLevel(close, fibLevels[0.618], fibTolerance);

  if (isNearGoldenPocket) {
    if (trend === "bullish") {
      volatilityRaw += SIGNAL_WEIGHTS.FIBONACCI_BOUNCE;
      reasons.bullish.push(
        `Price holding directional 0.618 Fibonacci Golden Pocket ($${fibLevels[0.618].toFixed(2)})`,
      );
    } else if (trend === "bearish") {
      volatilityRaw -= SIGNAL_WEIGHTS.FIBONACCI_BOUNCE;
      reasons.bearish.push(
        `Price rejected at directional 0.618 Fibonacci level ($${fibLevels[0.618].toFixed(2)})`,
      );
    }
  }

  // ─── Layer 5: Category scores → regime-weighted direction ─
  const categoryScores = {
    trend: clampUnit(trendRaw / CATEGORY_MAX_SCORE.trend),
    momentum: clampUnit(momentumRaw / CATEGORY_MAX_SCORE.momentum),
    volatility: clampUnit(volatilityRaw / CATEGORY_MAX_SCORE.volatility),
    volume: clampUnit(volumeRaw / CATEGORY_MAX_SCORE.volume),
  };
  let directionScore = combineDirectionScore(
    categoryScores,
    regime,
    dataQuality.volumeReliable,
  );

  // ─── Layer 2: Higher-timeframe confirmation ──────────────
  // Professional entries rarely fight the higher timeframe. Boost conviction
  // when HTF agrees, downgrade (halve) when it conflicts to cut whipsaw.
  if (higherTimeframeTrend !== "sideways" && directionScore !== 0) {
    const htfSign = higherTimeframeTrend === "bullish" ? 1 : -1;
    const agrees = Math.sign(directionScore) === htfSign;
    if (agrees) {
      (directionScore > 0 ? reasons.bullish : reasons.bearish).push(
        `Higher-timeframe trend is ${higherTimeframeTrend} and aligns with this setup — conviction boosted.`,
      );
      directionScore = clampUnit(directionScore * 1.15);
    } else {
      reasons.warnings.push(
        `Higher-timeframe trend is ${higherTimeframeTrend}, conflicting with the lower-timeframe setup — conviction downgraded.`,
      );
      directionScore = directionScore * 0.5;
    }
  }

  // 11. Bollinger Band Squeeze Detection (warning only, no scoring)
  // Bandwidth contraction often precedes a significant price move.
  if (bbBandwidthPercent < 3 && bbBandwidthPercent > 0) {
    reasons.warnings.push(
      `Bollinger Band Squeeze (bandwidth ${bbBandwidthPercent.toFixed(1)}%) — volatility contraction, big move likely incoming.`,
    );
  }

  // 12. Fear & Greed Sentiment Context (warning only)
  // Not scored because the index is lagging and crypto-heavy, but extreme
  // readings are surfaced so users have the context for risk management.
  // Delegated to the sentiment engine (see ./sentiment).
  const sentimentWarning = fearGreedContextWarning(
    fearGreedValue,
    directionScore,
  );
  if (sentimentWarning) {
    reasons.warnings.push(sentimentWarning);
  }

  // ─── Determine signal ────────────────────────────────────
  let signal: SignalDirection;
  if (dataQuality.ready && directionScore >= profile.directionThreshold) {
    signal = "long";
  } else if (dataQuality.ready && directionScore <= -profile.directionThreshold) {
    signal = "short";
  } else {
    signal = "neutral";
  }

  // Tracks whether a real directional lean was forced back to NEUTRAL below
  // (counter-trend guard or chop filter). When true, strength/tier still carry
  // the underlying conviction, so the UI can label it as "held back".
  let suppressed = false;

  // Countertrend trades are allowed when a real divergence override exists
  // OR when the regime-weighted direction score is exceptionally strong,
  // indicating multiple independent categories agree on the reversal.
  const isCounterTrend =
    (signal === "long" && trend === "bearish") ||
    (signal === "short" && trend === "bullish");
  const hasDivergenceOverride =
    (signal === "long" && rsiDivergence === "bullish") ||
    (signal === "short" && rsiDivergence === "bearish");
  const hasStrongScoreOverride =
    Math.abs(directionScore) >= DIRECTION_OVERRIDE_SCORE;

  if (isCounterTrend && !hasDivergenceOverride && !hasStrongScoreOverride) {
    reasons.warnings.push(
      "Raw score crossed the threshold, but trend regime disagrees; signal forced back to NEUTRAL.",
    );
    signal = "neutral";
    suppressed = true;
  }

  // ─── Chop / no-trade filter ──────────────────────────────
  // Low-volatility squeeze (weak ADX + tight Bollinger bands) is a pre-breakout
  // state with no edge. Professional trading is mostly NOT trading — suppress
  // directional signals here to avoid whipsaw, the main retail killer.
  if (regime === "low_volatility") {
    if (signal !== "neutral") {
      reasons.warnings.push(
        "Chop/no-trade filter: low-volatility squeeze (weak ADX, tight Bollinger bands) — directional signal suppressed to NEUTRAL.",
      );
      signal = "neutral";
      suppressed = true;
    } else {
      reasons.warnings.push(
        "Chop/no-trade filter active: low-volatility squeeze — staying flat until volatility expands.",
      );
    }
  }

  // ─── Signal strength = pure technical alignment (0-100) ───
  // This is NOT a probability of profit. It only measures how strongly the
  // regime-weighted indicator categories agree on a direction. Historical
  // win-rate is reported separately by the backtester.
  const rawStrength = Math.round(Math.abs(directionScore) * 100);
  const dataPenalty = dataQuality.ready ? 0 : 20;
  const strength = Math.min(
    dataQuality.ready ? 100 : 25,
    Math.max(0, rawStrength - dataPenalty),
  );
  const technicalAlignment: "strong" | "moderate" | "weak" =
    strength >= TIER_THRESHOLDS.A
      ? "strong"
      : strength >= TIER_THRESHOLDS.B
        ? "moderate"
        : "weak";

  // ─── Tier ────────────────────────────────────────────────
  let tier: SignalTier;
  if (strength >= TIER_THRESHOLDS.A) tier = "A";
  else if (strength >= TIER_THRESHOLDS.B) tier = "B";
  else tier = "C";

  // ─── Risk ────────────────────────────────────────────────
  const risk = calculateRisk({
    signal,
    confidence: strength,
    volumeSpike,
    hasVolumeData: volumeReliable,
    dataReady: dataQuality.ready,
    atr,
    close,
    assetType,
    isCounterTrend,
  });

  // ─── Generate analysis text ──────────────────────────────
  const analysis = {
    trend: generateTrendAnalysis(
      close,
      ema20,
      ema50,
      trend,
      adx,
      dmi.plusDI,
      dmi.minusDI,
      dataQuality,
    ),
    volume: generateVolumeAnalysis(
      currentVolume,
      volumeMA,
      volumeSpike,
      obvTrend,
      volumeReliable,
    ),
    momentum: generateMomentumAnalysis(
      rsi,
      macd,
      stochRSI,
      bollingerBands,
      rsiDivergence,
    ),
    sentiment: generateSentimentAnalysis(fearGreedValue),
  };

  return {
    signal,
    strength,
    technicalAlignment,
    tier,
    suppressed,
    risk,
    trend,
    regime,
    higherTimeframeTrend,
    directionScore,
    categoryScores,
    reasons,
    dataQuality,
    indicators: {
      rsi,
      ema20,
      ema50,
      ema200,
      macd,
      volumeMA,
      volumeSpike,
      support,
      resistance,
      recentSwingHigh,
      recentSwingLow,
      bollingerBands,
      stochRSI,
      adx,
      plusDI: dmi.plusDI,
      minusDI: dmi.minusDI,
      atr,
      obvTrend,
      rsiDivergence,
      fibLevels,
    },
    analysis,
  };
}

export function createUnavailableSignal(fearGreedValue?: number): Outlook {
  const reasons: SignalReasons = {
    bullish: [],
    bearish: [],
    warnings: ["No valid close price data available."],
  };

  return {
    signal: "neutral",
    strength: 0,
    technicalAlignment: "weak",
    tier: "C",
    suppressed: false,
    risk: "high",
    trend: "sideways",
    regime: "ranging",
    higherTimeframeTrend: "sideways",
    directionScore: 0,
    categoryScores: { trend: 0, momentum: 0, volatility: 0, volume: 0 },
    reasons,
    dataQuality: { candleCount: 0, ready: false, missingVolume: true, volumeReliable: false },
    indicators: {
      rsi: 50,
      ema20: 0,
      ema50: 0,
      ema200: 0,
      macd: EMPTY_MACD,
      volumeMA: 0,
      volumeSpike: false,
      support: 0,
      resistance: 0,
      recentSwingHigh: 0,
      recentSwingLow: 0,
      bollingerBands: EMPTY_BOLLINGER,
      stochRSI: 50,
      adx: 0,
      plusDI: 0,
      minusDI: 0,
      atr: 0,
      obvTrend: "flat",
      rsiDivergence: "none",
      fibLevels: EMPTY_FIB_LEVELS,
    },
    analysis: {
      trend: "No valid price data available. Signal stays neutral.",
      volume:
        "Volume data not available for this asset. Signal based on price action and momentum only.",
      momentum: "Momentum cannot be evaluated without valid price history.",
      sentiment: generateSentimentAnalysis(fearGreedValue),
    },
  };
}

function calculateDirectionalFibLevels(
  high: number,
  low: number,
  direction: "bullish" | "bearish",
): { 0.382: number; 0.5: number; 0.618: number } {
  if (!Number.isFinite(high) || !Number.isFinite(low) || high <= low) {
    return EMPTY_FIB_LEVELS;
  }

  const levels = calculateFibLevels(high, low);

  if (direction === "bullish") {
    // In an uptrend, retracement is measured down from the swing high.
    return {
      0.382: levels[0.618],
      0.5: levels[0.5],
      0.618: levels[0.382],
    };
  }

  // In a downtrend, retracement is measured up from the swing low.
  return {
    0.382: levels[0.382],
    0.5: levels[0.5],
    0.618: levels[0.618],
  };
}

function isNearLevel(price: number, level: number, tolerance: number): boolean {
  return level > 0 && Math.abs(price - level) / level < tolerance;
}

/** Clamp a normalized value into the [-1, 1] unit range. */
function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

/**
 * Combine per-category alignment into a single regime-weighted direction score
 * in [-1, 1]. When volume is unreliable its weight is dropped and the remaining
 * categories are renormalized (the divisor is the sum of active weights).
 */
function combineDirectionScore(
  categoryScores: {
    trend: number;
    momentum: number;
    volatility: number;
    volume: number;
  },
  regime: MarketRegime,
  volumeReliable: boolean,
): number {
  const mult = REGIME_WEIGHT_MULTIPLIERS[regime];
  const weights = {
    trend: CATEGORY_BASE_WEIGHTS.trend * mult.trend,
    momentum: CATEGORY_BASE_WEIGHTS.momentum * mult.momentum,
    volatility: CATEGORY_BASE_WEIGHTS.volatility * mult.volatility,
    volume: volumeReliable ? CATEGORY_BASE_WEIGHTS.volume * mult.volume : 0,
  };
  const totalWeight =
    weights.trend + weights.momentum + weights.volatility + weights.volume;
  if (totalWeight === 0) return 0;

  const weighted =
    categoryScores.trend * weights.trend +
    categoryScores.momentum * weights.momentum +
    categoryScores.volatility * weights.volatility +
    categoryScores.volume * weights.volume;
  return clampUnit(weighted / totalWeight);
}

function calculateRisk({
  signal,
  confidence,
  volumeSpike,
  hasVolumeData,
  dataReady,
  atr,
  close,
  assetType,
  isCounterTrend,
}: {
  signal: SignalDirection;
  confidence: number;
  volumeSpike: boolean;
  hasVolumeData: boolean;
  dataReady: boolean;
  atr: number;
  close: number;
  assetType?: AssetType;
  isCounterTrend: boolean;
}): RiskLevel {
  const atrPercent = close > 0 ? (atr / close) * 100 : 0;
  const atrRisk = getAtrRiskThresholds(assetType);

  let riskScore = 0;

  if (!dataReady) riskScore += 2;
  if (signal === "neutral") riskScore += 1;
  if (!hasVolumeData) riskScore += 1;
  if (isCounterTrend) riskScore += 2;
  if (confidence < RISK_RULES.MEDIUM_MIN_CONFIDENCE) riskScore += 2;
  else if (confidence < RISK_RULES.LOW_MIN_CONFIDENCE) riskScore += 1;

  if (atrPercent >= atrRisk.high) riskScore += 2;
  else if (atrPercent >= atrRisk.medium) riskScore += 1;

  if (hasVolumeData && signal !== "neutral" && !volumeSpike) riskScore += 1;

  if (riskScore <= 1 && confidence >= RISK_RULES.LOW_MIN_CONFIDENCE) {
    return "low";
  }
  if (riskScore <= 3 && confidence >= RISK_RULES.MEDIUM_MIN_CONFIDENCE) {
    return "medium";
  }
  return "high";
}

function getAtrRiskThresholds(assetType?: AssetType): {
  medium: number;
  high: number;
} {
  if (assetType === "crypto") return { medium: 2.5, high: 5 };
  if (assetType === "commodity") return { medium: 1.8, high: 3.5 };
  return { medium: 1.2, high: 2.5 };
}

function generateTrendAnalysis(
  close: number,
  ema20: number,
  ema50: number,
  trend: TrendDirection,
  adx: number,
  plusDI: number,
  minusDI: number,
  dataQuality: SignalDataQuality,
): string {
  const adxStrength =
    adx > 25 ? "strong" : adx > 20 ? "developing" : "weak/absent";
  const readinessText = dataQuality.ready
    ? ""
    : " Data sample is not deep enough for trade-grade conviction, so the engine stays conservative.";

  if (trend === "bullish") {
    return `Price is trading above EMA20 ($${ema20.toFixed(2)}) and EMA50 ($${ema50.toFixed(2)}) with both EMAs in bullish alignment. ADX at ${adx.toFixed(1)} indicates ${adxStrength} trend strength, and +DI (${plusDI.toFixed(1)}) is above -DI (${minusDI.toFixed(1)}). The trend structure supports upside continuation.${readinessText}`;
  } else if (trend === "bearish") {
    return `Price is trading below EMA20 ($${ema20.toFixed(2)}) and EMA50 ($${ema50.toFixed(2)}) with both EMAs in bearish alignment. ADX at ${adx.toFixed(1)} indicates ${adxStrength} trend strength, and -DI (${minusDI.toFixed(1)}) is above +DI (${plusDI.toFixed(1)}). The trend structure favors further downside.${readinessText}`;
  }
  return `Price at $${close.toFixed(2)} does not have confirmed EMA/DMI directional agreement. EMA20 is $${ema20.toFixed(2)}, EMA50 is $${ema50.toFixed(2)}, and ADX at ${adx.toFixed(1)} indicates ${adxStrength} trend strength. Market is likely ranging or transitional.${readinessText}`;
}

function generateVolumeAnalysis(
  current: number,
  ma: number,
  spike: boolean,
  obvTrend: ObvTrend,
  volumeReliable: boolean,
): string {
  if (!volumeReliable) {
    return "Volume data is missing or unreliable for this asset (frequent zero-volume candles). Volume spike and OBV confirmation are disabled; signal is based on price action and momentum only.";
  }
  if (current === 0 && ma === 0) {
    return "Volume data not available for this asset. Signal based on price action and momentum only.";
  }

  const ratio = ma > 0 ? (current / ma).toFixed(1) : "0.0";
  const obvText =
    obvTrend === "rising"
      ? "OBV is rising, confirming volume supports the move."
      : obvTrend === "falling"
        ? "OBV is declining, suggesting volume diverges from price action."
        : "OBV is flat — no strong volume conviction.";

  if (spike) {
    return `Volume is ${ratio}x above the 20-period average — volume spike detected, suggesting strong conviction behind the current price action. ${obvText}`;
  }
  return `Volume is at ${ratio}x the 20-period average. No significant volume spike detected. ${obvText}`;
}

function generateMomentumAnalysis(
  rsi: number,
  macd: { histogram: number; macdLine: number; signalLine: number },
  stochRSI: number,
  bb: { percentB: number },
  rsiDivergence: RsiDivergence,
): string {
  const rsiStatus =
    rsi > 70 ? "overbought" : rsi < 30 ? "oversold" : "neutral territory";
  const macdStatus =
    macd.histogram > 0
      ? "positive (bullish momentum)"
      : macd.histogram < 0
        ? "negative (bearish momentum)"
        : "near zero";
  const stochStatus =
    stochRSI > 80 ? "overbought" : stochRSI < 20 ? "oversold" : "neutral";
  const bbPosition =
    bb.percentB > 0.8
      ? "near upper band"
      : bb.percentB < 0.2
        ? "near lower band"
        : "mid-range";

  let divText = "";
  if (rsiDivergence === "bullish") {
    divText = " Bullish Divergence detected (reversal potential).";
  } else if (rsiDivergence === "bearish") {
    divText = " Bearish Divergence detected (exhaustion risk).";
  }

  return `RSI at ${rsi.toFixed(1)} indicates ${rsiStatus}.${divText} MACD histogram is ${macdStatus} (${macd.histogram.toFixed(2)}). StochRSI at ${stochRSI.toFixed(1)} is ${stochStatus}. Price is ${bbPosition} within Bollinger Bands (%B: ${(bb.percentB * 100).toFixed(0)}%).`;
}
