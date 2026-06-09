import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

let server;

async function loadModule(path) {
  if (!server) {
    server = await createServer({
      appType: "custom",
      configFile: "vite.config.ts",
      logLevel: "silent",
      server: { middlewareMode: true },
    });
  }

  return server.ssrLoadModule(path);
}

test.after(async () => {
  if (server) await server.close();
});

function makeTrendCandles({
  count,
  start = 100,
  step = 1,
  volume = 1_000,
  volumeSpikeAtEnd = false,
}) {
  return Array.from({ length: count }, (_, index) => {
    const close = start + step * index;
    const previousClose = index === 0 ? close - step : start + step * (index - 1);

    return {
      open: previousClose,
      high: Math.max(close, previousClose) + Math.abs(step || 1) * 0.8,
      low: Math.min(close, previousClose) - Math.abs(step || 1) * 0.8,
      close,
      volume: volumeSpikeAtEnd && index === count - 1 ? volume * 3 : volume,
      timestamp: index + 1,
    };
  });
}

function makeRangingCandles(count) {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + (index % 2 === 0 ? 0.2 : -0.2);

    return {
      open: 100,
      high: close + 0.5,
      low: close - 0.5,
      close,
      volume: 1_000,
      timestamp: index + 1,
    };
  });
}

async function computeFromCandles(candles, options = {}) {
  const { computeSignal } = await loadModule(
    "/src/features/engine/signals.ts",
  );
  const { buildSignalSeriesFromCandles } = await loadModule(
    "/src/services/adapters/yahoo-candles.ts",
  );

  return computeSignal({
    ...buildSignalSeriesFromCandles(candles),
    assetType: "us-stock",
    timeframe: "swing",
    ...options,
  });
}

test("normalizes Yahoo candles without breaking OHLCV alignment", async () => {
  const { normalizeYahooCandles, buildSignalSeriesFromCandles } =
    await loadModule("/src/services/adapters/yahoo-candles.ts");

  const candles = normalizeYahooCandles(
    {
      open: [9, 10, 11, 12],
      high: [11, 12, 13, 14],
      low: [8, 9, 10, 11],
      close: [10, 11, null, 13],
      volume: [100, null, 300, 400],
    },
    [1, 2, 3, 4],
  );

  assert.equal(candles.length, 3);
  assert.deepEqual(
    candles.map((candle) => candle.timestamp),
    [1, 2, 4],
  );
  assert.equal(candles[1].close, 11);
  assert.equal(candles[1].volume, 0);

  const signalSeries = buildSignalSeriesFromCandles(candles);
  assert.deepEqual(signalSeries.prices, [10, 11, 13]);
  assert.deepEqual(signalSeries.highPrices, [11, 12, 14]);
  assert.deepEqual(signalSeries.lowPrices, [8, 9, 11]);
});

test("RSI stays neutral in a flat market and DMI exposes ADX direction", async () => {
  const { calculateRSI, calculateDMI } = await loadModule(
    "/src/features/engine/indicators.ts",
  );

  assert.equal(calculateRSI(Array(40).fill(100)), 50);

  const candles = makeTrendCandles({ count: 80, step: 1 });
  const highs = candles.map((candle) => candle.high);
  const lows = candles.map((candle) => candle.low);
  const closes = candles.map((candle) => candle.close);
  const dmi = calculateDMI(highs, lows, closes);

  assert.ok(dmi.plusDI > dmi.minusDI);
  assert.ok(dmi.adx > 25);
});

test("clean bullish trend returns LONG with ready data", async () => {
  const result = await computeFromCandles(
    makeTrendCandles({ count: 130, step: 1, volumeSpikeAtEnd: true }),
  );

  assert.equal(result.dataQuality.ready, true);
  assert.equal(result.trend, "bullish");
  assert.equal(result.signal, "long");
  assert.ok(result.directionScore >= 0.3);
  assert.ok(result.categoryScores.trend > 0);
  // De-correlated scoring must NOT produce fake near-certainty for a clean trend.
  assert.ok(result.strength < 90);
});

test("clean bearish trend returns SHORT with ready data", async () => {
  const result = await computeFromCandles(
    makeTrendCandles({ count: 130, start: 280, step: -1, volumeSpikeAtEnd: true }),
  );

  assert.equal(result.dataQuality.ready, true);
  assert.equal(result.trend, "bearish");
  assert.equal(result.signal, "short");
  assert.ok(result.directionScore <= -0.3);
  assert.ok(result.categoryScores.trend < 0);
});

