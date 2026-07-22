import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

// Swallow stray async rejections emitted while Vite's SSR server tears down at
// end-of-file. Real test failures surface synchronously as assertion errors.
process.on("unhandledRejection", () => {});

let server;

async function loadModule(path) {
  if (!server) {
    server = await createServer({
      appType: "custom",
      configFile: "vite.config.ts",
      logLevel: "silent",
      server: { middlewareMode: true, watch: null },
    });
  }
  return server.ssrLoadModule(path);
}

test.after(async () => {
  try {
    if (server) await server.close();
  } catch {
    // Vite's SSR server can reject on teardown; not a test failure.
  }
});

const DAY = 86_400;
// Distinct UTC days so the daily resampler treats each candle as one day.
const T0 = Date.UTC(2024, 0, 1) / 1000;

/**
 * Daily candle fixture with a deliberate flow signature: alternating up/down
 * closes where up days close AT their high (CLV +1) on `upVolumeMult`× base
 * volume and down days close AT their low (CLV −1) on `downVolumeMult`×.
 * upVolumeMult > downVolumeMult reads as accumulation; flipped reads as
 * distribution.
 */
function makeFlowCandles({
  days = 21,
  upVolumeMult = 3,
  downVolumeMult = 0.5,
} = {}) {
  const candles = [];
  let price = 1000;
  const baseVolume = 1_000_000;
  for (let i = 0; i < days; i++) {
    const up = i % 2 === 0;
    const open = price;
    const close = up ? price * 1.02 : price * 0.99;
    candles.push({
      open,
      high: Math.max(open, close),
      low: Math.min(open, close),
      close,
      volume: baseVolume * (up ? upVolumeMult : downVolumeMult),
      timestamp: T0 + i * DAY,
    });
    price = close;
  }
  return candles;
}

function makeOutlook(overrides = {}) {
  return {
    signal: "long",
    strength: 50,
    technicalAlignment: "weak",
    tier: "C",
    risk: "medium",
    trend: "bullish",
    regime: "trending",
    higherTimeframeTrend: "sideways",
    directionScore: 0.5,
    categoryScores: { trend: 0.5, momentum: 0.3, volatility: 0.1, volume: 0.1 },
    reasons: { bullish: [], bearish: [], warnings: [] },
    dataQuality: {
      candleCount: 130,
      ready: true,
      missingVolume: false,
      volumeReliable: true,
    },
    indicators: {},
    analysis: { trend: "", volume: "", momentum: "" },
    ...overrides,
  };
}

test("deriveAccumulation: volume-heavy up days read as accumulation", async () => {
  const { deriveAccumulation } = await loadModule(
    "/src/features/engine/accumulation.ts",
  );
  const acc = deriveAccumulation(makeFlowCandles({ days: 21 }));
  assert.ok(acc, "derivable from 21 daily candles");
  assert.ok(acc.score > 0, "net buying pressure → positive score");
  assert.match(acc.label, /accumulation/i);
  assert.equal(acc.daysAnalyzed, 21);
  assert.ok(acc.reliable, "no zero-volume days → reliable");
  assert.ok(acc.breakdown.cmf > 0);
  assert.ok(acc.breakdown.upDownVolume > 0);
});

test("deriveAccumulation: volume-heavy down days read as distribution", async () => {
  const { deriveAccumulation } = await loadModule(
    "/src/features/engine/accumulation.ts",
  );
  const acc = deriveAccumulation(
    makeFlowCandles({ days: 21, upVolumeMult: 0.5, downVolumeMult: 3 }),
  );
  assert.ok(acc);
  assert.ok(acc.score < 0, "net selling pressure → negative score");
  assert.match(acc.label, /distribution/i);
});

test("deriveAccumulation: too little daily history → null", async () => {
  const { deriveAccumulation } = await loadModule(
    "/src/features/engine/accumulation.ts",
  );
  assert.equal(deriveAccumulation(makeFlowCandles({ days: 14 })), null);
  assert.equal(deriveAccumulation([]), null);
});

test("deriveAccumulation: too many zero-volume days → null (honesty gate)", async () => {
  const { deriveAccumulation } = await loadModule(
    "/src/features/engine/accumulation.ts",
  );
  const candles = makeFlowCandles({ days: 21 });
  // 8 of 21 days (≈38%) with zero volume crosses the 30% gate.
  for (let i = 0; i < 8; i++) candles[i].volume = 0;
  assert.equal(deriveAccumulation(candles), null);
});

