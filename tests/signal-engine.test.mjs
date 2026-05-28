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
    "/src/features/signals/engine/signal-engine.ts",
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
  const { calculateRSI, calculateDMI, calculateADX } = await loadModule(
    "/src/features/signals/engine/indicators.ts",
  );

  assert.equal(calculateRSI(Array(40).fill(100)), 50);

  const candles = makeTrendCandles({ count: 80, step: 1 });
  const highs = candles.map((candle) => candle.high);
  const lows = candles.map((candle) => candle.low);
  const closes = candles.map((candle) => candle.close);
  const dmi = calculateDMI(highs, lows, closes);

  assert.ok(dmi.plusDI > dmi.minusDI);
  assert.ok(dmi.adx > 25);
  assert.equal(calculateADX(highs, lows, closes), dmi.adx);
});

test("clean bullish trend returns LONG with ready data", async () => {
  const result = await computeFromCandles(
    makeTrendCandles({ count: 80, step: 1, volumeSpikeAtEnd: true }),
  );

  assert.equal(result.dataQuality.ready, true);
  assert.equal(result.trend, "bullish");
  assert.equal(result.signal, "long");
  assert.ok(result.score >= 3.25);
});

test("clean bearish trend returns SHORT with ready data", async () => {
  const result = await computeFromCandles(
    makeTrendCandles({ count: 80, start: 180, step: -1, volumeSpikeAtEnd: true }),
  );

  assert.equal(result.dataQuality.ready, true);
  assert.equal(result.trend, "bearish");
  assert.equal(result.signal, "short");
  assert.ok(result.score <= -3.25);
});

test("strong uptrend overbought RSI does not auto-short", async () => {
  const result = await computeFromCandles(makeTrendCandles({ count: 80, step: 1 }));

  assert.notEqual(result.signal, "short");
  assert.ok(result.score > 0);
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
  assert.ok(result.confidence <= 25);
  assert.ok(result.reasons.warnings.some((warning) => warning.includes("requires 50")));
});

test("ranging market stays neutral", async () => {
  const result = await computeFromCandles(makeRangingCandles(80));

  assert.equal(result.trend, "neutral");
  assert.equal(result.signal, "neutral");
});