test("strong uptrend overbought RSI does not auto-short", async () => {
  const result = await computeFromCandles(makeTrendCandles({ count: 80, step: 1 }));

  assert.notEqual(result.signal, "short");
  assert.ok(result.directionScore > 0);
  assert.ok(
    result.reasons.bullish.some((reason) =>
      reason.includes("momentum can stay extended"),
    ),
  );
});

test("insufficient candle depth forces neutral and caps confidence", async () => {
  const result = await computeFromCandles(makeTrendCandles({ count: 40, step: 1 }));

  assert.equal(result.dataQuality.ready, false);
  assert.equal(result.signal, "neutral");
  assert.ok(result.strength <= 25);
  assert.ok(result.reasons.warnings.some((warning) => warning.includes("requires 120")));
});

test("ranging market stays neutral", async () => {
  const result = await computeFromCandles(makeRangingCandles(80));

  assert.equal(result.trend, "sideways");
  assert.equal(result.signal, "neutral");
});

test("zero-heavy volume marks data unreliable and disables OBV/spike", async () => {
  // Bullish trend but ~half the recent candles report zero volume (crypto-like).
  const candles = makeTrendCandles({ count: 130, step: 1 }).map((candle, i) => ({
    ...candle,
    volume: i % 2 === 0 ? 0 : 1_000,
  }));
  // Force a fake "spike" on the last candle that should be ignored.
  candles[candles.length - 1].volume = 50_000;

  const result = await computeFromCandles(candles);

  assert.equal(result.dataQuality.volumeReliable, false);
  assert.equal(result.indicators.volumeSpike, false);
  assert.equal(result.indicators.obvTrend, "flat");
  assert.ok(
    result.reasons.warnings.some((w) => w.includes("Volume data unreliable")),
  );
  assert.ok(
    [...result.reasons.bullish, ...result.reasons.bearish].every(
      (r) => !r.includes("Volume spike") && !r.includes("OBV"),
    ),
  );
});

test("healthy volume keeps reliability flag on", async () => {
  const result = await computeFromCandles(
    makeTrendCandles({ count: 130, step: 1, volume: 1_000 }),
  );

  assert.equal(result.dataQuality.volumeReliable, true);
});

test("classifyRegime distinguishes the four regimes", async () => {
  const { classifyRegime } = await loadModule(
    "/src/features/engine/indicators.ts",
  );

  const base = {
    strongAdx: 25,
    highVolAtrPercent: 5,
    squeezeBandwidthPercent: 3,
    squeezeMaxAdx: 20,
  };

  assert.equal(
    classifyRegime({ adx: 30, atrPercent: 2, bbBandwidthPercent: 8, ...base }),
    "trending",
  );
  assert.equal(
    classifyRegime({ adx: 15, atrPercent: 2, bbBandwidthPercent: 8, ...base }),
    "ranging",
  );
  assert.equal(
    classifyRegime({ adx: 15, atrPercent: 7, bbBandwidthPercent: 8, ...base }),
    "high_volatility",
  );
  assert.equal(
    classifyRegime({ adx: 12, atrPercent: 1, bbBandwidthPercent: 1.5, ...base }),
    "low_volatility",
  );
});

test("engine exposes a regime on the outlook", async () => {
  const result = await computeFromCandles(
    makeTrendCandles({ count: 130, step: 1 }),
  );

  assert.equal(result.regime, "trending");
});

test("chop/no-trade filter keeps low-volatility squeeze neutral", async () => {
  const result = await computeFromCandles(makeRangingCandles(130));

  assert.equal(result.dataQuality.ready, true);
  assert.equal(result.regime, "low_volatility");
  assert.equal(result.signal, "neutral");
  assert.ok(
    result.reasons.warnings.some((w) => w.includes("Chop/no-trade filter")),
  );
});

test("category scoring still signals when volume is unreliable (weights redistribute)", async () => {
  // Clean bullish trend but every candle has zero volume -> volume category off.
  const candles = makeTrendCandles({ count: 130, step: 1 }).map((c) => ({
    ...c,
    volume: 0,
  }));
  const result = await computeFromCandles(candles);

  assert.equal(result.dataQuality.volumeReliable, false);
  assert.equal(result.categoryScores.volume, 0);
  assert.equal(result.signal, "long");
  assert.ok(result.directionScore >= 0.3);
});

