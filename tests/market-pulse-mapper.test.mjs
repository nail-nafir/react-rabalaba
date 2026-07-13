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
    // Vite SSR server teardown reject is ignored.
  }
});

function makeMockAsset(symbol, price, changePercent, outlookOverrides = {}) {
  return {
    symbol,
    name: symbol,
    price,
    changePercent,
    volume: 1000000,
    quoteIndicators: {
      close: [price * 0.95, price * 0.98, price],
      volume: [100, 150, 200],
      high: [],
      low: [],
      open: []
    },
    outlook: {
      trend: "bullish",
      regime: "trending",
      directionScore: 0.8,
      ...outlookOverrides
    }
  };
}

test("risk-appetite helpers normalize, clamp, and blend predictably", async () => {
  const {
    combineRiskAppetiteScore,
    directionScoreToPercent,
    inverseChangeScore,
    vixLevelToAppetite
  } = await loadModule("/src/features/market/lib/market-pulse-mapper.ts");

  assert.deepEqual(
    [-1, 0, 1].map(directionScoreToPercent),
    [0, 50, 100]
  );
  assert.deepEqual(
    [-1, 0, 1].map((value) => inverseChangeScore(value, 1)),
    [100, 50, 0]
  );
  assert.deepEqual(
    [15, 17.5, 20].map(vixLevelToAppetite),
    [100, 50, 0]
  );
  assert.equal(directionScoreToPercent(2), 100);
  assert.equal(directionScoreToPercent(Number.NaN), 50);
  assert.equal(inverseChangeScore(2, 1), 0);
  assert.equal(inverseChangeScore(Number.NaN, 1), undefined);
  assert.equal(combineRiskAppetiteScore(80, 75), 79);
  assert.equal(combineRiskAppetiteScore(80, undefined), 80);
  assert.equal(combineRiskAppetiteScore(undefined, 75), 75);
  assert.equal(combineRiskAppetiteScore(undefined, undefined), 50);
});

test("mapCryptoCard maps crypto context, F&G, and dominance correctly", async () => {
  const { mapCryptoCard } = await loadModule("/src/features/market/lib/market-pulse-mapper.ts");

  const cryptoContext = {
    btcTrend: "bullish",
    btcRegime: "trending",
    btcDirectionScore: 0.6,
    riskState: "risk_on",
    dominance: { btc: 55.4, eth: 18.2 },
    lastUpdated: 1000
  };

  const fearGreed = { value: 75, label: "Greed" };
  const btcAsset = makeMockAsset("BTC-USD", 65000, 2.5);
  const ethAsset = makeMockAsset("ETH-USD", 3500, 1.2);

  const result = mapCryptoCard(cryptoContext, fearGreed, btcAsset, ethAsset);

  assert.equal(result.id, "crypto");
  assert.equal(result.score, 79);
  assert.equal(result.scoreKind, "risk_appetite");
  assert.equal(result.trend, "bullish");
  assert.equal(result.headlineValue, "$65,000");
  assert.equal(result.status, "active");
});

test("mapCryptoCard degrades status on missing F&G or dominance", async () => {
  const { mapCryptoCard } = await loadModule("/src/features/market/lib/market-pulse-mapper.ts");

  const cryptoContext = {
    btcTrend: "bullish",
    btcRegime: "trending",
    btcDirectionScore: 0.6,
    riskState: "risk_on",
    lastUpdated: 1000
  };

  const btcAsset = makeMockAsset("BTC-USD", 65000, 2.5);

  const result = mapCryptoCard(cryptoContext, null, btcAsset, null);

  assert.equal(result.id, "crypto");
  // since F&G is null, it should fallback to mapped BTC direction score: (0.6 + 1) * 50 = 80
  assert.equal(result.score, 80);
  assert.equal(result.scoreKind, "risk_appetite");
  assert.equal(result.status, "degraded");
});

test("mapIdEquityCard maps IHSG score, Rupiah pressure, and return correctly", async () => {
  const { mapIdEquityCard } = await loadModule("/src/features/market/lib/market-pulse-mapper.ts");

  const idxContext = {
    ihsgTrend: "bullish",
    ihsgRegime: "trending",
    ihsgDirectionScore: 0.4,
    riskState: "risk_on",
    usdIdrTrend: "bullish",
    usdIdr1wChangePercent: 0.2,
    ihsgReturns: { r1w: 1.5, r1m: 3.2 },
    lastUpdated: 1000
  };

  const ihsgAsset = makeMockAsset("^JKSE", 7200, 0.5);
  const usdIdrAsset = makeMockAsset("USDIDR=X", 15450, 0.7);

  const result = mapIdEquityCard(idxContext, ihsgAsset, usdIdrAsset);

  assert.equal(result.id, "id-equity");
  assert.equal(result.score, 61); // tech 70 × 70% + USDIDR context 40 × 30%
  assert.equal(result.scoreKind, "risk_appetite");
  assert.equal(result.status, "active");
});

