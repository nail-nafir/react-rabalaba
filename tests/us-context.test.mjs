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
    analysis: { trend: "", volume: "", momentum: "", sentiment: "" },
    ...overrides,
  };
}

function makeUsCtx(overrides = {}) {
  return {
    spxTrend: "bearish",
    spxRegime: "trending",
    spxDirectionScore: -0.6,
    riskState: "risk_off",
    vixLevel: 28,
    vix1wChangePercent: 20,
    dxy1wChangePercent: 1.5,
    lastUpdated: 0,
    ...overrides,
  };
}

test("deriveUsRiskState: S&P score drives risk on/off, VIX+DXY break ties", async () => {
  const { deriveUsRiskState } = await loadModule(
    "/src/features/engine/us-context.ts",
  );
  assert.equal(deriveUsRiskState(-0.5), "risk_off");
  assert.equal(deriveUsRiskState(0.5), "risk_on");
  assert.equal(deriveUsRiskState(0.05), "neutral");
  // S&P indecisive → a high VIX (≥20) alone leans risk-off.
  assert.equal(deriveUsRiskState(0.1, { vixLevel: 28 }), "risk_off");
  // Low VIX (≤15) + falling dollar both lean risk-on.
  assert.equal(
    deriveUsRiskState(0.1, { vixLevel: 13, dxy1wChangePercent: -1.5 }),
    "risk_on",
  );
  // Conflicting gauges (fear up but dollar weakening) → stays neutral.
  assert.equal(
    deriveUsRiskState(0.1, { vixLevel: 28, dxy1wChangePercent: -1.5 }),
    "neutral",
  );
  // No tiebreak data → neutral.
  assert.equal(deriveUsRiskState(0.1), "neutral");
  // S&P decisive → tiebreaks can't override it.
  assert.equal(deriveUsRiskState(0.5, { vixLevel: 40 }), "risk_on");
});

test("deriveUsContext packages S&P outlook + VIX/DXY posture + returns", async () => {
  const { deriveUsContext } = await loadModule(
    "/src/features/engine/us-context.ts",
  );
  const spx = makeOutlook({
    trend: "bearish",
    regime: "trending",
    directionScore: -0.6,
  });
  const ctx = deriveUsContext(
    spx,
    { vixLevel: 30, vix1wChangePercent: 25, dxy1wChangePercent: 1.2 },
    { r1w: -2.1, r1m: -4.5 },
  );
  assert.equal(ctx.spxTrend, "bearish");
  assert.equal(ctx.spxDirectionScore, -0.6);
  assert.equal(ctx.riskState, "risk_off");
  assert.equal(ctx.vixLevel, 30);
  assert.equal(ctx.dxy1wChangePercent, 1.2);
  assert.deepEqual(ctx.spxReturns, { r1w: -2.1, r1m: -4.5 });
});

test("applyUsContext de-rates a us-stock LONG that fights risk-off (immutably)", async () => {
  const { applyUsContext } = await loadModule(
    "/src/features/engine/us-context.ts",
  );
  const outlook = makeOutlook({
    signal: "long",
    directionScore: 0.8,
    strength: 80,
    tier: "A",
  });
  const ctx = makeUsCtx({ riskState: "risk_off", spxDirectionScore: -0.6 });

  const out = applyUsContext(outlook, { assetType: "us-stock" }, ctx);

  assert.ok(out.directionScore < 0.8, "directionScore de-rated");
  assert.ok(out.strength < 80, "strength de-rated");
  assert.notEqual(out.tier, "A", "tier re-derived from de-rated strength");
  assert.ok(out.reasons.warnings.some((w) => w.includes("US context")));
  assert.ok(out.reasons.warnings.some((w) => w.includes("VIX")));
  // Input must NOT be mutated (lives in react-query cache).
  assert.equal(outlook.strength, 80);
  assert.equal(outlook.reasons.warnings.length, 0);
});

test("applyUsContext leaves aligned, neutral, and non-us-stock unchanged", async () => {
  const { applyUsContext } = await loadModule(
    "/src/features/engine/us-context.ts",
  );
  const longOutlook = makeOutlook({ signal: "long" });

  // Aligned: LONG during risk-on → untouched (same reference).
  const ctxOn = makeUsCtx({ riskState: "risk_on", spxDirectionScore: 0.6 });
  assert.equal(
    applyUsContext(longOutlook, { assetType: "us-stock" }, ctxOn),
    longOutlook,
  );

  // Crypto / ID stocks aren't S&P beta → untouched even in risk-off.
  const ctxOff = makeUsCtx({ riskState: "risk_off" });
  assert.equal(
    applyUsContext(longOutlook, { assetType: "crypto" }, ctxOff),
    longOutlook,
  );
  assert.equal(
    applyUsContext(longOutlook, { assetType: "id-stock" }, ctxOff),
    longOutlook,
  );

  // Neutral has no direction to fight → untouched.
  const neutral = makeOutlook({ signal: "neutral", strength: 10 });
  assert.equal(
    applyUsContext(neutral, { assetType: "us-stock" }, ctxOff),
    neutral,
  );
});
