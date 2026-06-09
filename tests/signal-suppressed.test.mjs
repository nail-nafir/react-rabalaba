import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

// Tests for the `suppressed` flag on Outlook: it must be true exactly when a
// real directional lean (long/short) was forced back to NEUTRAL by the
// counter-trend guard or the chop/no-trade filter, and false otherwise. The UI
// relies on this to explain a high-tier NEUTRAL ("strong lean, held back").

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

function makeTrendCandles({ count, start = 100, step = 1, volume = 1_000 }) {
  return Array.from({ length: count }, (_, index) => {
    const close = start + step * index;
    const previousClose = index === 0 ? close - step : start + step * (index - 1);
    return {
      open: previousClose,
      high: Math.max(close, previousClose) + Math.abs(step || 1) * 0.8,
      low: Math.min(close, previousClose) - Math.abs(step || 1) * 0.8,
      close,
      volume,
      timestamp: index + 1,
    };
  });
}

function makeRangingCandles(count) {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + (index % 2 === 0 ? 0.2 : -0.2);
    return { open: 100, high: close + 0.5, low: close - 0.5, close, volume: 1_000, timestamp: index + 1 };
  });
}

function candlesFromCloses(closes) {
  return closes.map((close, i) => {
    const prev = i === 0 ? close : closes[i - 1];
    const spread = Math.abs(close - prev) * 0.5 + Math.abs(close) * 0.003 + 0.5;
    return {
      open: prev,
      high: Math.max(close, prev) + spread,
      low: Math.min(close, prev) - spread,
      close,
      volume: 1500,
      timestamp: i + 1,
    };
  });
}

// Deterministic fixture (found via random search over 4000 walks): a low-volatility
// squeeze whose momentum still pushed the raw score past the short threshold, so the
// chop/no-trade filter forces it back to NEUTRAL and flags it suppressed. This is the
// rare-but-real state the flag exists to describe.
const SQUEEZE_SUPPRESSED_CLOSES = [
  162.8152, 162.282, 163.2436, 163.2352, 163.1596, 162.8788, 161.9834, 162.5715,
  163.6656, 163.1645, 163.0693, 163.7419, 162.7516, 162.7691, 163.034, 163.2528,
  164.0599, 163.2896, 164.5349, 165.0049, 164.5004, 165.6016, 165.7881, 166.1942,
  166.0987, 167.3071, 166.2659, 165.8811, 166.0631, 167.2942, 166.9751, 166.3418,
  167.2456, 166.8358, 167.0303, 167.8879, 167.4847, 167.0404, 167.3102, 167.1579,
  167.038, 168.0391, 167.9779, 167.3079, 167.4687, 167.32, 166.6716, 167.6875,
  168.8, 167.6287, 167.5131, 168.1923, 168.3239, 168.3867, 168.9066, 169.4124,
  169.9059, 169.3773, 168.6528, 168.1418, 168.0968, 167.9536, 168.6437, 167.7332,
  167.8767, 168.8049, 167.6138, 167.5897, 167.9459, 168.5375, 168.0041, 168.1111,
  167.8349, 168.4943, 168.1744, 167.4254, 168.5583, 169.0986, 168.8738, 169.511,
  168.4877, 167.5104, 168.0292, 166.9011, 166.2346, 167.3935, 168.1726, 167.7475,
  166.6195, 167.2071, 167.0341, 167.1636, 166.8661, 167.9184, 167.3418, 167.7136,
  166.5185, 165.3954, 164.43, 165.5757, 166.2673, 166.7806, 166.865, 166.9792,
  167.8341, 167.491, 166.6171, 166.0192, 166.3675, 166.4605, 166.7925, 167.3642,
  166.1278, 165.3136, 164.6857, 165.1984, 165.1204, 164.2834, 164.8761, 165.8298,
  165.4074, 165.3738, 166.6299, 167.3314, 166.5026, 165.7474, 164.7787, 164.4916,
  163.5746, 164.7523,
];

async function computeFromCandles(candles, options = {}) {
  const { computeSignal } = await loadModule("/src/features/engine/signals.ts");
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

test("suppressed is always a boolean on the outlook", async () => {
  const result = await computeFromCandles(makeTrendCandles({ count: 130, step: 1 }));
  assert.equal(typeof result.suppressed, "boolean");
});

test("clean trending LONG is not suppressed", async () => {
  const result = await computeFromCandles(makeTrendCandles({ count: 130, step: 1 }));
  assert.equal(result.signal, "long");
  assert.equal(result.suppressed, false);
});

test("plain ranging neutral (no directional lean) is not suppressed", async () => {
  const result = await computeFromCandles(makeRangingCandles(130));
  assert.equal(result.signal, "neutral");
  // No lean crossed the threshold, so nothing was suppressed.
  assert.equal(result.suppressed, false);
});

test("createUnavailableSignal is not suppressed", async () => {
  const { createUnavailableSignal } = await loadModule("/src/features/engine/signals.ts");
  assert.equal(createUnavailableSignal(50).suppressed, false);
});

test("chop filter holds a squeeze lean to NEUTRAL and flags it suppressed", async () => {
  const result = await computeFromCandles(candlesFromCloses(SQUEEZE_SUPPRESSED_CLOSES));
  assert.equal(result.regime, "low_volatility");
  assert.equal(result.signal, "neutral");
  assert.equal(result.suppressed, true);
  // The raw lean genuinely crossed the threshold before being held back.
  assert.ok(Math.abs(result.directionScore) >= 0.3);
  assert.ok(
    result.reasons.warnings.some((w) => w.includes("Chop/no-trade filter")),
  );
});

test("invariant: suppressed === true implies signal is neutral", async () => {
  const scenarios = [
    makeTrendCandles({ count: 130, step: 1 }),
    makeTrendCandles({ count: 130, step: -1, start: 300 }),
    makeRangingCandles(130),
    candlesFromCloses(SQUEEZE_SUPPRESSED_CLOSES),
  ];
  for (const candles of scenarios) {
    const r = await computeFromCandles(candles);
    if (r.suppressed) assert.equal(r.signal, "neutral");
  }
});
