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

test("short: TP3 touched by a low wick closes at tp3 with the REAL hit time", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  // Current price 85 is ABOVE tp3 (50) — a snapshot alone would miss it — but a
  // candle's low wicked to 49 at t=5000, hitting the whole TP ladder intraday.
  const ev = evaluateFollow(shortTrade(), 85, [
    { high: 110, low: 75, timestamp: 4000 },
    { high: 64, low: 49, timestamp: 5000 },
  ]);
  assert.equal(ev.closed, true);
  assert.equal(ev.status, "tp3");
  assert.equal(ev.closePrice, 50);
  assert.equal(ev.closedAt, 5000); // when the low first crossed tp3, not "now"
});

test("long: candle extremes drive TP (high wick) + SL (low wick) + hit time", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  // tp1 = 120; price 110 but a high wicked to 122 -> tp1 reached, stays open
  const mid = evaluateFollow(longTrade(), 110, [
    { high: 122, low: 108, timestamp: 2000 },
  ]);
  assert.equal(mid.highestTpReached, 1);
  assert.equal(mid.closed, false);
  // sl = 80; price 100 but a low wicked to 79 at t=3000 -> stop hit
  const sl = evaluateFollow(longTrade(), 100, [
    { high: 101, low: 79, timestamp: 3000 },
  ]);
  assert.equal(sl.closed, true);
  assert.equal(sl.status, "sl");
  assert.equal(sl.closePrice, 80);
  assert.equal(sl.closedAt, 3000);
});

test("order matters: SL hit BEFORE any TP closes as a loss, not a secured TP", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  // short (SL 120, tp [80,70,50]). An early candle spikes the high to 121 (stop)
  // BEFORE a later candle's low reaches a TP — must be a loss, not "secured tp".
  const ev = evaluateFollow(shortTrade(), 60, [
    { high: 121, low: 100, timestamp: 1000 }, // stop hit first
    { high: 82, low: 60, timestamp: 2000 }, // later dips to tp2 — too late
  ]);
  assert.equal(ev.closed, true);
  assert.equal(ev.status, "sl");
  assert.equal(ev.closePrice, 120);
  assert.equal(ev.closedAt, 1000);
});

test("order matters: TP1 hit BEFORE SL secures a close at tp1", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  // short: dips to tp1 (79 <= 80) first, THEN a later candle spikes to SL 120.
  const ev = evaluateFollow(shortTrade(), 100, [
    { high: 95, low: 79, timestamp: 1000 },
    { high: 121, low: 90, timestamp: 2000 },
  ]);
  assert.equal(ev.closed, true);
  assert.equal(ev.status, "tp1");
  assert.equal(ev.closePrice, 80);
  assert.equal(ev.closedAt, 2000); // closed when the stop hit, securing tp1
});

// ── User spec: SL-loss only when NO TP was ever touched; a touched TP secures ──
test("spec LONG: 100→180→220→35 secures tp2 (tp1+tp2 touched, then SL)", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  const t = longTrade({ entryPrice: 100, stopLoss: 50, takeProfits: [150, 200, 250] });
  const ev = evaluateFollow(t, 35, [
    { high: 180, low: 100, timestamp: 1 },
    { high: 220, low: 180, timestamp: 2 },
    { high: 200, low: 35, timestamp: 3 },
  ]);
  assert.equal(ev.status, "tp2");
  assert.equal(ev.closePrice, 200);
  assert.equal(ev.closed, true);
});

test("spec LONG: 100→35 straight to SL is a stop-loss (no TP touched)", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  const t = longTrade({ entryPrice: 100, stopLoss: 50, takeProfits: [150, 200, 250] });
  const ev = evaluateFollow(t, 35, [{ high: 100, low: 35, timestamp: 1 }]);
  assert.equal(ev.status, "sl");
  assert.equal(ev.closePrice, 50);
});

test("spec SHORT: 700→400→320→800 secures tp2", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  const t = shortTrade({ entryPrice: 700, stopLoss: 750, takeProfits: [500, 350, 250] });
  const ev = evaluateFollow(t, 800, [
    { high: 700, low: 400, timestamp: 1 },
    { high: 450, low: 320, timestamp: 2 },
    { high: 800, low: 320, timestamp: 3 },
  ]);
  assert.equal(ev.status, "tp2");
  assert.equal(ev.closePrice, 350);
});

test("spec SHORT: 700→800 straight to SL is a stop-loss", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  const t = shortTrade({ entryPrice: 700, stopLoss: 750, takeProfits: [500, 350, 250] });
  const ev = evaluateFollow(t, 800, [{ high: 800, low: 700, timestamp: 1 }]);
  assert.equal(ev.status, "sl");
  assert.equal(ev.closePrice, 750);
});

test("same bar touches a TP and the SL: the TP is secured (taken), not a loss", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  // ONE candle dips to tp1 (low 79 <= 80) and also spikes to SL (high 121).
  const ev = evaluateFollow(shortTrade(), 60, [
    { high: 121, low: 79, timestamp: 1 },
  ]);
  assert.equal(ev.status, "tp1");
  assert.equal(ev.closePrice, 80);
  assert.equal(ev.closed, true);
});

test("evaluateFollow falls back to the snapshot price when no range is given", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  // short, price 75 (above tp3 50), no range -> only tp1 reached, stays open
  const ev = evaluateFollow(shortTrade(), 75);
  assert.equal(ev.closed, false);
  assert.equal(ev.highestTpReached, 1);
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
