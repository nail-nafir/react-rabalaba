import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

// Edge-case coverage for the technical indicators. These hunt the numerical
// boundaries that are easy to get wrong: empty arrays, single elements, lengths
// below the indicator period, division-by-zero, NaN/Infinity propagation, and
// flat/monotonic degenerate series. All loaded against the real .ts modules via
// Vite SSR so we test the shipping code, not a copy.

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

const IND = "/src/features/engine/indicators.ts";

const ramp = (n, start = 1, step = 1) =>
  Array.from({ length: n }, (_, i) => start + step * i);
const allFinite = (arr) => arr.every((v) => Number.isFinite(v));

// ─── calculateRSI ────────────────────────────────────────────
test("calculateRSI: empty array → neutral 50", async () => {
  const { calculateRSI } = await loadModule(IND);
  assert.equal(calculateRSI([]), 50);
});

test("calculateRSI: single element → 50", async () => {
  const { calculateRSI } = await loadModule(IND);
  assert.equal(calculateRSI([100]), 50);
});

test("calculateRSI: length === period (one short) → 50 fallback", async () => {
  const { calculateRSI } = await loadModule(IND);
  assert.equal(calculateRSI(ramp(14)), 50); // needs period + 1
});

test("calculateRSI: all gains (no losses) → 100", async () => {
  const { calculateRSI } = await loadModule(IND);
  assert.equal(calculateRSI(ramp(20)), 100);
});

test("calculateRSI: all losses (no gains) → 0", async () => {
  const { calculateRSI } = await loadModule(IND);
  assert.equal(calculateRSI(ramp(20, 20, -1)), 0);
});

test("calculateRSI: flat market → 50", async () => {
  const { calculateRSI } = await loadModule(IND);
  assert.equal(calculateRSI(Array(40).fill(100)), 50);
});

test("calculateRSI: mixed series → finite within [0,100]", async () => {
  const { calculateRSI } = await loadModule(IND);
  const v = calculateRSI([1, 3, 2, 5, 4, 7, 6, 9, 8, 11, 10, 13, 12, 15, 14, 17]);
  assert.ok(Number.isFinite(v) && v >= 0 && v <= 100);
});

// ─── calculateEMA ────────────────────────────────────────────
test("calculateEMA: empty array → 0 (no crash)", async () => {
  const { calculateEMA } = await loadModule(IND);
  assert.equal(calculateEMA([], 10), 0);
});

test("calculateEMA: length < period → last price fallback", async () => {
  const { calculateEMA } = await loadModule(IND);
  assert.equal(calculateEMA([100, 101, 102], 10), 102);
});

test("calculateEMA: constant series → that constant", async () => {
  const { calculateEMA } = await loadModule(IND);
  assert.equal(calculateEMA(Array(30).fill(50), 10), 50);
});

// ─── calculateEMASeries ──────────────────────────────────────
test("calculateEMASeries: empty array → empty result", async () => {
  const { calculateEMASeries } = await loadModule(IND);
  assert.deepEqual(calculateEMASeries([], 10), []);
});

test("calculateEMASeries: length < period → no NaN, same length", async () => {
  const { calculateEMASeries } = await loadModule(IND);
  const out = calculateEMASeries([10, 20, 30], 10);
  assert.equal(out.length, 3);
  assert.ok(allFinite(out));
});

test("calculateEMASeries: result length always equals input length", async () => {
  const { calculateEMASeries } = await loadModule(IND);
  const out = calculateEMASeries(ramp(50), 12);
  assert.equal(out.length, 50);
  assert.ok(allFinite(out));
});

// ─── calculateMACD ───────────────────────────────────────────
test("calculateMACD: insufficient data → all zeros", async () => {
  const { calculateMACD } = await loadModule(IND);
  assert.deepEqual(calculateMACD(ramp(20)), {
    macdLine: 0,
    signalLine: 0,
    histogram: 0,
  });
});

test("calculateMACD: constant series → ~0 lines, finite", async () => {
  const { calculateMACD } = await loadModule(IND);
  const m = calculateMACD(Array(60).fill(100));
  assert.ok(Number.isFinite(m.macdLine) && Math.abs(m.macdLine) < 1e-6);
  assert.ok(Number.isFinite(m.histogram));
});

