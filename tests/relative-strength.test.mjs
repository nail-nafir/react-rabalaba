import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

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
    /* vite SSR teardown can reject; not a test failure */
  }
});

const RS = "/src/features/engine/relative-strength.ts";

function makeOutlook(overrides = {}) {
  return {
    signal: "long",
    strength: 70,
    technicalAlignment: "moderate",
    tier: "B",
    risk: "medium",
    trend: "bullish",
    regime: "trending",
    higherTimeframeTrend: "sideways",
    directionScore: 0.7,
    categoryScores: { trend: 0.7, momentum: 0.5, volatility: 0.2, volume: 0.1 },
    reasons: { bullish: [], bearish: [], warnings: [] },
    dataQuality: { candleCount: 130, ready: true, missingVolume: false, volumeReliable: true },
    indicators: {},
    analysis: { trend: "", volume: "", momentum: "" },
    ...overrides,
  };
}

/** Daily closes whose ~1m (21-session) return is about +`pct1m`%. */
function closesWith1mReturn(pct1m, len = 25) {
  const closes = new Array(len).fill(100);
  closes[len - 1] = 100 * (1 + pct1m / 100);
  return closes;
}

test("deriveRelativeStrength: excess return + label vs the benchmark", async () => {
  const { deriveRelativeStrength } = await loadModule(RS);
  // Asset +10% over 1m, benchmark +3% → excess +7% → outperform.
  const rs = deriveRelativeStrength(closesWith1mReturn(10), { r1w: 1, r1m: 3 }, "IHSG");
  assert.equal(rs.benchmark, "IHSG");
  assert.ok(Math.abs(rs.r1m - 7) < 1e-6, "1m excess ≈ +7%");
  assert.equal(rs.label, "outperform");

  // Asset −2% vs benchmark +4% → excess −6% → underperform.
  const rs2 = deriveRelativeStrength(closesWith1mReturn(-2), { r1m: 4 }, "S&P 500");
  assert.equal(rs2.label, "underperform");

  // Within the inline band → inline.
  const rs3 = deriveRelativeStrength(closesWith1mReturn(3.5), { r1m: 3 }, "BTC");
  assert.equal(rs3.label, "inline");

  // No overlapping window → null.
  assert.equal(deriveRelativeStrength([100, 101], {}, "BTC"), null);
});

test("applyRelativeStrength: leader boosts an aligned LONG, laggard dampens (immutable)", async () => {
  const { applyRelativeStrength } = await loadModule(RS);
  const outlook = makeOutlook({ signal: "long", strength: 70, directionScore: 0.7 });

  // Outperforming → LONG conviction nudged UP.
  const up = applyRelativeStrength(outlook, { r1m: 8, label: "outperform", benchmark: "IHSG" });
  assert.ok(up.strength > 70, "leader boosts an aligned long");
  assert.ok(up.reasons.warnings.some((w) => w.includes("Relative strength")));

  // Lagging → LONG conviction nudged DOWN.
  const down = applyRelativeStrength(outlook, { r1m: -8, label: "underperform", benchmark: "IHSG" });
  assert.ok(down.strength < 70, "laggard dampens an aligned long");

  // Input never mutated.
  assert.equal(outlook.strength, 70);
  assert.equal(outlook.reasons.warnings.length, 0);
});

test("applyRelativeStrength: bounded to MAX_CONVICTION_ADJ and never flips, neutral untouched", async () => {
  const { applyRelativeStrength } = await loadModule(RS);
  const { RELATIVE_STRENGTH } = await loadModule("/src/constants/signals.ts");
  const outlook = makeOutlook({ signal: "long", strength: 70 });

  // A huge excess saturates at ±MAX_CONVICTION_ADJ.
  const out = applyRelativeStrength(outlook, { r1m: 999, label: "outperform", benchmark: "BTC" });
  const cap = Math.round(70 * (1 + RELATIVE_STRENGTH.MAX_CONVICTION_ADJ));
  assert.equal(out.strength, cap, "nudge saturates at the cap");
  assert.equal(out.signal, "long", "never flips the signal");

  // Neutral has no direction to lead → untouched.
  const neutral = makeOutlook({ signal: "neutral", strength: 10 });
  assert.equal(applyRelativeStrength(neutral, { r1m: 8, label: "outperform" }), neutral);
});
