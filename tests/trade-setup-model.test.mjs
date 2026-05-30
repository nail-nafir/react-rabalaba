import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

let server;

async function loadModule(path) {
  if (!server) {
    server = await createServer({
      appType: "custom",
      configFile: "vite.config.ts",
      logLevel: "silent",
      server: { middlewareMode: true },
    });
  }
  return server.ssrLoadModule(path);
}

test.after(async () => {
  if (server) await server.close();
});

const SRC = "/src/features/trading-plan/lib/trade-setup-model.ts";

function makeCandles(prices) {
  return prices.map((close, i) => ({
    open: i === 0 ? close : prices[i - 1],
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
    timestamp: i + 1,
  }));
}

const longPlan = {
  entry: 100,
  stopLoss: 90,
  takeProfit1: 110,
  takeProfit2: 120,
  takeProfit3: 130,
  riskRewardRatio: 1,
};

const shortPlan = {
  entry: 100,
  stopLoss: 110,
  takeProfit1: 90,
  takeProfit2: 80,
  takeProfit3: 70,
  riskRewardRatio: 1,
};

test("priceToRatio maps endpoints and clamps", async () => {
  const { priceToRatio } = await loadModule(SRC);
  assert.equal(priceToRatio(0, 0, 10), 0);
  assert.equal(priceToRatio(10, 0, 10), 1);
  assert.equal(priceToRatio(5, 0, 10), 0.5);
  assert.equal(priceToRatio(-5, 0, 10), 0); // clamped
  assert.equal(priceToRatio(15, 0, 10), 1); // clamped
  assert.equal(priceToRatio(5, 5, 5), 0.5); // degenerate domain
});

test("long setup: domain covers all levels + candles, TP>entry>SL", async () => {
  const { buildTradeSetupModel } = await loadModule(SRC);
  const m = buildTradeSetupModel(makeCandles([85, 100, 120, 135]), longPlan, "long", 100);

  assert.equal(m.signal, "long");
  // wide price action → no cap needed → domain encloses the extreme level (130)
  assert.ok(m.priceMax > 130, "max encloses TP3");
  assert.ok(m.priceMin < 90, "min encloses SL");

  const byKey = Object.fromEntries(m.levels.map((l) => [l.key, l]));
  assert.ok(byKey.tp1.price > byKey.entry.price);
  assert.ok(byKey.sl.price < byKey.entry.price);
  assert.equal(m.risk, 10);
  assert.equal(byKey.entry.kind, "entry");
  assert.equal(byKey.sl.kind, "risk");
  assert.equal(byKey.tp3.kind, "profit");
});

test("scale follows recent action + levels, ignoring old far-away candles", async () => {
  const { buildTradeSetupModel } = await loadModule(SRC);
  const old = Array.from({ length: 60 }, (_, i) => ({
    open: 40, high: 42, low: 38, close: 41, volume: 1000, timestamp: i + 1,
  }));
  const recent = Array.from({ length: 60 }, (_, i) => ({
    open: 100, high: 102, low: 98, close: 101, volume: 1000, timestamp: i + 61,
  }));
  const plan = {
    entry: 100, stopLoss: 95, takeProfit1: 108,
    takeProfit2: 116, takeProfit3: 124, riskRewardRatio: 1.6,
  };
  const m = buildTradeSetupModel([...old, ...recent], plan, "long", 100);

  assert.ok(m.priceMin > 90, "old $40 candles do not drag the scale down");
  assert.ok(m.priceMax > 124, "domain still encloses the furthest TP");
});

test("R multiples increase across take-profits", async () => {
  const { buildTradeSetupModel } = await loadModule(SRC);
  const m = buildTradeSetupModel([], longPlan, "long", 100);
  const byKey = Object.fromEntries(m.levels.map((l) => [l.key, l]));
  assert.ok(byKey.tp1.rMultiple < byKey.tp2.rMultiple);
  assert.ok(byKey.tp2.rMultiple < byKey.tp3.rMultiple);
  assert.equal(byKey.tp1.rMultiple, 1); // 10/10
  assert.equal(byKey.entry.rMultiple, 0);
});

test("pctFromCurrent signs follow direction", async () => {
  const { buildTradeSetupModel } = await loadModule(SRC);
  const long = buildTradeSetupModel([], longPlan, "long", 100);
  const lk = Object.fromEntries(long.levels.map((l) => [l.key, l]));
  assert.ok(lk.tp1.pctFromCurrent > 0, "long TP above current");
  assert.ok(lk.sl.pctFromCurrent < 0, "long SL below current");

  const short = buildTradeSetupModel([], shortPlan, "short", 100);
  const sk = Object.fromEntries(short.levels.map((l) => [l.key, l]));
  assert.equal(short.signal, "short");
  assert.ok(sk.tp1.pctFromCurrent < 0, "short TP below current");
  assert.ok(sk.sl.pctFromCurrent > 0, "short SL above current");
});

test("robust with empty candles (domain from levels only)", async () => {
  const { buildTradeSetupModel } = await loadModule(SRC);
  const m = buildTradeSetupModel([], longPlan, "long", 100);
  assert.ok(Number.isFinite(m.priceMin));
  assert.ok(Number.isFinite(m.priceMax));
  assert.ok(m.priceMax > m.priceMin);
  assert.equal(m.levels.length, 5);
});

test("handles missing takeProfit3", async () => {
  const { buildTradeSetupModel } = await loadModule(SRC);
  const m = buildTradeSetupModel([], { ...longPlan, takeProfit3: undefined }, "long", 100);
  assert.equal(m.levels.filter((l) => l.kind === "profit").length, 2);
  assert.equal(m.profitZone.to, 120);
});
