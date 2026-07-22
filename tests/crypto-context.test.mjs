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
    strength: 80,
    technicalAlignment: "strong",
    tier: "A",
    risk: "medium",
    trend: "bullish",
    regime: "trending",
    higherTimeframeTrend: "sideways",
    directionScore: 0.8,
    categoryScores: { trend: 0.8, momentum: 0.5, volatility: 0.2, volume: 0.1 },
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

function makeCtx(overrides = {}) {
  return {
    btcTrend: "bearish",
    btcRegime: "trending",
    btcDirectionScore: -0.6,
    riskState: "risk_off",
    lastUpdated: 0,
    ...overrides,
  };
}

test("deriveCryptoRiskState: BTC score drives risk on/off", async () => {
  const { deriveCryptoRiskState } = await loadModule(
    "/src/features/engine/crypto-context.ts",
  );
  assert.equal(deriveCryptoRiskState(-0.5), "risk_off");
  assert.equal(deriveCryptoRiskState(0.5), "risk_on");
  assert.equal(deriveCryptoRiskState(0.05), "neutral");
});

test("applyCryptoContext de-rates a crypto LONG that fights risk-off (immutably)", async () => {
  const { applyCryptoContext } = await loadModule(
    "/src/features/engine/crypto-context.ts",
  );
  const outlook = makeOutlook({ signal: "long", directionScore: 0.8, strength: 80, tier: "A" });
  const ctx = makeCtx({ riskState: "risk_off", btcDirectionScore: -0.6 });

  const out = applyCryptoContext(outlook, { assetType: "crypto", symbol: "SOL-USD" }, ctx);

  assert.ok(out.directionScore < 0.8, "directionScore de-rated");
  assert.ok(out.strength < 80, "strength de-rated");
  assert.ok(out.reasons.warnings.some((w) => w.includes("Market context")));
  // Input must NOT be mutated (lives in react-query cache).
  assert.equal(outlook.strength, 80);
  assert.equal(outlook.reasons.warnings.length, 0);
});

test("applyCryptoContext leaves aligned, BTC-self, and non-crypto unchanged", async () => {
  const { applyCryptoContext } = await loadModule(
    "/src/features/engine/crypto-context.ts",
  );
  const longOutlook = makeOutlook({ signal: "long" });

  // Aligned: LONG during risk-on → untouched.
  const ctxOn = makeCtx({ riskState: "risk_on", btcDirectionScore: 0.6 });
  assert.equal(
    applyCryptoContext(longOutlook, { assetType: "crypto", symbol: "SOL-USD" }, ctxOn).strength,
    80,
  );

  // BTC itself defines the context → untouched even in risk-off.
  const ctxOff = makeCtx({ riskState: "risk_off" });
  assert.equal(
    applyCryptoContext(longOutlook, { assetType: "crypto", symbol: "BTC-USD" }, ctxOff).strength,
    80,
  );

  // Non-crypto isn't BTC beta → untouched.
  assert.equal(
    applyCryptoContext(longOutlook, { assetType: "us-stock", symbol: "AAPL" }, ctxOff).strength,
    80,
  );
});
