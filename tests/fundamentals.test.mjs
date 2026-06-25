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

const FUND = "/src/features/engine/fundamentals.ts";
const ADAPTER = "/src/services/adapters/yahoo-fundamentals.ts";

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
    dataQuality: { candleCount: 130, ready: true, missingVolume: false, volumeReliable: true },
    indicators: {},
    analysis: { trend: "", volume: "", momentum: "", sentiment: "" },
    ...overrides,
  };
}

const NOW = Date.UTC(2026, 0, 10);

test("applyFundamentals: pre-earnings blackout de-rates + flags", async () => {
  const { applyFundamentals } = await loadModule(FUND);
  const outlook = makeOutlook({ signal: "long", strength: 80 });
  // Earnings in 3 days → inside the 5-day blackout.
  const f = { nextEarningsMs: NOW + 3 * 24 * 60 * 60 * 1000 };
  const out = applyFundamentals(outlook, f, NOW);
  assert.ok(out.strength < 80, "blackout de-rated strength");
  assert.ok(out.reasons.warnings.some((w) => w.includes("Earnings in")));
  // Earnings far out → no blackout.
  const far = applyFundamentals(outlook, { nextEarningsMs: NOW + 60 * 24 * 60 * 60 * 1000 }, NOW);
  assert.equal(far, outlook, "no blackout, no other signal → same reference");
});

test("applyFundamentals: analyst consensus nudges aligned, opposes immutably", async () => {
  const { applyFundamentals } = await loadModule(FUND);
  const longOutlook = makeOutlook({ signal: "long", strength: 70 });
  // Bullish consensus supports a LONG → up.
  const up = applyFundamentals(longOutlook, { analystScore: 0.8, analystCount: 20 }, NOW);
  assert.ok(up.strength > 70);
  assert.ok(up.reasons.warnings.some((w) => w.includes("Analyst consensus bullish supports")));
  // Bearish consensus opposes a LONG → down.
  const down = applyFundamentals(longOutlook, { analystScore: -0.8 }, NOW);
  assert.ok(down.strength < 70);
  // Weak consensus (below ANALYST_MIN_SCORE) → ignored.
  assert.equal(applyFundamentals(longOutlook, { analystScore: 0.1 }, NOW), longOutlook);
  // Input untouched.
  assert.equal(longOutlook.strength, 70);
});

test("applyFundamentals: valuation caution flags on a LONG, never flips, neutral untouched", async () => {
  const { applyFundamentals } = await loadModule(FUND);
  const longOutlook = makeOutlook({ signal: "long", strength: 70 });
  const out = applyFundamentals(longOutlook, { debtToEquity: 250, trailingPE: 80 }, NOW);
  assert.equal(out.signal, "long", "valuation never flips");
  assert.ok(out.reasons.warnings.some((w) => w.includes("High leverage")));
  assert.ok(out.reasons.warnings.some((w) => w.includes("Rich valuation")));
  // Neutral has no direction → untouched.
  const neutral = makeOutlook({ signal: "neutral", strength: 10 });
  assert.equal(applyFundamentals(neutral, { analystScore: 0.8 }, NOW), neutral);
});

test("adaptYahooFundamentals: maps modules, computes analyst score, null when empty", async () => {
  const { adaptYahooFundamentals } = await loadModule(ADAPTER);
  const raw = {
    summaryDetail: { trailingPE: { raw: 24.5 } },
    defaultKeyStatistics: { priceToBook: { raw: 3.2 } },
    financialData: { debtToEquity: { raw: 45.6 }, recommendationKey: "buy" },
    recommendationTrend: {
      trend: [{ period: "0m", strongBuy: 5, buy: 5, hold: 0, sell: 0, strongSell: 0 }],
    },
    calendarEvents: { earnings: { earningsDate: [{ raw: 1800000000 }] } },
  };
  const f = adaptYahooFundamentals(raw);
  assert.equal(f.trailingPE, 24.5);
  assert.equal(f.priceToBook, 3.2);
  assert.equal(f.debtToEquity, 45.6);
  assert.equal(f.recommendationKey, "buy");
  assert.equal(f.analystCount, 10);
  // 5 strongBuy(+1) + 5 buy(+0.5) = 7.5 / 10 = 0.75
  assert.ok(Math.abs(f.analystScore - 0.75) < 1e-6);
  assert.equal(f.nextEarningsMs, 1800000000 * 1000);

  assert.equal(adaptYahooFundamentals(null), null);
  assert.equal(adaptYahooFundamentals({}), null, "no usable fields → null");
});
