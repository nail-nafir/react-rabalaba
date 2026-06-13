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

function makeIdxCtx(overrides = {}) {
  return {
    ihsgTrend: "bearish",
    ihsgRegime: "trending",
    ihsgDirectionScore: -0.6,
    riskState: "risk_off",
    usdIdrTrend: "bullish",
    usdIdr1wChangePercent: 1.5,
    lastUpdated: 0,
    ...overrides,
  };
}

test("deriveIdxRiskState: IHSG score drives risk on/off, rupiah breaks ties both ways", async () => {
  const { deriveIdxRiskState } = await loadModule(
    "/src/features/engine/idx-context.ts",
  );
  assert.equal(deriveIdxRiskState(-0.5), "risk_off");
  assert.equal(deriveIdxRiskState(0.5), "risk_on");
  assert.equal(deriveIdxRiskState(0.05), "neutral");
  // IHSG indecisive → rupiah pressure breaks the tie. + = rupiah weakening.
  assert.equal(deriveIdxRiskState(0.1, 1.5), "risk_off");
  assert.equal(deriveIdxRiskState(0.1, -1.5), "risk_on");
  // Rupiah move below the pressure threshold doesn't break the tie.
  assert.equal(deriveIdxRiskState(0.1, 0.5), "neutral");
  // IHSG decisive → rupiah can't override it.
  assert.equal(deriveIdxRiskState(0.5, 1.5), "risk_on");
});

test("deriveIdxContext packages IHSG outlook + rupiah posture + returns", async () => {
  const { deriveIdxContext } = await loadModule(
    "/src/features/engine/idx-context.ts",
  );
  const ihsg = makeOutlook({
    trend: "bearish",
    regime: "trending",
    directionScore: -0.6,
  });
  const ctx = deriveIdxContext(
    ihsg,
    { trend: "bullish", oneWeekChangePercent: 1.2 },
    { r1w: -2.1, r1m: -4.5 },
  );
  assert.equal(ctx.ihsgTrend, "bearish");
  assert.equal(ctx.ihsgDirectionScore, -0.6);
  assert.equal(ctx.riskState, "risk_off");
  assert.equal(ctx.usdIdrTrend, "bullish");
  assert.equal(ctx.usdIdr1wChangePercent, 1.2);
  assert.deepEqual(ctx.ihsgReturns, { r1w: -2.1, r1m: -4.5 });
});

test("applyIdxContext de-rates an id-stock LONG that fights risk-off (immutably)", async () => {
  const { applyIdxContext } = await loadModule(
    "/src/features/engine/idx-context.ts",
  );
  const outlook = makeOutlook({
    signal: "long",
    directionScore: 0.8,
    strength: 80,
    tier: "A",
  });
  const ctx = makeIdxCtx({ riskState: "risk_off", ihsgDirectionScore: -0.6 });

  const out = applyIdxContext(outlook, { assetType: "id-stock" }, ctx);

  assert.ok(out.directionScore < 0.8, "directionScore de-rated");
  assert.ok(out.strength < 80, "strength de-rated");
  assert.notEqual(out.tier, "A", "tier re-derived from de-rated strength");
  assert.ok(out.reasons.warnings.some((w) => w.includes("IDX context")));
  assert.ok(out.reasons.warnings.some((w) => w.includes("rupiah")));
  // Input must NOT be mutated (lives in react-query cache).
  assert.equal(outlook.strength, 80);
  assert.equal(outlook.reasons.warnings.length, 0);
});

test("applyIdxContext leaves aligned, neutral, and non-id-stock unchanged", async () => {
  const { applyIdxContext } = await loadModule(
    "/src/features/engine/idx-context.ts",
  );
  const longOutlook = makeOutlook({ signal: "long" });

  // Aligned: LONG during risk-on → untouched (same reference).
  const ctxOn = makeIdxCtx({ riskState: "risk_on", ihsgDirectionScore: 0.6 });
  assert.equal(
    applyIdxContext(longOutlook, { assetType: "id-stock" }, ctxOn),
    longOutlook,
  );

  // Crypto / US stocks aren't IHSG beta → untouched even in risk-off.
  const ctxOff = makeIdxCtx({ riskState: "risk_off" });
  assert.equal(
    applyIdxContext(longOutlook, { assetType: "crypto" }, ctxOff),
    longOutlook,
  );
  assert.equal(
    applyIdxContext(longOutlook, { assetType: "us-stock" }, ctxOff),
    longOutlook,
  );

  // Neutral has no direction to fight → untouched.
  const neutral = makeOutlook({ signal: "neutral", strength: 10 });
  assert.equal(
    applyIdxContext(neutral, { assetType: "id-stock" }, ctxOff),
    neutral,
  );
});
