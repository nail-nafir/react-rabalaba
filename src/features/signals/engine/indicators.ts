/**
 * Technical indicator calculations — pure functions, no side effects.
 * Used by the signal engine to compute RSI, EMA, MACD, Bollinger Bands,
 * Stochastic RSI, ADX, ATR, OBV, etc.
 */

/**
 * Relative Strength Index (14-period by default)
 */
export function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50; // neutral fallback

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }

  if (avgGain === 0 && avgLoss === 0) return 50; // flat market: no momentum edge
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Exponential Moving Average
 */
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] ?? 0;

  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period;

  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }

  return ema;
}

/**
 * Returns a full EMA series (one value per price index) in O(n).
 * Used by MACD to avoid the O(n³) nested-slice approach.
 * Indices before `period - 1` are filled with a running simple average.
 */
export function calculateEMASeries(prices: number[], period: number): number[] {
  const result: number[] = new Array(prices.length).fill(0);
  if (prices.length === 0) return result;

  if (prices.length < period) {
    let sum = 0;
    for (let i = 0; i < prices.length; i++) {
      sum += prices[i];
      result[i] = sum / (i + 1);
    }
    return result;
  }

  // Seed: SMA of the first `period` values
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
    result[i] = sum / (i + 1); // running average for early indices
  }
  let ema = sum / period;
  result[period - 1] = ema;

  const multiplier = 2 / (period + 1);
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
    result[i] = ema;
  }

  return result;
}

/**
 * MACD (12, 26, 9 default)
 *
 * Computed in O(n) using full EMA series instead of the previous O(n³)
 * nested-slice approach. Output is numerically equivalent.
 */
export function calculateMACD(
  prices: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): { macdLine: number; signalLine: number; histogram: number } {
  if (prices.length < slowPeriod + signalPeriod) {
    return { macdLine: 0, signalLine: 0, histogram: 0 };
  }

  // Compute full EMA series in O(n) — no more per-index slicing
  const fastSeries = calculateEMASeries(prices, fastPeriod);
  const slowSeries = calculateEMASeries(prices, slowPeriod);

  // MACD line = fast EMA − slow EMA, from slowPeriod-1 onward
  const macdValues: number[] = [];
  for (let i = slowPeriod - 1; i < prices.length; i++) {
    macdValues.push(fastSeries[i] - slowSeries[i]);
  }

  const macdLine = macdValues[macdValues.length - 1];
  const signalLine = calculateEMA(macdValues, signalPeriod);
  const histogram = macdLine - signalLine;

  return { macdLine, signalLine, histogram };
}

/**
 * Simple Moving Average for volume
 */
export function calculateSMA(values: number[], period: number): number {
  if (values.length === 0) return 0;
  if (values.length < period) return values.reduce((s, v) => s + v, 0) / values.length;
  const slice = values.slice(-period);
  return slice.reduce((sum, v) => sum + v, 0) / period;
}

/**
 * Simple pivot-based support/resistance
 */
export function calculatePivotLevels(
  high: number,
  low: number,
  close: number
): { support: number; resistance: number } {
  const pivot = (high + low + close) / 3;
  const support = 2 * pivot - high;
  const resistance = 2 * pivot - low;
  return { support, resistance };
}

// ─────────────────────────────────────────────
// NEW INDICATORS
// ─────────────────────────────────────────────

/**
 * Bollinger Bands (20-period SMA ± 2 standard deviations)
 *
 * Returns upper/lower bands and %B (position of close within bands, 0-1).
 * - %B > 1  → price above upper band (overbought / strong breakout)
 * - %B < 0  → price below lower band (oversold / breakdown)
 * - %B ≈ 0.5 → price at the middle
 */
export function calculateBollingerBands(
  prices: number[],
  period = 20,
  stdDevMultiplier = 2
): { upper: number; middle: number; lower: number; percentB: number } {
  if (prices.length < period) {
    const mid = prices[prices.length - 1] ?? 0;
    return { upper: mid, middle: mid, lower: mid, percentB: 0.5 };
  }

  const slice = prices.slice(-period);
  const middle = slice.reduce((s, v) => s + v, 0) / period;

  // Sample variance (period - 1) matches TradingView and most charting platforms
  const variance = slice.reduce((s, v) => s + (v - middle) ** 2, 0) / (period - 1);
  const stdDev = Math.sqrt(variance);

  const upper = middle + stdDevMultiplier * stdDev;
  const lower = middle - stdDevMultiplier * stdDev;

  const close = prices[prices.length - 1];
  const bandWidth = upper - lower;
  const percentB = bandWidth > 0 ? (close - lower) / bandWidth : 0.5;

  return { upper, middle, lower, percentB };
}