test("calculateMACD: trending series → finite values", async () => {
  const { calculateMACD } = await loadModule(IND);
  const m = calculateMACD(ramp(60));
  assert.ok(allFinite([m.macdLine, m.signalLine, m.histogram]));
});

// ─── calculateSMA ────────────────────────────────────────────
test("calculateSMA: empty array → 0", async () => {
  const { calculateSMA } = await loadModule(IND);
  assert.equal(calculateSMA([], 5), 0);
});

test("calculateSMA: length < period → mean of all", async () => {
  const { calculateSMA } = await loadModule(IND);
  assert.equal(calculateSMA([10, 20, 30], 5), 20);
});

// ─── calculateBollingerBands ─────────────────────────────────
test("calculateBollingerBands: empty array → zeros, percentB 0.5", async () => {
  const { calculateBollingerBands } = await loadModule(IND);
  const b = calculateBollingerBands([]);
  assert.deepEqual(b, { upper: 0, middle: 0, lower: 0, percentB: 0.5 });
});

test("calculateBollingerBands: length < period → flat bands at last price", async () => {
  const { calculateBollingerBands } = await loadModule(IND);
  const b = calculateBollingerBands([100, 101, 102], 20);
  assert.equal(b.upper, 102);
  assert.equal(b.middle, 102);
  assert.equal(b.lower, 102);
  assert.equal(b.percentB, 0.5);
});

test("calculateBollingerBands: constant series → collapsed bands, percentB 0.5", async () => {
  const { calculateBollingerBands } = await loadModule(IND);
  const b = calculateBollingerBands(Array(25).fill(100));
  assert.equal(b.upper, 100);
  assert.equal(b.lower, 100);
  assert.equal(b.percentB, 0.5); // bandWidth 0 → guarded, not NaN
});

test("calculateBollingerBands: upside spike → percentB > 1", async () => {
  const { calculateBollingerBands } = await loadModule(IND);
  const prices = [...Array(19).fill(100), 130];
  const b = calculateBollingerBands(prices, 20);
  assert.ok(b.percentB > 1 && Number.isFinite(b.percentB));
});

test("calculateBollingerBands: downside crash → percentB < 0", async () => {
  const { calculateBollingerBands } = await loadModule(IND);
  const prices = [...Array(19).fill(100), 70];
  const b = calculateBollingerBands(prices, 20);
  assert.ok(b.percentB < 0 && Number.isFinite(b.percentB));
});

// ─── calculateStochRSI ───────────────────────────────────────
test("calculateStochRSI: insufficient data → 50", async () => {
  const { calculateStochRSI } = await loadModule(IND);
  assert.equal(calculateStochRSI(ramp(20)), 50);
});

test("calculateStochRSI: constant series → 50 (max==min guard)", async () => {
  const { calculateStochRSI } = await loadModule(IND);
  assert.equal(calculateStochRSI(Array(40).fill(100)), 50);
});

test("calculateStochRSI: oscillating series → finite within [0,100]", async () => {
  const { calculateStochRSI } = await loadModule(IND);
  const prices = Array.from({ length: 50 }, (_, i) => 100 + (i % 2 ? 5 : -5) + i * 0.1);
  const v = calculateStochRSI(prices);
  assert.ok(Number.isFinite(v) && v >= 0 && v <= 100);
});

// ─── calculateDMI ────────────────────────────────────────────
test("calculateDMI: insufficient data → zeros", async () => {
  const { calculateDMI } = await loadModule(IND);
  assert.deepEqual(calculateDMI(ramp(10), ramp(10), ramp(10)), {
    adx: 0,
    plusDI: 0,
    minusDI: 0,
  });
});

test("calculateDMI: flat series → no NaN, adx 0", async () => {
  const { calculateDMI } = await loadModule(IND);
  const flat = Array(40).fill(100);
  const d = calculateDMI(flat, flat, flat);
  assert.ok(allFinite([d.adx, d.plusDI, d.minusDI]));
  assert.equal(d.adx, 0);
});

test("calculateDMI: mismatched lengths use min length (→ zeros if too short)", async () => {
  const { calculateDMI } = await loadModule(IND);
  const d = calculateDMI(ramp(40), ramp(5), ramp(40));
  assert.deepEqual(d, { adx: 0, plusDI: 0, minusDI: 0 });
});

