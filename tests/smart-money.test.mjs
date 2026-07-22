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
    dataQuality: { candleCount: 130, ready: true, missingVolume: false, volumeReliable: true },
    indicators: {},
    analysis: { trend: "", volume: "", momentum: "" },
    ...overrides,
  };
}

test("yahooToBinancePerp maps USD crypto, handles 1000x, rejects non-crypto", async () => {
  const { yahooToBinancePerp } = await loadModule("/src/services/api/binance.ts");
  assert.equal(yahooToBinancePerp("BTC-USD"), "BTCUSDT");
  assert.equal(yahooToBinancePerp("SOL-USD"), "SOLUSDT");
  assert.equal(yahooToBinancePerp("PEPE-USD"), "1000PEPEUSDT");
  assert.equal(yahooToBinancePerp("AAPL"), null);
  assert.equal(yahooToBinancePerp("EURUSD=X"), null);
});

test("derivePositioning: OI↑price↑ = new longs (bullish positioning)", async () => {
  const { derivePositioning } = await loadModule(
    "/src/features/engine/smart-money.ts",
  );
  const sm = derivePositioning({
    openInterest: 1000,
    openInterestDelta: 0.1,
    fundingRate: 0.0001,
    priceChangePercent: 5,
  });
  assert.ok(sm.positioningScore > 0);
  assert.match(sm.label, /New longs/);
});

test("derivePositioning: extreme positive funding is CONTRARIAN bearish", async () => {
  const { derivePositioning } = await loadModule(
    "/src/features/engine/smart-money.ts",
  );
  const sm = derivePositioning({
    openInterest: 1000,
    openInterestDelta: 0,
    fundingRate: 0.001, // well above the extreme threshold
    priceChangePercent: 0,
  });
  assert.ok(sm.positioningScore < 0, "crowded longs → negative (squeeze risk)");
  assert.match(sm.label, /Crowded longs/);
});

test("applySmartMoney boosts agreement, dampens opposition, immutably", async () => {
  const { applySmartMoney } = await loadModule(
    "/src/features/engine/smart-money.ts",
  );
  const outlook = makeOutlook({ signal: "long", directionScore: 0.5, strength: 50 });
  const supportive = { positioningScore: 0.8, label: "New longs", openInterest: 0, openInterestDelta: 0, fundingRate: 0 };
  const opposing = { positioningScore: -0.8, label: "Crowded longs", openInterest: 0, openInterestDelta: 0, fundingRate: 0 };

  const up = applySmartMoney(outlook, supportive);
  const down = applySmartMoney(outlook, opposing);

  assert.ok(up.strength > 50, "agreement boosts conviction");
  assert.ok(down.strength < 50, "opposition dampens conviction");
  assert.ok(up.reasons.warnings.some((w) => w.includes("supports")));
  assert.ok(down.reasons.warnings.some((w) => w.includes("dampened")));
  // Bounded to ±15%.
  assert.ok(up.strength <= Math.round(50 * 1.15));
  // Original untouched.
  assert.equal(outlook.strength, 50);
  assert.equal(outlook.reasons.warnings.length, 0);
});

test("applySmartMoney leaves neutral signals untouched", async () => {
  const { applySmartMoney } = await loadModule(
    "/src/features/engine/smart-money.ts",
  );
  const neutral = makeOutlook({ signal: "neutral", directionScore: 0.1, strength: 10 });
  const out = applySmartMoney(neutral, {
    positioningScore: 0.9,
    label: "x",
    openInterest: 0,
    openInterestDelta: 0,
    fundingRate: 0,
  });
  assert.equal(out.strength, 10);
});