test("mapIdEquityCard falls back to technical score without weekly rupiah context", async () => {
  const { mapIdEquityCard } = await loadModule("/src/features/market/lib/market-pulse-mapper.ts");
  const ihsgAsset = makeMockAsset("^JKSE", 7200, 0.5, { directionScore: 0.4 });
  const usdIdrAsset = makeMockAsset("USDIDR=X", 15450, 0.7);
  const result = mapIdEquityCard({
    ihsgTrend: "bullish",
    ihsgRegime: "trending",
    ihsgDirectionScore: 0.4,
    riskState: "risk_on",
    usdIdrTrend: "sideways",
    lastUpdated: 1000
  }, ihsgAsset, usdIdrAsset);

  assert.equal(result.score, 70);
  assert.equal(result.status, "degraded");
});

test("mapUsEquityCard maps S&P 500, VIX, and DXY correctly", async () => {
  const { mapUsEquityCard } = await loadModule("/src/features/market/lib/market-pulse-mapper.ts");

  const usContext = {
    spxTrend: "bearish",
    spxRegime: "trending",
    spxDirectionScore: -0.5,
    riskState: "risk_off",
    vixLevel: 15,
    vix1wChangePercent: -10,
    dxy1wChangePercent: -1,
    lastUpdated: 1000
  };

  const spxAsset = makeMockAsset("^GSPC", 5100, -1.2);
  const vixAsset = makeMockAsset("^VIX", 15, 5.0);
  const dxyAsset = makeMockAsset("DX-Y.NYB", 104.5, 0.3);

  const result = mapUsEquityCard(usContext, spxAsset, vixAsset, dxyAsset);

  assert.equal(result.id, "us-equity");
  assert.equal(result.score, 48); // tech 25 × 70% + context 100 × 30%
  assert.equal(result.scoreKind, "risk_appetite");
  assert.equal(result.status, "active");
});

test("mapUsEquityCard falls back to technical score without VIX/DXY context", async () => {
  const { mapUsEquityCard } = await loadModule("/src/features/market/lib/market-pulse-mapper.ts");
  const spxAsset = makeMockAsset("^GSPC", 5100, -1.2, { directionScore: -0.5 });
  const result = mapUsEquityCard({
    spxTrend: "bearish",
    spxRegime: "trending",
    spxDirectionScore: -0.5,
    riskState: "risk_off",
    lastUpdated: 1000
  }, spxAsset, null, null);

  assert.equal(result.score, 25);
  assert.equal(result.status, "degraded");
});

test("mapCommoditiesCard maps Gold technical (inverted) and global macro context", async () => {
  const { mapCommoditiesCard } = await loadModule("/src/features/market/lib/market-pulse-mapper.ts");

  const gold = makeMockAsset("GC=F", 2350, 1.2, { directionScore: 0.8, trend: "bullish" });
  const vix = makeMockAsset("^VIX", 17.5, -1);
  const dxy = makeMockAsset("DX-Y.NYB", 104.2, -0.2);
  const usContext = {
    spxTrend: "sideways",
    spxRegime: "ranging",
    spxDirectionScore: 0,
    riskState: "neutral",
    vixLevel: 17.5,
    vix1wChangePercent: -10,
    dxy1wChangePercent: -0.5,
    lastUpdated: 1000
  };

  const result = mapCommoditiesCard(gold, usContext, vix, dxy);

  assert.equal(result.id, "commodities");
  // Gold up = risk-off, so invert tech: 100 - 90 = 10. Blended with macro 75 => 30.
  assert.equal(result.score, 30);
  assert.equal(result.scoreKind, "risk_appetite");
  assert.equal(result.trend, "bearish");
  assert.equal(result.headlineValue, "$2,350");
  assert.equal(result.status, "active");
  assert.equal(result.sparkline.length, 3);
});

test("mapCommoditiesCard falls back to Gold technical without macro", async () => {
  const { mapCommoditiesCard } = await loadModule("/src/features/market/lib/market-pulse-mapper.ts");
  const gold = makeMockAsset("GC=F", 2350, 1.2, { directionScore: 0.8 });

  const result = mapCommoditiesCard(gold, null, null, null);

  // Inverted tech 10, no macro.
  assert.equal(result.score, 10);
  assert.equal(result.scoreKind, "risk_appetite");
  assert.equal(result.status, "degraded");
});

