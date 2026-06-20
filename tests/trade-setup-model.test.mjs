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

test("recent run-up above the levels is enclosed, not clipped", async () => {
  const { buildTradeSetupModel } = await loadModule(SRC);
  // SHORT entered after a drop: levels sit BELOW a recent high plateau (mirrors
  // the SUI "kepotong" bug — entry 72.41, levels 67.8–73.89, price had run to ~81).
  const plan = {
    entry: 72.41, stopLoss: 73.89, takeProfit1: 70.77,
    takeProfit2: 69.29, takeProfit3: 67.8, riskRewardRatio: 2,
  };
  // Plateau near 80 (above every level) then drift down into the levels.
  const candles = makeCandles([78, 80, 80.5, 80.2, 79, 75, 73, 72]);
  const m = buildTradeSetupModel(candles, plan, "short", 71.49);

  const maxHigh = Math.max(...candles.map((c) => c.high));
  const minLow = Math.min(...candles.map((c) => c.low));
  assert.ok(m.priceMax >= maxHigh, "domain top encloses the recent high (no clip)");
  assert.ok(m.priceMin <= minLow, "domain bottom encloses the recent low (no clip)");
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

test("priceTicks: endpoints, length and ascending order", async () => {
  const { priceTicks } = await loadModule(SRC);
  const t = priceTicks(10, 20, 5);
  assert.equal(t.length, 5);
  assert.equal(t[0], 10);
  assert.equal(t[t.length - 1], 20);
  for (let i = 1; i < t.length; i++) assert.ok(t[i] > t[i - 1]);

  assert.deepEqual(priceTicks(0, 12, 4), [0, 4, 8, 12]); // custom count
  assert.deepEqual(priceTicks(5, 5), [5]); // degenerate
  assert.deepEqual(priceTicks(20, 10), [20]); // max < min
});

test("dateTickIndices: unique, in range, edge cases", async () => {
  const { dateTickIndices } = await loadModule(SRC);
  const idx = dateTickIndices(100, 7);
  assert.equal(idx.length, 7);
  assert.equal(idx[0], 0);
  assert.equal(idx[idx.length - 1], 99);
  assert.equal(new Set(idx).size, idx.length); // unique
  idx.forEach((i) => assert.ok(i >= 0 && i <= 99));

  assert.deepEqual(dateTickIndices(0), []); // empty
  assert.deepEqual(dateTickIndices(4, 7), [0, 1, 2, 3]); // length < count
});

test("mapMarkerToCandle: nearest index for in-range timestamps", async () => {
  const { mapMarkerToCandle } = await loadModule(SRC);
  // candles at t = 10, 20, 30, 40, 50
  const view = [10, 20, 30, 40, 50].map((timestamp) => ({ timestamp }));

  const mapped = mapMarkerToCandle(
    [
      { kind: "entry", timestamp: 22, price: 100 }, // nearest 20 → idx 1
      { kind: "close", timestamp: 38, price: 110, outcome: "profit" }, // nearest 40 → idx 3
    ],
    view,
  );
  assert.equal(mapped.length, 2);
  assert.equal(mapped[0].candleIndex, 1);
  assert.equal(mapped[0].kind, "entry");
  assert.equal(mapped[1].candleIndex, 3);
  assert.equal(mapped[1].outcome, "profit");
});

test("mapMarkerToCandle: edge timestamps map to first/last", async () => {
  const { mapMarkerToCandle } = await loadModule(SRC);
  const view = [10, 20, 30].map((timestamp) => ({ timestamp }));
  const mapped = mapMarkerToCandle(
    [
      { kind: "entry", timestamp: 10, price: 1 },
      { kind: "close", timestamp: 30, price: 2 },
    ],
    view,
  );
  assert.equal(mapped[0].candleIndex, 0);
  assert.equal(mapped[1].candleIndex, 2);
});

test("mapMarkerToCandle: clamps out-of-range markers to the nearest edge", async () => {
  const { mapMarkerToCandle } = await loadModule(SRC);
  const view = [10, 20, 30].map((timestamp) => ({ timestamp }));
  const mapped = mapMarkerToCandle(
    [
      { kind: "entry", timestamp: 5, price: 1 }, // before first → start edge
      { kind: "close", timestamp: 35, price: 2 }, // after last → end edge
      { kind: "entry", timestamp: 20, price: 3 }, // in range → nearest
    ],
    view,
  );
  assert.equal(mapped.length, 3);

  assert.equal(mapped[0].candleIndex, 0);
  assert.equal(mapped[0].outOfRange, true);
  assert.equal(mapped[0].edge, "start");

  assert.equal(mapped[1].candleIndex, 2);
  assert.equal(mapped[1].outOfRange, true);
  assert.equal(mapped[1].edge, "end");

  assert.equal(mapped[2].candleIndex, 1);
  assert.ok(!mapped[2].outOfRange);
});

test("mapMarkerToCandle: empty view returns []", async () => {
  const { mapMarkerToCandle } = await loadModule(SRC);
  assert.deepEqual(
    mapMarkerToCandle([{ kind: "entry", timestamp: 1, price: 1 }], []),
    [],
  );
});
