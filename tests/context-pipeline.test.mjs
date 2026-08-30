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

const PIPELINE = "/src/core/engine/context-pipeline.ts";
const CORE = "/src/core/automation/auto-journal-core.ts";

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

/** A full signal-bearing crypto asset (complete outlook so enrichAsset runs). */
function makeAsset({ symbol, signal = "long", price = 100, sl = 90, tps = [110, 120], strength = 70, quoteTime = Date.now() }) {
  return {
    symbol,
    name: symbol,
    assetType: "crypto",
    timeframe: "1mo",
    price,
    quoteTime,
    outlook: makeOutlook({ signal, strength }),
    tradingPlan: {
      stopLoss: sl,
      takeProfit1: tps[0],
      takeProfit2: tps[1],
      takeProfit3: undefined,
      riskRewardRatio: 2,
    },
  };
}

const RISK_OFF = {
  cryptoContext: {
    btcTrend: "bearish",
    btcRegime: "trending",
    btcDirectionScore: -0.6,
    riskState: "risk_off",
    lastUpdated: 0,
  },
};

test("buildEngineContexts: derives a crypto context from BTC, omits missing benchmarks", async () => {
  const { buildEngineContexts } = await loadModule(PIPELINE);
  const map = new Map([
    ["BTC-USD", { symbol: "BTC-USD", assetType: "crypto", outlook: makeOutlook({ trend: "bearish", regime: "trending", directionScore: -0.6 }) }],
  ]);
  const ctx = buildEngineContexts(map);
  assert.equal(ctx.cryptoContext?.riskState, "risk_off");
  assert.equal(ctx.idxContext, undefined, "no IHSG fetched → no idx context");
  assert.equal(ctx.usContext, undefined, "no S&P fetched → no us context");
});

test("runAutoJournal with contexts: journals every screen signal with its de-rated strength", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const assets = [
    // LONG into a risk-off market, strength 70 → de-rated to 42 but still shown.
    makeAsset({ symbol: "AAA", signal: "long", strength: 70 }),
    // SHORT into risk-off (aligned) → emitted untouched.
    makeAsset({ symbol: "BBB", signal: "short", sl: 110, tps: [90, 80], strength: 70 }),
    // Exceptional LONG, strength 100 → de-rated to 60.
    makeAsset({ symbol: "CCC", signal: "long", strength: 100 }),
  ];

  const { inserts } = runAutoJournal(assets, [], { contexts: RISK_OFF });
  const bySymbol = Object.fromEntries(inserts.map((insert) => [insert.symbol, insert]));
  assert.deepEqual(Object.keys(bySymbol).sort(), ["AAA", "BBB", "CCC"]);
  assert.equal(bySymbol.AAA.strength_at_entry, 42);
  assert.equal(bySymbol.AAA.grade, "C");
  assert.equal(bySymbol.BBB.strength_at_entry, 70);
  assert.equal(bySymbol.CCC.strength_at_entry, 60);
});

test("runAutoJournal with a missing benchmark context emits the raw screen signal", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const { inserts } = runAutoJournal(
    [makeAsset({ symbol: "AAA", signal: "long", strength: 70 })],
    [],
    { contexts: {} },
  );
  assert.deepEqual(inserts.map((i) => i.symbol), ["AAA"]);
  assert.equal(inserts[0].strength_at_entry, 70);
});