// ─── calculateATR ────────────────────────────────────────────
test("calculateATR: insufficient data → 0", async () => {
  const { calculateATR } = await loadModule(IND);
  assert.equal(calculateATR(ramp(10), ramp(10), ramp(10)), 0);
});

test("calculateATR: flat series → 0", async () => {
  const { calculateATR } = await loadModule(IND);
  const flat = Array(40).fill(100);
  assert.equal(calculateATR(flat, flat, flat), 0);
});

test("calculateATR: always non-negative for noisy series", async () => {
  const { calculateATR } = await loadModule(IND);
  const highs = Array.from({ length: 40 }, (_, i) => 100 + (i % 3) + 1);
  const lows = Array.from({ length: 40 }, (_, i) => 100 + (i % 3) - 1);
  const closes = Array.from({ length: 40 }, (_, i) => 100 + (i % 3));
  const atr = calculateATR(highs, lows, closes);
  assert.ok(Number.isFinite(atr) && atr >= 0);
});

// ─── calculateOBVTrend ───────────────────────────────────────
test("calculateOBVTrend: insufficient data → flat", async () => {
  const { calculateOBVTrend } = await loadModule(IND);
  assert.equal(calculateOBVTrend([1, 2, 3], [1, 1, 1]), "flat");
});

test("calculateOBVTrend: zero volume → flat (avgOBV 0 guard)", async () => {
  const { calculateOBVTrend } = await loadModule(IND);
  assert.equal(calculateOBVTrend(ramp(20), Array(20).fill(0)), "flat");
});

test("calculateOBVTrend: rising price + volume → rising", async () => {
  const { calculateOBVTrend } = await loadModule(IND);
  assert.equal(calculateOBVTrend(ramp(20), Array(20).fill(100)), "rising");
});

test("calculateOBVTrend: falling price + volume → falling", async () => {
  const { calculateOBVTrend } = await loadModule(IND);
  assert.equal(calculateOBVTrend(ramp(20, 20, -1), Array(20).fill(100)), "falling");
});

test("calculateOBVTrend: mismatched lengths use min length safely", async () => {
  const { calculateOBVTrend } = await loadModule(IND);
  const out = calculateOBVTrend(ramp(20), Array(5).fill(100));
  assert.equal(out, "flat"); // min length 5 < lookback+1
});

// ─── calculateRSISeries ──────────────────────────────────────
test("calculateRSISeries: too short → empty array", async () => {
  const { calculateRSISeries } = await loadModule(IND);
  assert.deepEqual(calculateRSISeries(ramp(10)), []);
});

test("calculateRSISeries: length === period → empty (needs period+1)", async () => {
  const { calculateRSISeries } = await loadModule(IND);
  assert.deepEqual(calculateRSISeries(ramp(14)), []);
});

test("calculateRSISeries: all values finite within [0,100]", async () => {
  const { calculateRSISeries } = await loadModule(IND);
  const series = calculateRSISeries(
    Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i) * 5),
  );
  assert.ok(series.length > 0);
  assert.ok(series.every((v) => Number.isFinite(v) && v >= 0 && v <= 100));
});

test("calculateRSISeries: flat market → all 50", async () => {
  const { calculateRSISeries } = await loadModule(IND);
  const series = calculateRSISeries(Array(40).fill(100));
  assert.ok(series.every((v) => v === 50));
});

test("calculateRSISeries: tail value matches single calculateRSI", async () => {
  const { calculateRSISeries, calculateRSI } = await loadModule(IND);
  const prices = Array.from({ length: 60 }, (_, i) => 100 + i * 0.7 + (i % 5));
  const series = calculateRSISeries(prices);
  const tail = series[series.length - 1];
  assert.ok(Math.abs(tail - calculateRSI(prices)) < 1e-9);
});

// ─── detectRSIDivergence ─────────────────────────────────────
test("detectRSIDivergence: short arrays → none", async () => {
  const { detectRSIDivergence } = await loadModule(IND);
  assert.equal(detectRSIDivergence(ramp(10), ramp(10)), "none");
});

test("detectRSIDivergence: flat series → none", async () => {
  const { detectRSIDivergence } = await loadModule(IND);
  const flat = Array(40).fill(100);
  assert.equal(detectRSIDivergence(flat, flat), "none");
});