test("conflicting higher timeframe downgrades conviction", async () => {
  const candles = makeTrendCandles({ count: 130, step: 1 });
  const base = await computeFromCandles(candles);
  const conflicted = await computeFromCandles(candles, {
    higherTimeframeTrend: "bearish",
  });

  assert.ok(conflicted.directionScore < base.directionScore);
  assert.ok(
    conflicted.reasons.warnings.some((w) =>
      w.includes("Higher-timeframe trend is bearish"),
    ),
  );
});

test("aligned higher timeframe boosts conviction", async () => {
  const candles = makeTrendCandles({ count: 130, step: 1 });
  const base = await computeFromCandles(candles);
  const aligned = await computeFromCandles(candles, {
    higherTimeframeTrend: "bullish",
  });

  assert.ok(aligned.directionScore >= base.directionScore);
  assert.equal(aligned.signal, "long");
});

test("detectSwingLevels finds fractal pivots", async () => {
  const { detectSwingLevels } = await loadModule(
    "/src/features/engine/indicators.ts",
  );

  const highs = [1, 2, 3, 2, 1];
  const lows = [5, 4, 3, 4, 5];
  const { swingHigh, swingLow } = detectSwingLevels(highs, lows);

  assert.equal(swingHigh, 3);
  assert.equal(swingLow, 3);
});

test("trading plan derives RR from structure distance and clamps it", async () => {
  const { computeTradingPlan } = await loadModule(
    "/src/features/engine/trading-plan.ts",
  );
  const longOutlook = (recentSwingHigh) => ({
    signal: "long",
    indicators: {
      atr: 1,
      support: 0,
      resistance: 0,
      adx: 20,
      recentSwingHigh,
      recentSwingLow: 95,
    },
  });

  const mid = computeTradingPlan(longOutlook(110), 100, "us-stock");
  const far = computeTradingPlan(longOutlook(200), 100, "us-stock");

  assert.ok(mid.stopLoss < 100 && mid.takeProfit1 > 100);
  assert.ok(mid.riskRewardRatio > 1 && mid.riskRewardRatio <= 4);
  // A farther structural target implies a larger reward-to-risk.
  assert.ok(far.riskRewardRatio > mid.riskRewardRatio);
  assert.ok(far.riskRewardRatio <= 4);
});

test("trading plan falls back cleanly with thin data", async () => {
  const { computeTradingPlan } = await loadModule(
    "/src/features/engine/trading-plan.ts",
  );
  const plan = computeTradingPlan(
    {
      signal: "long",
      indicators: {
        atr: 0,
        support: 0,
        resistance: 0,
        adx: 20,
        recentSwingHigh: 0,
        recentSwingLow: 0,
      },
    },
    100,
    "crypto",
  );

  assert.ok(plan !== null);
  assert.ok(plan.stopLoss < 100 && plan.takeProfit1 > 100);
  assert.ok(plan.riskRewardRatio >= 1);
});

async function runBacktestOn(candles, options = {}) {
  const { runBacktest } = await loadModule(
    "/src/features/engine/backtest.ts",
  );
  return runBacktest(candles, { assetType: "us-stock", timeframe: "swing", ...options });
}

test("backtest reports a profitable uptrend with valid metrics", async () => {
  const { metrics, trades } = await runBacktestOn(
    makeTrendCandles({ count: 300, step: 2 }),
  );

  assert.ok(metrics.trades > 0);
  assert.ok(metrics.winRate >= 0 && metrics.winRate <= 1);
  assert.ok(metrics.expectancy > 0);
  assert.ok(metrics.maxDrawdownR >= 0);
  // No lookahead: every entry fills at the entry bar's open.
  assert.ok(trades.every((t) => t.entryIndex >= 120));
});

test("backtest has no lookahead: future candles do not change past entries", async () => {
  const candles = makeTrendCandles({ count: 300, step: 2 });
  const { trades } = await runBacktestOn(candles);
  assert.ok(trades.length > 0);
  const first = trades[0];

  // Corrupt everything AFTER the first trade's entry bar, then re-run.
  const corrupted = candles.map((c, i) =>
    i > first.entryIndex
      ? { ...c, open: 1, high: 1, low: 1, close: 1 }
      : c,
  );
  const { trades: after } = await runBacktestOn(corrupted);

  assert.ok(after.length > 0);
  assert.equal(after[0].entryIndex, first.entryIndex);
  assert.equal(after[0].entryPrice, first.entryPrice);
  assert.equal(after[0].direction, first.direction);
});