test("mapCommoditiesCard sparkline returns raw Gold closes", async () => {
  const { mapCommoditiesCard } = await loadModule("/src/features/market/lib/market-pulse-mapper.ts");
  const gold = makeMockAsset("GC=F", 2350, 1.2, { directionScore: 0.8 });
  gold.quoteIndicators.close = [100, 200, 300];

  const result = mapCommoditiesCard(gold, null, null, null);

  assert.deepEqual(result.sparkline, [100, 200, 300]);
});

test("mapCommoditiesCard uses macro-only when technical data is not ready", async () => {
  const { mapCommoditiesCard } = await loadModule("/src/features/market/lib/market-pulse-mapper.ts");
  const gold = makeMockAsset("GC=F", 2350, 1.2, { directionScore: 0.8 });
  gold.outlook.dataQuality = { ready: false };
  const vix = makeMockAsset("^VIX", 17.5, -1);
  const dxy = makeMockAsset("DX-Y.NYB", 104.2, -0.2);
  const usContext = {
    spxTrend: "sideways",
    spxRegime: "ranging",
    spxDirectionScore: 0,
    riskState: "neutral",
    vixLevel: 17.5,
    vix1wChangePercent: -10,
    dxy1wChangePercent: -0.5,
    lastUpdated: 1000
  };

  const result = mapCommoditiesCard(gold, usContext, vix, dxy);

  assert.equal(result.score, 75);
  assert.equal(result.status, "degraded");
});

test("mapCommoditiesCard errors when Gold is unavailable", async () => {
  const { mapCommoditiesCard } = await loadModule("/src/features/market/lib/market-pulse-mapper.ts");

  const result = mapCommoditiesCard(null, null, null, null);

  assert.equal(result.score, 50);
  assert.equal(result.status, "error");
});

test("mapForexCard errors when USD/IDR is unavailable", async () => {
  const { mapForexCard } = await loadModule("/src/features/market/lib/market-pulse-mapper.ts");

  const result = mapForexCard(null, null, null, null);

  assert.equal(result.score, 50);
  assert.equal(result.status, "error");
});

test("mapForexCard maps USD/IDR technical (inverted) and global macro context", async () => {
  const { mapForexCard } = await loadModule("/src/features/market/lib/market-pulse-mapper.ts");

  const usdIdr = makeMockAsset("USDIDR=X", 16450, 0.5, { directionScore: 0.4, trend: "bullish" });
  const vix = makeMockAsset("^VIX", 17.5, -1);
  const dxy = makeMockAsset("DX-Y.NYB", 104.2, -0.2);
  const usContext = {
    spxTrend: "sideways",
    spxRegime: "ranging",
    spxDirectionScore: 0,
    riskState: "neutral",
    vixLevel: 17.5,
    vix1wChangePercent: -10,
    dxy1wChangePercent: -0.5,
    lastUpdated: 1000
  };

  const result = mapForexCard(usdIdr, usContext, vix, dxy);

  assert.equal(result.id, "forex");
  // USD/IDR up = risk-off, so invert tech: 100 - 70 = 30. Blended with macro 75 => 44.
  assert.equal(result.score, 44);
  assert.equal(result.scoreKind, "risk_appetite");
  assert.equal(result.headlineValue, "16,450");
  assert.equal(result.trend, "bearish");
  assert.equal(result.status, "active");
  assert.equal(result.sparkline.length, 3);
});

test("mapForexCard uses macro-only when direct technical data is not ready", async () => {
  const { mapForexCard } = await loadModule("/src/features/market/lib/market-pulse-mapper.ts");
  const usdIdr = makeMockAsset("USDIDR=X", 16450, 0.5, { directionScore: 0.4 });
  usdIdr.outlook.dataQuality = { ready: false };
  const vix = makeMockAsset("^VIX", 17.5, -1);
  const dxy = makeMockAsset("DX-Y.NYB", 104.2, -0.2);
  const usContext = {
    spxTrend: "sideways",
    spxRegime: "ranging",
    spxDirectionScore: 0,
    riskState: "neutral",
    vixLevel: 17.5,
    vix1wChangePercent: -10,
    dxy1wChangePercent: -0.5,
    lastUpdated: 1000
  };

  const result = mapForexCard(usdIdr, usContext, vix, dxy);

  assert.equal(result.score, 75);
  assert.equal(result.status, "degraded");
});

test("mapForexCard falls back to USD/IDR technical without macro", async () => {
  const { mapForexCard } = await loadModule("/src/features/market/lib/market-pulse-mapper.ts");
  const usdIdr = makeMockAsset("USDIDR=X", 16450, 0.5, { directionScore: 0.4 });

  const result = mapForexCard(usdIdr, null, null, null);

  // Inverted tech 30, no macro.
  assert.equal(result.score, 30);
  assert.equal(result.status, "degraded");
});