test("detectRSIDivergence: monotonic series → none (no two extrema)", async () => {
  const { detectRSIDivergence } = await loadModule(IND);
  assert.equal(detectRSIDivergence(ramp(40), ramp(40, 10, 1)), "none");
});

test("detectRSIDivergence: returns one of the three labels", async () => {
  const { detectRSIDivergence } = await loadModule(IND);
  const prices = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 2) * 8);
  const rsi = Array.from({ length: 40 }, (_, i) => 50 + Math.cos(i / 2) * 20);
  const out = detectRSIDivergence(prices, rsi);
  assert.ok(["bullish", "bearish", "none"].includes(out));
});

// ─── calculateFibLevels ──────────────────────────────────────
test("calculateFibLevels: high == low → all equal, no NaN", async () => {
  const { calculateFibLevels } = await loadModule(IND);
  const f = calculateFibLevels(100, 100);
  assert.ok(Object.values(f).every((v) => v === 100));
});

test("calculateFibLevels: levels strictly ordered low→high", async () => {
  const { calculateFibLevels } = await loadModule(IND);
  const f = calculateFibLevels(200, 100);
  assert.ok(f[0] <= f[0.236] && f[0.236] <= f[0.382]);
  assert.ok(f[0.382] <= f[0.5] && f[0.5] <= f[0.618]);
  assert.ok(f[0.618] <= f[0.786] && f[0.786] <= f[1]);
});

test("calculateFibLevels: BTC-scale values stay finite", async () => {
  const { calculateFibLevels } = await loadModule(IND);
  const f = calculateFibLevels(72000, 38000);
  assert.ok(Object.values(f).every((v) => Number.isFinite(v)));
});

// ─── detectSwingLevels ───────────────────────────────────────
test("detectSwingLevels: empty arrays → {0,0}", async () => {
  const { detectSwingLevels } = await loadModule(IND);
  assert.deepEqual(detectSwingLevels([], []), { swingHigh: 0, swingLow: 0 });
});

test("detectSwingLevels: single element → that bar", async () => {
  const { detectSwingLevels } = await loadModule(IND);
  assert.deepEqual(detectSwingLevels([5], [3]), { swingHigh: 5, swingLow: 3 });
});

test("detectSwingLevels: n < 5 → last bar values", async () => {
  const { detectSwingLevels } = await loadModule(IND);
  assert.deepEqual(detectSwingLevels([1, 2, 3, 4], [4, 3, 2, 1]), {
    swingHigh: 4,
    swingLow: 1,
  });
});

test("detectSwingLevels: mismatched lengths use min length", async () => {
  const { detectSwingLevels } = await loadModule(IND);
  assert.deepEqual(detectSwingLevels(ramp(10), [7]), { swingHigh: 1, swingLow: 7 });
});

test("detectSwingLevels: fractal pivot detected", async () => {
  const { detectSwingLevels } = await loadModule(IND);
  assert.deepEqual(detectSwingLevels([1, 2, 3, 2, 1], [5, 4, 3, 4, 5]), {
    swingHigh: 3,
    swingLow: 3,
  });
});

test("detectSwingLevels: monotonic → falls back to window extremes", async () => {
  const { detectSwingLevels } = await loadModule(IND);
  const out = detectSwingLevels([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]);
  assert.equal(out.swingHigh, 5);
  assert.equal(out.swingLow, 1);
});

// ─── calculatePivotLevels ────────────────────────────────────
test("calculatePivotLevels: equal H/L/C → support == resistance == close", async () => {
  const { calculatePivotLevels } = await loadModule(IND);
  const p = calculatePivotLevels(100, 100, 100);
  assert.equal(p.support, 100);
  assert.equal(p.resistance, 100);
});

test("calculatePivotLevels: support < close < resistance for a normal bar", async () => {
  const { calculatePivotLevels } = await loadModule(IND);
  const p = calculatePivotLevels(110, 90, 100);
  assert.ok(p.support < 100 && 100 < p.resistance);
});

test("calculatePivotLevels: BTC-scale stays finite", async () => {
  const { calculatePivotLevels } = await loadModule(IND);
  const p = calculatePivotLevels(72000, 68000, 70000);
  assert.ok(Number.isFinite(p.support) && Number.isFinite(p.resistance));
});

