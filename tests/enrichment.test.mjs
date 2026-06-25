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
const T0 = Date.UTC(2024, 0, 1) / 1000;

/** Same flow signature as accumulation.test.mjs: up days close at high on 3×
 *  volume → reads as accumulation. Already-daily timestamps. */
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

/** Pack candle arrays into the UnifiedAsset quoteIndicators/timestamps shape. */
function candleSeries(candles) {
  return {
    quoteIndicators: {
      open: candles.map((c) => c.open),
      high: candles.map((c) => c.high),
      low: candles.map((c) => c.low),
      close: candles.map((c) => c.close),
      volume: candles.map((c) => c.volume),
    },
    timestamps: candles.map((c) => c.timestamp),
  };
}

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

function makeAsset(overrides = {}) {
  return {
    symbol: "BBCA.JK",
    name: "Bank Central Asia",
    assetType: "id-stock",
    price: 1000,
    changePercent: 1,
    volume: 1_000_000,
    outlook: makeOutlook(),
    tradingPlan: null,
    timeframe: "1mo",
    ...overrides,
  };
}

function makeMarketCtx(overrides = {}) {
  return {
    btcTrend: "bearish",
    btcRegime: "trending",
    btcDirectionScore: -0.6,
    riskState: "risk_off",
    fearGreed: 30,
    lastUpdated: 0,
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

test("enrichAsset id-stock: IDX de-rate applies BEFORE the accumulation nudge (combined math)", async () => {
  const { enrichAsset } = await loadModule("/src/features/engine/enrichment.ts");
  const { deriveAccumulation } = await loadModule(
    "/src/features/engine/accumulation.ts",
  );
  const { ACCUMULATION, IDX_CONTEXT } = await loadModule(
    "/src/constants/signals.ts",
  );

  const flowCandles = makeFlowCandles({ days: 21 });
  const asset = makeAsset({
    outlook: makeOutlook({ signal: "long", strength: 80, directionScore: 0.8 }),
    ...candleSeries(flowCandles),
  });
  // Same daily series the enrichment derives internally (input is already
  // daily), so the expected combined math can be computed exactly.
  const acc = deriveAccumulation(flowCandles);
  assert.ok(acc && acc.score > 0, "fixture must read as accumulation");

  const out = enrichAsset(asset, { idxContext: makeIdxCtx() });

  // Order: ×0.6 de-rate first, THEN the flow nudge on the de-rated strength.
  const deRated = Math.round(80 * IDX_CONTEXT.COUNTER_MARKET_DERATE);
  const expected = Math.min(
    100,
    Math.round(deRated * (1 + acc.score * ACCUMULATION.MAX_CONVICTION_ADJ)),
  );
  assert.equal(out.outlook.strength, expected);
  assert.ok(out.outlook.reasons.warnings.some((w) => w.includes("IDX context")));
  assert.ok(
    out.outlook.reasons.warnings.some((w) => w.includes("Accumulation flow")),
  );

  // (d) No mutation of the cached input.
  assert.equal(asset.outlook.strength, 80);
  assert.equal(asset.outlook.reasons.warnings.length, 0);
  assert.equal(asset.accumulation, undefined);
});

test("enrichAsset id-stock: accumulation attaches even when the signal is neutral", async () => {
  const { enrichAsset } = await loadModule("/src/features/engine/enrichment.ts");
  const flowCandles = makeFlowCandles({ days: 21 });
  const asset = makeAsset({
    outlook: makeOutlook({ signal: "neutral", strength: 10 }),
    ...candleSeries(flowCandles),
  });

  const out = enrichAsset(asset, { idxContext: makeIdxCtx() });

  assert.ok(out.accumulation, "flow context attached pre-signal");
  assert.equal(out.accumulation.daysAnalyzed, 21);
  // Neutral outlook untouched (same reference), but extras still attach.
  assert.equal(out.outlook, asset.outlook);
  assert.notEqual(out, asset);
});

test("enrichAsset us-stock: accumulation applies (general flow read, not id-only)", async () => {
  const { enrichAsset } = await loadModule("/src/features/engine/enrichment.ts");
  const flowCandles = makeFlowCandles({ days: 21 }); // reads as accumulation
  const asset = makeAsset({
    symbol: "AAPL",
    name: "Apple",
    assetType: "us-stock",
    outlook: makeOutlook({ signal: "long", strength: 50, directionScore: 0.5 }),
    ...candleSeries(flowCandles),
  });

  // cryptoContext (BTC) is supplied to prove it never touches a US stock.
  const out = enrichAsset(asset, { cryptoContext: makeMarketCtx() });

  assert.ok(out.accumulation, "flow read attached to a US stock");
  assert.equal(out.accumulation.daysAnalyzed, 21);
  // Supportive flow into a LONG nudges conviction up, bounded to +15%.
  assert.ok(out.outlook.strength > 50, "supportive flow boosts conviction");
  assert.ok(out.outlook.strength <= Math.round(50 * 1.15));
  assert.ok(
    out.outlook.reasons.warnings.some((w) => w.includes("Accumulation flow")),
    "flow nudge ran for the US stock",
  );
  // No crypto cross-wiring: BTC crypto-context must not attach to a US stock.
  assert.equal(out.smartMoney, undefined);
});

test("enrichAsset crypto: result is identical to the legacy applyCryptoContext → applySmartMoney chain", async () => {
  const { enrichAsset } = await loadModule("/src/features/engine/enrichment.ts");
  const { applyCryptoContext } = await loadModule(
    "/src/features/engine/crypto-context.ts",
  );
  const { applySmartMoney } = await loadModule(
    "/src/features/engine/smart-money.ts",
  );

  const asset = makeAsset({
    symbol: "SOL-USD",
    name: "Solana",
    assetType: "crypto",
    outlook: makeOutlook({ signal: "long", strength: 80, directionScore: 0.8 }),
  });
  const ctx = makeMarketCtx();
  const sm = {
    positioningScore: 0.8,
    label: "New longs",
    openInterest: 0,
    openInterestDelta: 0.1,
    fundingRate: 0.0001,
  };

  const out = enrichAsset(asset, { cryptoContext: ctx, smartMoney: sm });
  const legacy = applySmartMoney(applyCryptoContext(asset.outlook, asset, ctx), sm);

  assert.deepEqual(out.outlook, legacy);
  assert.equal(out.smartMoney, sm, "positioning attached");
  assert.equal(out.accumulation, undefined, "no id-stock extras on crypto");
});

test("enrichAsset: idxContext never touches crypto, cryptoContext never touches id-stock", async () => {
  const { enrichAsset } = await loadModule("/src/features/engine/enrichment.ts");

  // Crypto with ONLY idxContext supplied → nothing applies, same reference.
  const crypto = makeAsset({
    symbol: "SOL-USD",
    assetType: "crypto",
    outlook: makeOutlook({ signal: "long" }),
  });
  assert.equal(enrichAsset(crypto, { idxContext: makeIdxCtx() }), crypto);

  // id-stock without candles, with ONLY cryptoContext → same reference.
  const idStock = makeAsset({ outlook: makeOutlook({ signal: "long" }) });
  assert.equal(enrichAsset(idStock, { cryptoContext: makeMarketCtx() }), idStock);
});

test("enrichAsset: same-reference passthrough when nothing applies", async () => {
  const { enrichAsset } = await loadModule("/src/features/engine/enrichment.ts");

  // US stock with NO candle history: accumulation can't be derived and only
  // crypto/idx contexts are supplied (neither targets us-stock; usContext is
  // omitted), so the asset passes through unchanged.
  const usStock = makeAsset({
    symbol: "AAPL",
    assetType: "us-stock",
    outlook: makeOutlook({ signal: "long" }),
  });
  assert.equal(
    enrichAsset(usStock, {
      cryptoContext: makeMarketCtx(),
      idxContext: makeIdxCtx(),
    }),
    usStock,
  );

  // No outlook at all → untouched.
  const noOutlook = makeAsset({ outlook: null });
  assert.equal(enrichAsset(noOutlook, { idxContext: makeIdxCtx() }), noOutlook);

  // Empty inputs → untouched (id-stock with too little history for flow).
  const shortHistory = makeAsset({
    ...candleSeries(makeFlowCandles({ days: 5 })),
  });
  assert.equal(enrichAsset(shortHistory, {}), shortHistory);
});

test("enrichAsset commodity & forex: passthrough — no accumulation, no smartMoney, same reference", async () => {
  // Forex volume on Yahoo is synthetic (aggregated across brokers, not real
  // exchange flow). Commodity is futures rolls — too patchy to trust. Both
  // asset classes are intentionally excluded from the flow-nudge step, and
  // neither has a top-down context layer, so the asset must come back
  // completely untouched (same reference, no accumulation attached).
  const { enrichAsset } = await loadModule("/src/features/engine/enrichment.ts");
  const candles = makeFlowCandles({ days: 21 }); // enough for a valid read

  for (const assetType of ["forex", "commodity"]) {
    const asset = makeAsset({
      symbol: assetType === "forex" ? "EUR-USD" : "GC-F",
      assetType,
      outlook: makeOutlook({ signal: "long", strength: 60 }),
      ...candleSeries(candles),
    });

    const out = enrichAsset(asset, {
      cryptoContext: makeMarketCtx(),
      idxContext: makeIdxCtx(),
    });

    assert.equal(out, asset, `${assetType}: must be same reference — no layer applies`);
    assert.equal(out.accumulation, undefined, `${assetType}: no accumulation attached`);
    assert.equal(out.smartMoney, undefined, `${assetType}: no smartMoney attached`);
    assert.equal(out.outlook.strength, 60, `${assetType}: conviction unchanged`);
  }
});

test("enrichAsset us-stock SHORT + distribution flow: conviction dampened, signal stays SHORT", async () => {
  // Verifies the agreement sign-flip path in applyAccumulation when the
  // outlook is SHORT but the flow reads as accumulation (heavy buying on
  // up days) — the flow OPPOSES the short, so conviction should drop.
  // This is the mirror of the LONG+supportive test. Testing via enrichAsset
  // confirms supportsAccumulation() routes us-stock into the flow nudge for
  // SHORT signals too, and that the math doesn't accidentally flip the signal.
  const { enrichAsset } = await loadModule("/src/features/engine/enrichment.ts");

  // Heavy down-volume = distribution reads — opposes a LONG but SUPPORTS a
  // SHORT. We want to test the opposing scenario for SHORT, so use the
  // accumulation-reading candles (heavy up-volume) which oppose a SHORT.
  const accCandles = makeFlowCandles({ days: 21, upVolumeMult: 3, downVolumeMult: 0.5 });

  const asset = makeAsset({
    symbol: "TSLA",
    name: "Tesla",
    assetType: "us-stock",
    outlook: makeOutlook({ signal: "short", strength: 60, directionScore: -0.6 }),
    ...candleSeries(accCandles),
  });

  const out = enrichAsset(asset, {});

  assert.ok(out.accumulation, "accumulation derived for SHORT us-stock");
  assert.ok(out.accumulation.score > 0, "fixture reads as accumulation (opposing the SHORT)");
  // Conviction must be dampened (opposing flow).
  assert.ok(out.outlook.strength < 60, "opposing flow dampens conviction on SHORT");
  // Signal must never flip.
  assert.equal(out.outlook.signal, "short", "signal stays SHORT — flow never flips it");
  assert.ok(
    out.outlook.reasons.warnings.some((w) => w.includes("dampened")),
    "dampening note appended",
  );
  // Original untouched.
  assert.equal(asset.outlook.strength, 60);
  assert.equal(asset.outlook.signal, "short");
});