/**
 * Stochastic RSI — applies the Stochastic oscillator formula to RSI values.
 *
 * More sensitive than RSI for catching momentum reversals.
 * - StochRSI > 80 → overbought momentum
 * - StochRSI < 20 → oversold momentum
 *
 * Formula: (RSI - min(RSI, N)) / (max(RSI, N) - min(RSI, N)) × 100
 *
 * Optimized to O(n) using incremental Wilder's smoothing instead of the
 * previous O(n²) approach that recalculated full RSI for every sub-array.
 */
export function calculateStochRSI(prices: number[], rsiPeriod = 14, stochPeriod = 14): number {
  if (prices.length < rsiPeriod + stochPeriod + 1) return 50; // neutral fallback

  // Build RSI series incrementally using Wilder's smoothing — O(n)
  const rsiValues: number[] = [];

  // Seed: first RSI from SMA of gains/losses
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= rsiPeriod; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  let avgGain = gains / rsiPeriod;
  let avgLoss = losses / rsiPeriod;

  const computeRSI = () => {
    if (avgGain === 0 && avgLoss === 0) return 50;
    if (avgLoss === 0) return 100;
    return 100 - 100 / (1 + avgGain / avgLoss);
  };

  rsiValues.push(computeRSI());

  // Incrementally update avgGain/avgLoss using Wilder's smoothing
  for (let i = rsiPeriod + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    avgGain = (avgGain * (rsiPeriod - 1) + Math.max(change, 0)) / rsiPeriod;
    avgLoss = (avgLoss * (rsiPeriod - 1) + Math.max(-change, 0)) / rsiPeriod;
    rsiValues.push(computeRSI());
  }

  if (rsiValues.length < stochPeriod) return 50;

  const recentRSIs = rsiValues.slice(-stochPeriod);
  const minRSI = Math.min(...recentRSIs);
  const maxRSI = Math.max(...recentRSIs);
  const currentRSI = rsiValues[rsiValues.length - 1];

  if (maxRSI === minRSI) return 50;
  return ((currentRSI - minRSI) / (maxRSI - minRSI)) * 100;
}

/**
 * Directional Movement Index (DMI) + Average Directional Index (ADX).
 *
 * ADX measures trend STRENGTH, not direction. +DI and -DI provide the
 * directional component, so the signal engine does not accidentally treat a
 * strong bearish trend as bullish just because ADX is high.
 */
export interface DMIResult {
  adx: number;
  plusDI: number;
  minusDI: number;
}

export function calculateDMI(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): DMIResult {
  const empty = { adx: 0, plusDI: 0, minusDI: 0 };
  const len = Math.min(highs.length, lows.length, closes.length);
  if (len < period * 2 + 1) return empty; // not enough data

  // Step 1: Calculate True Range, +DM, -DM
  const trueRanges: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let i = 1; i < len; i++) {
    const highDiff = highs[i] - highs[i - 1];
    const lowDiff = lows[i - 1] - lows[i];

    const plusDM = highDiff > lowDiff && highDiff > 0 ? highDiff : 0;
    const minusDM = lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0;

    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );

    trueRanges.push(tr);
    plusDMs.push(plusDM);
    minusDMs.push(minusDM);
  }

  if (trueRanges.length < period * 2) return empty;

  // Step 2: Smooth with Wilder's method (initial SMA then recursive)
  let smoothTR = trueRanges.slice(0, period).reduce((s, v) => s + v, 0);
  let smoothPlusDM = plusDMs.slice(0, period).reduce((s, v) => s + v, 0);
  let smoothMinusDM = minusDMs.slice(0, period).reduce((s, v) => s + v, 0);

  const dxValues: number[] = [];
  let latestPlusDI = 0;
  let latestMinusDI = 0;

  for (let i = period; i < trueRanges.length; i++) {
    smoothTR = smoothTR - smoothTR / period + trueRanges[i];
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDMs[i];
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDMs[i];

    latestPlusDI = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    latestMinusDI = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
    const diSum = latestPlusDI + latestMinusDI;
    const dx = diSum > 0 ? (Math.abs(latestPlusDI - latestMinusDI) / diSum) * 100 : 0;
    dxValues.push(dx);
  }

  if (dxValues.length < period) return empty;

  // Step 3: ADX = smoothed average of DX
  let adx = dxValues.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
  }

  return { adx, plusDI: latestPlusDI, minusDI: latestMinusDI };
}

/**
 * Average Directional Index (ADX) — measures trend STRENGTH, not direction.
 *
 * - ADX > 25 → strong trend (trending market)
 * - ADX 20-25 → developing trend
 * - ADX < 20 → weak/no trend (ranging/choppy market)
 *
 * Requires arrays of highs, lows, and closes of equal length.
 */
export function calculateADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number {
  return calculateDMI(highs, lows, closes, period).adx;
}

/**
 * Average True Range (ATR) — measures average volatility.
 *
 * Used to validate whether a price move is significant relative to
 * normal volatility, and to size position stops.
 */
