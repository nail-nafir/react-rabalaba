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
} from "./indicators";
import type {
  AssetType,
  SignalDirection,
  SignalTier,
  RiskLevel,
} from "@/types/asset";
import type { TrendDirection } from "@/types/market";
import {
  SIGNAL_THRESHOLDS,
  SIGNAL_WEIGHTS,
  TIER_THRESHOLDS,
  RISK_RULES,
} from "@/constants/signals";
import {
  TIMEFRAME_PRESETS,
  type TimeframePresetKey,
  type SignalProfile,
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
}

export interface Outlook {
  signal: SignalDirection;
  confidence: number;
  tier: SignalTier;
  risk: RiskLevel;
  trend: TrendDirection;
  score: number;
  maxScore: number;
  reasons: SignalReasons;
  dataQuality: SignalDataQuality;
  indicators: {
    rsi: number;
    ema20: number;
    ema50: number;
    macd: { macdLine: number; signalLine: number; histogram: number };
    volumeMA: number;
    volumeSpike: boolean;
    support: number;
    resistance: number;
    bollingerBands: {
      upper: number;
      middle: number;
      lower: number;
      percentB: number;
    };
    stochRSI: number;
    adx: number;
    atr: number;
    obvTrend: "rising" | "falling" | "flat";
    rsiDivergence: "bullish" | "bearish" | "none";
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
 * Enhanced rule-based signal engine with weighted scoring.
 *
 * Scoring system (weighted):
 * - EMA alignment:    ±1.5 (primary trend — most reliable)
 * - MACD crossover:   ±1.0 (momentum confirmation)
 * - RSI extremes:     ±1.0 (overbought/oversold zones)
 * - ADX trend:        ±1.0 (confirms trend exists vs ranging)
 * - Volume spike:     ±0.75 (participation confirmation)
 * - Bollinger Bands:  ±0.75 (volatility context)
 * - Stochastic RSI:   ±0.5 (fine-grained momentum)
 * - OBV direction:    ±0.5 (volume-price agreement)
 * - RSI Divergence:   ±1.0 (reversal "edge")
 * - Fibonacci 0.618:  ±1.0 (Golden Pocket bounce)
 *
 * MAX_SCORE = 9.0
 * Conservative default:
 * - Total ≥ 3.25 → LONG, Total ≤ -3.25 → SHORT, else NEUTRAL
 * - Confidence = signal conviction, not probability of profit
 *
 * Important trading note:
 * The engine is a technical screener, not an execution system. It stays
 * neutral when data quality is poor because a false sense of precision is more
 * dangerous than a missed setup.
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
  const dataQuality: SignalDataQuality = {
    candleCount,
    ready: candleCount >= profile.minCandles,
    missingVolume: !hasVolumeData,
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
  }

  // ─── Calculate core indicators ───────────────────────────
  const rsi = calculateRSI(prices);
  const ema20 = calculateEMA(prices, 20);
  const ema50 = calculateEMA(prices, 50);
  const macd = calculateMACD(prices);

  // Volume analysis (skip if no volume data available)
  const volumeMA = hasVolumeData ? calculateSMA(volumes, 20) : 0;
  const currentVolume = volumes[volumes.length - 1] ?? 0;
  const volumeSpike =
    hasVolumeData &&
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
  const obvTrend = hasVolumeData
    ? calculateOBVTrend(prices, volumes)
    : ("flat" as const);

  const rsiSeries = calculateRSISeries(prices);
  const rsiDivergence = detectRSIDivergence(prices, rsiSeries);

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
    trend = "neutral";
  } else if (emaBullish && dmiBullish) {
    trend = "bullish";
  } else if (emaBearish && dmiBearish) {
    trend = "bearish";
  } else {
    trend = "neutral";
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

  // ─── Weighted score calculation ──────────────────────────
  let score = 0;

  // 1. EMA Alignment (weight: 1.5)
  if (emaBullish) {
    score += SIGNAL_WEIGHTS.EMA_ALIGNMENT;
    reasons.bullish.push(
      "Price above EMA20 > EMA50 (strong bullish alignment)",
    );
  } else if (emaBearish) {
    score -= SIGNAL_WEIGHTS.EMA_ALIGNMENT;
    reasons.bearish.push(
      "Price below EMA20 < EMA50 (strong bearish alignment)",
    );
  } else if (close > ema20 && ema20 < ema50) {
    score += SIGNAL_WEIGHTS.EMA_ALIGNMENT * 0.33;
    reasons.bullish.push("Price above EMA20 but below EMA50 (early recovery)");
  } else if (close < ema20 && ema20 > ema50) {
    score -= SIGNAL_WEIGHTS.EMA_ALIGNMENT * 0.33;
    reasons.bearish.push("Price below EMA20 but above EMA50 (early weakness)");
  }

  // 2. MACD (weight: 1.0)
  if (macd.histogram > 0 && macd.macdLine > macd.signalLine) {
    score += SIGNAL_WEIGHTS.MACD;
    reasons.bullish.push("MACD bullish (histogram positive, MACD > signal)");
  } else if (macd.histogram < 0 && macd.macdLine < macd.signalLine) {
    score -= SIGNAL_WEIGHTS.MACD;
    reasons.bearish.push("MACD bearish (histogram negative, MACD < signal)");
  }

  // 3. RSI (weight: 1.0)
  // RSI is context-sensitive: overbought in a strong uptrend is not a short
  // signal by itself, and oversold in a strong downtrend is not a blind buy.
  if (rsi < SIGNAL_THRESHOLDS.RSI_OVERSOLD) {
    if (emaBearish && adx > SIGNAL_THRESHOLDS.ADX_STRONG_TREND) {
      score -= SIGNAL_WEIGHTS.RSI * 0.5;
      reasons.bearish.push(
        `RSI oversold at ${rsi.toFixed(1)} in strong downtrend — bearish continuation risk`,
      );
    } else {
      score += SIGNAL_WEIGHTS.RSI;
      reasons.bullish.push(
        `RSI oversold at ${rsi.toFixed(1)} — potential reversal zone`,
      );
    }
  } else if (rsi > SIGNAL_THRESHOLDS.RSI_OVERBOUGHT) {
    if (emaBullish && adx > SIGNAL_THRESHOLDS.ADX_STRONG_TREND) {
      score += SIGNAL_WEIGHTS.RSI * 0.25;
      reasons.bullish.push(
        `RSI elevated at ${rsi.toFixed(1)} in strong uptrend — momentum can stay extended`,
      );
    } else {
      score -= SIGNAL_WEIGHTS.RSI;
      reasons.bearish.push(
        `RSI overbought at ${rsi.toFixed(1)} — overextended`,
      );
    }
  }

  // 4. ADX Trend Strength (weight: 1.0)
  if (adx > SIGNAL_THRESHOLDS.ADX_STRONG_TREND) {
    if (trend === "bullish") {
      score += SIGNAL_WEIGHTS.ADX_TREND;
      reasons.bullish.push(
        `ADX at ${adx.toFixed(1)} with +DI above -DI confirms strong bullish trend`,
      );
    } else if (trend === "bearish") {
      score -= SIGNAL_WEIGHTS.ADX_TREND;
      reasons.bearish.push(
        `ADX at ${adx.toFixed(1)} with -DI above +DI confirms strong bearish trend`,
      );
    }
  }

  // 5. Volume Spike (weight: 0.75)
  // Volume spike follows the latest candle direction instead of blindly
  // amplifying whatever the current score already says.
  if (hasVolumeData && volumeSpike) {
    const previousClose = prices[prices.length - 2] ?? close;
    const volumeRatio = currentVolume / volumeMA;

    if (close > previousClose) {
      score += SIGNAL_WEIGHTS.VOLUME_SPIKE;
      reasons.bullish.push(
        `Volume spike (${volumeRatio.toFixed(1)}x avg) confirms buying pressure`,
      );
    } else if (close < previousClose) {
      score -= SIGNAL_WEIGHTS.VOLUME_SPIKE;
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
      score += SIGNAL_WEIGHTS.BOLLINGER * 0.5;
      reasons.bullish.push(
        `Price riding upper Bollinger Band in strong trend (%B: ${(bollingerBands.percentB * 100).toFixed(0)}%) — trend strength`,
      );
    } else if (bollingerBands.percentB < 0.2 && trend === "bearish") {
      score -= SIGNAL_WEIGHTS.BOLLINGER * 0.5;
      reasons.bearish.push(
        `Price riding lower Bollinger Band in strong trend (%B: ${(bollingerBands.percentB * 100).toFixed(0)}%) — trend strength`,
      );
    }
  } else {
    if (bollingerBands.percentB < 0) {
      score += SIGNAL_WEIGHTS.BOLLINGER;
      reasons.bullish.push(
        `Price below lower Bollinger Band (%B: ${(bollingerBands.percentB * 100).toFixed(0)}%) — oversold in range`,
      );
    } else if (bollingerBands.percentB > 1) {
      score -= SIGNAL_WEIGHTS.BOLLINGER;
      reasons.bearish.push(
        `Price above upper Bollinger Band (%B: ${(bollingerBands.percentB * 100).toFixed(0)}%) — overbought in range`,
      );
    } else if (bollingerBands.percentB < 0.2) {
      score += SIGNAL_WEIGHTS.BOLLINGER * 0.5;
      reasons.bullish.push(
        `Price near lower Bollinger Band (%B: ${(bollingerBands.percentB * 100).toFixed(0)}%)`,
      );
    } else if (bollingerBands.percentB > 0.8) {
      score -= SIGNAL_WEIGHTS.BOLLINGER * 0.5;
      reasons.bearish.push(
        `Price near upper Bollinger Band (%B: ${(bollingerBands.percentB * 100).toFixed(0)}%)`,
      );
    }
  }

  // 7. Stochastic RSI (weight: 0.5)
  if (stochRSI < SIGNAL_THRESHOLDS.STOCH_RSI_OVERSOLD) {
    if (trend === "bearish") {
      score -= SIGNAL_WEIGHTS.STOCH_RSI * 0.5;
      reasons.bearish.push(
        `StochRSI oversold at ${stochRSI.toFixed(1)} inside bearish trend — avoid early bottom-picking`,
      );
    } else {
      score += SIGNAL_WEIGHTS.STOCH_RSI;
      reasons.bullish.push(
        `StochRSI oversold at ${stochRSI.toFixed(1)} — momentum reversal zone`,
      );
    }
  } else if (stochRSI > SIGNAL_THRESHOLDS.STOCH_RSI_OVERBOUGHT) {
    if (trend === "bullish") {
      score += SIGNAL_WEIGHTS.STOCH_RSI * 0.5;
      reasons.bullish.push(
        `StochRSI overbought at ${stochRSI.toFixed(1)} inside bullish trend — momentum remains extended`,
      );
    } else {
      score -= SIGNAL_WEIGHTS.STOCH_RSI;
      reasons.bearish.push(
        `StochRSI overbought at ${stochRSI.toFixed(1)} — momentum exhaustion`,
      );
    }
  }

  // 8. OBV Direction (weight: 0.5)
  // Score OBV independently from accumulated score to avoid circular
  // confirmation bias. Use candle direction + EMA context instead.
  if (hasVolumeData) {
    const latestCandleUp = close > (prices[prices.length - 2] ?? close);
    const latestCandleDown = close < (prices[prices.length - 2] ?? close);

    if (obvTrend === "rising" && (latestCandleUp || emaBullish)) {
      score += SIGNAL_WEIGHTS.OBV_DIRECTION;
      reasons.bullish.push(
        "OBV rising — volume confirms upward price movement",
      );
    } else if (obvTrend === "falling" && (latestCandleDown || emaBearish)) {
      score -= SIGNAL_WEIGHTS.OBV_DIRECTION;
      reasons.bearish.push(
        "OBV falling — volume confirms downward price movement",
      );
    } else if (obvTrend === "rising" && (latestCandleDown || emaBearish)) {
      score += SIGNAL_WEIGHTS.OBV_DIRECTION * 0.5;
      reasons.bullish.push(
        "OBV divergence — volume rising against price decline (potential reversal)",
      );
    } else if (obvTrend === "falling" && (latestCandleUp || emaBullish)) {
      score -= SIGNAL_WEIGHTS.OBV_DIRECTION * 0.5;
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
    score += weight;
    reasons.bullish.push(
      "Bullish RSI Divergence detected — reversal signal, but still requires risk control",
    );
  } else if (rsiDivergence === "bearish") {
    const weight =
      trend === "bearish"
        ? SIGNAL_WEIGHTS.RSI_DIVERGENCE * 0.75
        : SIGNAL_WEIGHTS.RSI_DIVERGENCE;
    score -= weight;
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
      score += SIGNAL_WEIGHTS.FIBONACCI_BOUNCE;
      reasons.bullish.push(
        `Price holding directional 0.618 Fibonacci Golden Pocket ($${fibLevels[0.618].toFixed(2)})`,
      );
    } else if (trend === "bearish") {
      score -= SIGNAL_WEIGHTS.FIBONACCI_BOUNCE;
      reasons.bearish.push(
        `Price rejected at directional 0.618 Fibonacci level ($${fibLevels[0.618].toFixed(2)})`,
      );
    }
  }

  // 11. Bollinger Band Squeeze Detection (warning only, no scoring)
  // Bandwidth contraction often precedes a significant price move.
  const bandwidth = bollingerBands.upper - bollingerBands.lower;
  const bandwidthPercent =
    bollingerBands.middle > 0 ? (bandwidth / bollingerBands.middle) * 100 : 0;

  if (bandwidthPercent < 3 && bandwidthPercent > 0) {
    reasons.warnings.push(
      `Bollinger Band Squeeze (bandwidth ${bandwidthPercent.toFixed(1)}%) — volatility contraction, big move likely incoming.`,
    );
  }

  // 12. Fear & Greed Sentiment Context (warning only)
  // Not scored because the index is lagging and crypto-heavy, but extreme
  // readings are surfaced so users have the context for risk management.
  if (fearGreedValue !== undefined && fearGreedValue !== null) {
    if (fearGreedValue <= 20 && score < 0) {
      reasons.warnings.push(
        `Extreme Fear (F&G: ${fearGreedValue}) — oversold sentiment may limit further downside`,
      );
    } else if (fearGreedValue >= 80 && score > 0) {
      reasons.warnings.push(
        `Extreme Greed (F&G: ${fearGreedValue}) — elevated risk of mean reversion pullback`,
      );
    }
  }

  // ─── Determine signal ────────────────────────────────────
  let signal: SignalDirection;
  if (dataQuality.ready && score >= profile.longThreshold) {
    signal = "long";
  } else if (dataQuality.ready && score <= profile.shortThreshold) {
    signal = "short";
  } else {
    signal = "neutral";
  }

  // Countertrend trades are allowed when a real divergence override exists
  // OR when the raw score is exceptionally strong (≥ 5.0), indicating that
  // multiple independent indicators agree on the reversal.
  const isCounterTrend =
    (signal === "long" && trend === "bearish") ||
    (signal === "short" && trend === "bullish");
  const hasDivergenceOverride =
    (signal === "long" && rsiDivergence === "bullish") ||
    (signal === "short" && rsiDivergence === "bearish");
  const hasStrongScoreOverride = Math.abs(score) >= 5.0;

  if (isCounterTrend && !hasDivergenceOverride && !hasStrongScoreOverride) {
    reasons.warnings.push(
      "Raw score crossed the threshold, but trend regime disagrees; signal forced back to NEUTRAL.",
    );
    signal = "neutral";
  }

  // ─── Confidence (signal conviction, not probability of profit) ────────
  const baseConfidence =
    signal === "neutral"
      ? calculateNeutralConfidence(score, profile)
      : Math.round((Math.abs(score) / SIGNAL_THRESHOLDS.MAX_SCORE) * 100);

  const adxBonus =
    signal !== "neutral" && adx > SIGNAL_THRESHOLDS.ADX_STRONG_TREND ? 8 : 0;

  const volumeBonus =
    hasVolumeData && volumeSpike && signal !== "neutral" ? 4 : 0;

  const dataPenalty = dataQuality.ready ? 0 : 20;
  const confidence = Math.min(
    dataQuality.ready ? 100 : 25,
    Math.max(0, baseConfidence + adxBonus + volumeBonus - dataPenalty),
  );

  // ─── Tier ────────────────────────────────────────────────
  let tier: SignalTier;
  if (confidence >= TIER_THRESHOLDS.A) tier = "A";
  else if (confidence >= TIER_THRESHOLDS.B) tier = "B";
  else tier = "C";

  // ─── Risk ────────────────────────────────────────────────
  const risk = calculateRisk({
    signal,
    confidence,
    volumeSpike,
    hasVolumeData,
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
    confidence,
    tier,
    risk,
    trend,
    score,
    maxScore: SIGNAL_THRESHOLDS.MAX_SCORE,
    reasons,
    dataQuality,
    indicators: {
      rsi,
      ema20,
      ema50,
      macd,
      volumeMA,
      volumeSpike,
      support,
      resistance,
      bollingerBands,
      stochRSI,
      adx,
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
    confidence: 0,
    tier: "C",
    risk: "high",
    trend: "neutral",
    score: 0,
    maxScore: SIGNAL_THRESHOLDS.MAX_SCORE,
    reasons,
    dataQuality: { candleCount: 0, ready: false, missingVolume: true },
    indicators: {
      rsi: 50,
      ema20: 0,
      ema50: 0,
      macd: EMPTY_MACD,
      volumeMA: 0,
      volumeSpike: false,
      support: 0,
      resistance: 0,
      bollingerBands: EMPTY_BOLLINGER,
      stochRSI: 50,
      adx: 0,
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

function calculateNeutralConfidence(
  score: number,
  profile: SignalProfile,
): number {
  const nearestThreshold =
    score >= 0 ? profile.longThreshold : Math.abs(profile.shortThreshold);
  const thresholdProgress = Math.min(Math.abs(score) / nearestThreshold, 1);

  // Neutral confidence is intentionally capped low. It means "no trade-grade
  // conviction", not "high confidence that doing nothing is profitable".
  return Math.round(15 + thresholdProgress * 20);
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
  obvTrend: "rising" | "falling" | "flat",
): string {
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
  rsiDivergence: "bullish" | "bearish" | "none",
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

function generateSentimentAnalysis(fearGreed?: number): string {
  if (fearGreed === undefined || fearGreed === null)
    return "Market sentiment data unavailable. Consider external indicators for sentiment confirmation.";
  if (fearGreed <= 20)
    return `Fear & Greed Index at ${fearGreed} (Extreme Fear). Market may be approaching a contrarian buy opportunity.`;
  if (fearGreed <= 40)
    return `Fear & Greed Index at ${fearGreed} (Fear). Cautious market conditions. Watch for capitulation or reversal signals.`;
  if (fearGreed <= 60)
    return `Fear & Greed Index at ${fearGreed} (Neutral). Balanced market sentiment. Follow technical signals for direction.`;
  if (fearGreed <= 80)
    return `Fear & Greed Index at ${fearGreed} (Greed). Optimistic market. Trend may continue but watch for overextension.`;
  return `Fear & Greed Index at ${fearGreed} (Extreme Greed). Elevated risk of pullback. Consider tightening stops.`;
}