// ─── calculateCLV ────────────────────────────────────────────
test("calculateCLV: close at high → +1, at low → −1, midpoint → 0", async () => {
  const { calculateCLV } = await loadModule(IND);
  assert.equal(calculateCLV(12, 8, 12), 1);
  assert.equal(calculateCLV(12, 8, 8), -1);
  assert.equal(calculateCLV(12, 8, 10), 0);
});

test("calculateCLV: zero-range bar (H === L) → 0, no division by zero", async () => {
  const { calculateCLV } = await loadModule(IND);
  assert.equal(calculateCLV(10, 10, 10), 0);
});

// ─── calculateCMF / calculateADDelta ─────────────────────────
// Hand-computed 4-bar fixture. CLV per bar: 0, +1, −1, +0.5; volumes
// 100/200/100/200 → Σ(CLV×vol)/Σvol = (0 + 200 − 100 + 100) / 600 = 1/3.
const FLOW_HIGHS = [10, 12, 10, 10];
const FLOW_LOWS = [8, 8, 6, 8];
const FLOW_CLOSES = [9, 12, 6, 9.5];
const FLOW_VOLUMES = [100, 200, 100, 200];

test("calculateCMF: hand-computed 4-bar fixture → 1/3", async () => {
  const { calculateCMF } = await loadModule(IND);
  const v = calculateCMF(FLOW_HIGHS, FLOW_LOWS, FLOW_CLOSES, FLOW_VOLUMES, 4);
  assert.ok(Math.abs(v - 1 / 3) < 1e-12);
});

test("calculateADDelta: window restriction — last 2 bars of the fixture → 0", async () => {
  const { calculateADDelta } = await loadModule(IND);
  // Bars 3-4 only: (−1×100 + 0.5×200) / 300 = 0.
  const v = calculateADDelta(FLOW_HIGHS, FLOW_LOWS, FLOW_CLOSES, FLOW_VOLUMES, 2);
  assert.equal(v, 0);
});

test("calculateADDelta: zero volume in window → 0, empty input → 0", async () => {
  const { calculateADDelta } = await loadModule(IND);
  assert.equal(calculateADDelta([12, 12], [8, 8], [10, 11], [0, 0], 2), 0);
  assert.equal(calculateADDelta([], [], [], [], 20), 0);
});

test("calculateADDelta: result bounded to [-1..1] even on extreme bars", async () => {
  const { calculateADDelta } = await loadModule(IND);
  // Every close at its high → CLV +1 on every bar → exactly +1.
  const v = calculateADDelta([10, 20], [5, 10], [10, 20], [1e9, 1e9], 2);
  assert.equal(v, 1);
});

// ─── calculateMFI ────────────────────────────────────────────
test("calculateMFI: hand-computed 5-bar fixture (period 4) → 62.5", async () => {
  const { calculateMFI } = await loadModule(IND);
  // Typical prices: 9, 10, 11, 8, 9 → flows +2000, +1100, −2400, +900
  // → MFI = 100 − 100 / (1 + 4000/2400) = 62.5.
  const v = calculateMFI(
    [10, 11, 12, 9, 10],
    [8, 9, 10, 7, 8],
    [9, 10, 11, 8, 9],
    [100, 200, 100, 300, 100],
    4,
  );
  assert.ok(Math.abs(v - 62.5) < 1e-12);
});

test("calculateMFI: not enough data → neutral 50", async () => {
  const { calculateMFI } = await loadModule(IND);
  assert.equal(calculateMFI([10], [8], [9], [100], 14), 50);
  assert.equal(calculateMFI([], [], [], [], 14), 50);
});

test("calculateMFI: flat typical prices → no flow → 50", async () => {
  const { calculateMFI } = await loadModule(IND);
  const flat = Array(10).fill(10);
  assert.equal(calculateMFI(flat, flat, flat, Array(10).fill(100), 4), 50);
});

test("calculateMFI: only positive flow → 100", async () => {
  const { calculateMFI } = await loadModule(IND);
  const highs = ramp(10, 11);
  const lows = ramp(10, 9);
  const closes = ramp(10, 10);
  const v = calculateMFI(highs, lows, closes, Array(10).fill(100), 4);
  assert.equal(v, 100);
});