export function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number {
  const len = Math.min(highs.length, lows.length, closes.length);
  if (len < period + 1) return 0;

  const trueRanges: number[] = [];
  for (let i = 1; i < len; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);
  }

  // Wilder's smoothing
  let atr = trueRanges.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  return atr;
}

/**
 * On-Balance Volume (OBV) trend direction.
 *
 * OBV adds volume on up-days and subtracts on down-days.
 * If OBV is rising while price rises → volume confirms the move.
 * If OBV diverges from price → potential reversal signal.
 *
 * Returns the OBV trend over the last `lookback` periods:
 * 'rising' | 'falling' | 'flat'
 */
export function calculateOBVTrend(
  prices: number[],
  volumes: number[],
  lookback = 10
): 'rising' | 'falling' | 'flat' {
  const len = Math.min(prices.length, volumes.length);
  if (len < lookback + 1) return 'flat';

  // Build OBV series
  const obv: number[] = [0];
  for (let i = 1; i < len; i++) {
    if (prices[i] > prices[i - 1]) {
      obv.push(obv[i - 1] + volumes[i]);
    } else if (prices[i] < prices[i - 1]) {
      obv.push(obv[i - 1] - volumes[i]);
    } else {
      obv.push(obv[i - 1]);
    }
  }

  // Compare OBV at end vs lookback periods ago using linear regression slope
  const recentOBV = obv.slice(-lookback);
  const n = recentOBV.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += recentOBV[i];
    sumXY += i * recentOBV[i];
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // Normalize slope relative to average OBV magnitude to determine significance
  const avgOBV = Math.abs(sumY / n);
  if (avgOBV === 0) return 'flat';
  const normalizedSlope = slope / avgOBV;

  if (normalizedSlope > 0.02) return 'rising';
  if (normalizedSlope < -0.02) return 'falling';
  return 'flat';
}

/**
 * Generates a series of RSI values for a price array.
 */
export function calculateRSISeries(prices: number[], period = 14): number[] {
  if (prices.length < period + 1) return [];
  const rsiSeries: number[] = [];
  // For efficiency in computeSignal, we only compute the last ~50 periods if array is large
  const start = Math.max(0, prices.length - 100);
  for (let i = start + period + 1; i <= prices.length; i++) {
    rsiSeries.push(calculateRSI(prices.slice(0, i), period));
  }
  return rsiSeries;
}

/**
 * Detects RSI Divergence (Bullish/Bearish).
 *
 * Bullish Divergence: Price Lower Low + RSI Higher Low (Reversal Up)
 * Bearish Divergence: Price Higher High + RSI Lower High (Reversal Down)
 *
 * Uses a lookback window to find local peaks/troughs.
 */
export function detectRSIDivergence(
  prices: number[],
  rsiValues: number[],
  lookback = 30
): "bullish" | "bearish" | "none" {
  const pLen = prices.length;
  const rLen = rsiValues.length;
  if (pLen < lookback || rLen < lookback) return "none";

  const recentPrices = prices.slice(-lookback);
  const recentRSI = rsiValues.slice(-lookback);

  // 1. Find local extrema (peaks and troughs)
  // Minimum 5-candle distance between extrema to filter noise.
  // If a new extremum is within the window, keep the more significant one.
  const MIN_EXTREMA_DISTANCE = 5;

  const findTroughs = (data: number[]) => {
    const troughs: { index: number; value: number }[] = [];
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] < data[i - 1] && data[i] < data[i + 1]) {
        if (troughs.length === 0 || i - troughs[troughs.length - 1].index >= MIN_EXTREMA_DISTANCE) {
          troughs.push({ index: i, value: data[i] });
        } else if (data[i] < troughs[troughs.length - 1].value) {
          troughs[troughs.length - 1] = { index: i, value: data[i] };
        }
      }
    }
    return troughs;
  };

  const findPeaks = (data: number[]) => {
    const peaks: { index: number; value: number }[] = [];
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
        if (peaks.length === 0 || i - peaks[peaks.length - 1].index >= MIN_EXTREMA_DISTANCE) {
          peaks.push({ index: i, value: data[i] });
        } else if (data[i] > peaks[peaks.length - 1].value) {
          peaks[peaks.length - 1] = { index: i, value: data[i] };
        }
      }
    }
    return peaks;
  };

  const pTroughs = findTroughs(recentPrices);
  const rTroughs = findTroughs(recentRSI);
  const pPeaks = findPeaks(recentPrices);
  const rPeaks = findPeaks(recentRSI);

  // 2. Check Bullish Divergence (Price Lower Low, RSI Higher Low)
  // We need at least 2 troughs to compare
  if (pTroughs.length >= 2 && rTroughs.length >= 2) {
    const lastPT = pTroughs[pTroughs.length - 1];
    const prevPT = pTroughs[pTroughs.length - 2];
    const lastRT = rTroughs[rTroughs.length - 1];
    const prevRT = rTroughs[rTroughs.length - 2];

    // Ensure the troughs are somewhat aligned in time (within 5 candles)
    const timeMatch = Math.abs(lastPT.index - lastRT.index) < 5;

    if (timeMatch && lastPT.value < prevPT.value && lastRT.value > prevRT.value) {
      // Additional filter: RSI should be in/near oversold territory
      if (lastRT.value < 40) return "bullish";
    }
  }

  // 3. Check Bearish Divergence (Price Higher High, RSI Lower High)
  if (pPeaks.length >= 2 && rPeaks.length >= 2) {
    const lastPP = pPeaks[pPeaks.length - 1];
    const prevPP = pPeaks[pPeaks.length - 2];
    const lastRP = rPeaks[rPeaks.length - 1];
    const prevRP = rPeaks[rPeaks.length - 2];

    const timeMatch = Math.abs(lastPP.index - lastRP.index) < 5;

    if (timeMatch && lastPP.value > prevPP.value && lastRP.value < prevRP.value) {
      // Additional filter: RSI should be in/near overbought territory
      if (lastRP.value > 60) return "bearish";
    }
  }

  return "none";
}

