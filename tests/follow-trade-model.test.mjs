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

const SRC = "/src/features/follow-trade/lib/follow-trade-model.ts";

// entry 100, tp1 120, tp2 130, tp3 150, sl 80 (matches the user's example)
function longTrade(overrides = {}) {
  return {
    id: "x",
    symbol: "BTC",
    name: "Bitcoin",
    assetType: "crypto",
    signal: "long",
    timeframe: "1d",
    entryPrice: 100,
    stopLoss: 80,
    takeProfits: [120, 130, 150],
    riskRewardRatio: 2,
    strengthAtEntry: 70,
    followedAt: 1,
    highestTpReached: 0,
    status: "open",
    ...overrides,
  };
}

function shortTrade(overrides = {}) {
  return longTrade({
    signal: "short",
    stopLoss: 120,
    takeProfits: [80, 70, 50],
    ...overrides,
  });
}

test("computePnl: long sign + R", async () => {
  const { computePnl } = await loadModule(SRC);
  const t = longTrade();
  const up = computePnl(t, 120);
  assert.ok(up.pct > 0 && up.r > 0);
  assert.equal(up.r, 1); // (120-100)/20
  const down = computePnl(t, 90);
  assert.ok(down.pct < 0 && down.r < 0);
});

test("computePnl: short sign flips", async () => {
  const { computePnl } = await loadModule(SRC);
  const t = shortTrade();
  assert.ok(computePnl(t, 80).r > 0); // price down = profit for short
  assert.ok(computePnl(t, 110).r < 0);
});

test("long 100 -> 150 closes at tp3", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  const ev = evaluateFollow(longTrade(), 150);
  assert.equal(ev.closed, true);
  assert.equal(ev.status, "tp3");
  assert.equal(ev.closePrice, 150);
});

test("long 100 -> 85 (no TP) closes as sl loss", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  const ev = evaluateFollow(longTrade(), 79);
  assert.equal(ev.closed, true);
  assert.equal(ev.status, "sl");
  assert.equal(ev.closePrice, 80);
});

test("long: tp1 touched then SL -> secured close at tp1", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  // first sync touches tp1 (125 >= 120) but stays open
  const mid = evaluateFollow(longTrade(), 125);
  assert.equal(mid.closed, false);
  assert.equal(mid.highestTpReached, 1);
  // later sync drops to SL with milestone remembered
  const ev = evaluateFollow(longTrade({ highestTpReached: 1 }), 80);
  assert.equal(ev.closed, true);
  assert.equal(ev.status, "tp1");
  assert.equal(ev.closePrice, 120);
});

test("short mirror: 100 -> 50 closes at tp3", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  const ev = evaluateFollow(shortTrade(), 50);
  assert.equal(ev.closed, true);
  assert.equal(ev.status, "tp3");
});

test("missing tp3: final TP is tp2", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  const ev = evaluateFollow(longTrade({ takeProfits: [120, 130] }), 135);
  assert.equal(ev.status, "tp2");
  assert.equal(ev.closed, true);
});

test("applyPriceSync partitions open/closed and skips missing prices", async () => {
  const { applyPriceSync } = await loadModule(SRC);
  const a = longTrade({ id: "a", symbol: "A" });
  const b = longTrade({ id: "b", symbol: "B" });
  const c = longTrade({ id: "c", symbol: "C" });
  const { stillOpen, justClosed } = applyPriceSync([a, b, c], {
    A: 150, // closes tp3
    B: 105, // open
    // C missing -> stays open untouched
  });
  assert.equal(justClosed.length, 1);
  assert.equal(justClosed[0].symbol, "A");
  assert.ok(justClosed[0].closedAt > 0);
  assert.equal(stillOpen.length, 2);
});

test("buildTrackerStats: win rate, cumulative equity, per-asset, direction", async () => {
  const { buildTrackerStats } = await loadModule(SRC);
  const win = longTrade({ symbol: "A", status: "tp1", closePrice: 120, closedAt: 2 });
  const loss = longTrade({ symbol: "B", status: "sl", closePrice: 80, closedAt: 1 });
  const stats = buildTrackerStats([win, loss], 3);
  assert.equal(stats.closed, 2);
  assert.equal(stats.open, 3);
  assert.equal(stats.totalFollowed, 5);
  assert.equal(stats.winRate, 50);
  // ordered by closedAt: loss (-1R) then win (+1R) => cum ends at 0
  assert.equal(stats.equitySeries[0].symbol, "B");
  assert.equal(stats.equitySeries[1].cumR, 0);
  assert.equal(stats.perAsset.length, 2);
  assert.equal(stats.longVsShort[0].signal, "long");
  assert.equal(stats.longVsShort[0].count, 2);
});