test("applyAccumulation boosts agreement, dampens opposition, bounded ±15%, immutably", async () => {
  const { applyAccumulation } = await loadModule(
    "/src/features/engine/accumulation.ts",
  );
  const outlook = makeOutlook({
    signal: "long",
    directionScore: 0.5,
    strength: 50,
  });
  const breakdown = {
    adFlow: 0,
    cmf: 0,
    mfi: 50,
    upDownVolume: 0,
    spikeBias: 0,
  };
  const supportive = {
    score: 0.8,
    label: "Strong accumulation",
    breakdown,
    daysAnalyzed: 21,
    reliable: true,
  };
  const opposing = {
    score: -0.8,
    label: "Strong distribution",
    breakdown,
    daysAnalyzed: 21,
    reliable: true,
  };

  const up = applyAccumulation(outlook, supportive);
  const down = applyAccumulation(outlook, opposing);

  assert.ok(up.strength > 50, "agreement boosts conviction");
  assert.ok(down.strength < 50, "opposition dampens conviction");
  assert.ok(up.reasons.warnings.some((w) => w.includes("supports")));
  assert.ok(down.reasons.warnings.some((w) => w.includes("dampened")));
  // Bounded to ±15%.
  assert.ok(up.strength <= Math.round(50 * 1.15));
  assert.ok(down.strength >= Math.round(50 * 0.85));
  // Signal itself never flips.
  assert.equal(down.signal, "long");
  // Original untouched (lives in react-query cache).
  assert.equal(outlook.strength, 50);
  assert.equal(outlook.reasons.warnings.length, 0);
});

test("applyAccumulation leaves neutral signals untouched", async () => {
  const { applyAccumulation } = await loadModule(
    "/src/features/engine/accumulation.ts",
  );
  const neutral = makeOutlook({ signal: "neutral", strength: 10 });
  const out = applyAccumulation(neutral, {
    score: 0.9,
    label: "Strong accumulation",
    breakdown: { adFlow: 0, cmf: 0, mfi: 50, upDownVolume: 0, spikeBias: 0 },
    daysAnalyzed: 21,
    reliable: true,
  });
  assert.equal(out, neutral, "same reference — nothing applied");
});

test("isNeutralFlow recognizes only the neutral label", async () => {
  const { isNeutralFlow, NEUTRAL_FLOW_LABEL } = await loadModule(
    "/src/features/engine/accumulation.ts",
  );
  assert.equal(isNeutralFlow(NEUTRAL_FLOW_LABEL), true);
  assert.equal(isNeutralFlow("Accumulation"), false);
});

test("supportsAccumulation gates volume-reliable equities only", async () => {
  const { supportsAccumulation } = await loadModule(
    "/src/features/engine/accumulation.ts",
  );
  // Equities with reliable daily volume — flow read applies.
  assert.equal(supportsAccumulation("id-stock"), true);
  assert.equal(supportsAccumulation("us-stock"), true);
  // Crypto uses smart-money; forex has no real volume; commodity is too patchy.
  assert.equal(supportsAccumulation("crypto"), false);
  assert.equal(supportsAccumulation("forex"), false);
  assert.equal(supportsAccumulation("commodity"), false);
});

test("resampleCandlesToDaily merges same-UTC-day bars (OHLC first/max/min/last, volume sum)", async () => {
  const { resampleCandlesToDaily } = await loadModule(
    "/src/services/adapters/yahoo-candles.ts",
  );
  const day1 = Date.UTC(2024, 0, 2, 2) / 1000; // 2024-01-02 02:00 UTC
  const day2 = Date.UTC(2024, 0, 3, 2) / 1000;
  const hourly = [
    { open: 10, high: 12, low: 9, close: 11, volume: 100, timestamp: day1 },
    {
      open: 11,
      high: 15,
      low: 10,
      close: 14,
      volume: 200,
      timestamp: day1 + 3600,
    },
    {
      open: 14,
      high: 14,
      low: 8,
      close: 9,
      volume: 50,
      timestamp: day1 + 7200,
    },
    { open: 9, high: 10, low: 8, close: 10, volume: 80, timestamp: day2 },
    {
      open: 10,
      high: 11,
      low: 9,
      close: 11,
      volume: 20,
      timestamp: day2 + 3600,
    },
  ];
  const inputSnapshot = JSON.stringify(hourly);

  const daily = resampleCandlesToDaily(hourly);

  assert.equal(daily.length, 2);
  assert.deepEqual(daily[0], {
    open: 10,
    high: 15,
    low: 8,
    close: 9,
    volume: 350,
    timestamp: day1 + 7200,
  });
  assert.deepEqual(daily[1], {
    open: 9,
    high: 11,
    low: 8,
    close: 11,
    volume: 100,
    timestamp: day2 + 3600,
  });
  // Input candles must not be mutated.
  assert.equal(JSON.stringify(hourly), inputSnapshot);
});

test("resampleCandlesToDaily passes already-daily input through 1:1", async () => {
  const { resampleCandlesToDaily } = await loadModule(
    "/src/services/adapters/yahoo-candles.ts",
  );
  const dailyInput = makeFlowCandles({ days: 21 });
  const out = resampleCandlesToDaily(dailyInput);
  assert.equal(out.length, 21);
  assert.deepEqual(out, dailyInput);
});