/**
 * Calculates Fibonacci Retracement levels based on a high and low point.
 */
export function calculateFibLevels(high: number, low: number): {
  0: number;
  0.236: number;
  0.382: number;
  0.5: number;
  0.618: number;
  0.786: number;
  1: number;
} {
  const diff = high - low;
  return {
    0: low,
    0.236: low + diff * 0.236,
    0.382: low + diff * 0.382,
    0.5: low + diff * 0.5,
    0.618: low + diff * 0.618,
    0.786: low + diff * 0.786,
    1: high,
  };
}

/**
 * Market regime classification (Layer 1).
 *
 * Distinguishes the four behavioral states so the engine can weight indicator
 * categories appropriately and avoid trading chop:
 * - low_volatility  → compression/squeeze (weak ADX + tight Bollinger bands)
 * - trending        → strong directional move (ADX >= strong-trend threshold)
 * - high_volatility → non-directional volatility expansion (ATR% elevated)
 * - ranging         → default: weak trend, normal volatility
 *
 * Trending takes priority over high_volatility so a clean strong trend is not
 * mislabeled; squeeze takes priority over everything because it is a no-trade
 * pre-breakout state.
 */
export function classifyRegime(params: {
  adx: number;
  atrPercent: number;
  bbBandwidthPercent: number;
  strongAdx: number;
  highVolAtrPercent: number;
  squeezeBandwidthPercent: number;
  squeezeMaxAdx: number;
}): "trending" | "ranging" | "high_volatility" | "low_volatility" {
  const {
    adx,
    atrPercent,
    bbBandwidthPercent,
    strongAdx,
    highVolAtrPercent,
    squeezeBandwidthPercent,
    squeezeMaxAdx,
  } = params;

  const isSqueeze =
    bbBandwidthPercent > 0 &&
    bbBandwidthPercent < squeezeBandwidthPercent &&
    adx < squeezeMaxAdx;
  if (isSqueeze) return "low_volatility";

  if (adx >= strongAdx) return "trending";
  if (atrPercent >= highVolAtrPercent) return "high_volatility";
  return "ranging";
}

/**
 * Detect the most recent structural swing high/low via 3-bar fractal pivots
 * within a lookback window. Structure-based levels are more meaningful for
 * stop/target placement than a textbook pivot, especially for crypto. Falls
 * back to the window extremes when no fractal pivot is found.
 */
export function detectSwingLevels(
  highs: number[],
  lows: number[],
  lookback = 50,
): { swingHigh: number; swingLow: number } {
  const n = Math.min(highs.length, lows.length);
  if (n === 0) return { swingHigh: 0, swingLow: 0 };
  if (n < 5) return { swingHigh: highs[n - 1], swingLow: lows[n - 1] };

  const start = Math.max(1, n - lookback);
  let swingHigh = 0;
  let swingLow = 0;
  let foundHigh = false;
  let foundLow = false;

  // Walk forward keeping the most recent pivot (later pivots overwrite earlier).
  for (let i = start; i < n - 1; i++) {
    if (highs[i] >= highs[i - 1] && highs[i] >= highs[i + 1]) {
      swingHigh = highs[i];
      foundHigh = true;
    }
    if (lows[i] <= lows[i - 1] && lows[i] <= lows[i + 1]) {
      swingLow = lows[i];
      foundLow = true;
    }
  }

  if (!foundHigh) swingHigh = Math.max(...highs.slice(start));
  if (!foundLow) swingLow = Math.min(...lows.slice(start));
  return { swingHigh, swingLow };
}

