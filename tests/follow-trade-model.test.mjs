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

const SRC = "/src/core/trade/follow-trade-model.ts";
const OUTCOME = "/src/features/follow-trade/model/follow-outcome.ts";

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

test("countTakeProfitsAtPrice mirrors secured TP levels for long and short", async () => {
  const { countTakeProfitsAtPrice } = await loadModule(SRC);
  assert.equal(countTakeProfitsAtPrice(longTrade(), 120), 1);
  assert.equal(countTakeProfitsAtPrice(longTrade(), 119), 0);
  assert.equal(countTakeProfitsAtPrice(shortTrade(), 70), 2);
  assert.equal(countTakeProfitsAtPrice(shortTrade(), 71), 1);
});

test("buildTradeWinrateSnapshots: closed trades are cumulative per symbol", async () => {
  const { buildTradeWinrateSnapshots } = await loadModule(SRC);
  const snapshots = buildTradeWinrateSnapshots([
    longTrade({
      id: "third",
      status: "sl",
      closePrice: 80,
      followedAt: 30,
      closedAt: 300,
    }),
    longTrade({
      id: "first",
      status: "sl",
      closePrice: 80,
      followedAt: 10,
      closedAt: 100,
    }),
    longTrade({
      id: "second",
      status: "tp1",
      closePrice: 120,
      followedAt: 20,
      closedAt: 200,
    }),
  ]);

  assert.deepEqual(snapshots.first, { wins: 0, total: 1 });
  assert.deepEqual(snapshots.second, { wins: 1, total: 2 });
  assert.deepEqual(snapshots.third, { wins: 1, total: 3 });
});

test("buildTradeWinrateSnapshots: symbols are tracked independently", async () => {
  const { buildTradeWinrateSnapshots } = await loadModule(SRC);
  const snapshots = buildTradeWinrateSnapshots([
    longTrade({
      id: "btc-loss",
      symbol: "BTC",
      status: "sl",
      closePrice: 80,
      closedAt: 100,
    }),
    longTrade({
      id: "eth-win",
      symbol: "ETH",
      name: "Ethereum",
      status: "tp1",
      closePrice: 120,
      closedAt: 200,
    }),
    longTrade({
      id: "btc-win",
      symbol: "BTC",
      status: "tp1",
      closePrice: 120,
      closedAt: 300,
    }),
  ]);

  assert.deepEqual(snapshots["btc-loss"], { wins: 0, total: 1 });
  assert.deepEqual(snapshots["eth-win"], { wins: 1, total: 1 });
  assert.deepEqual(snapshots["btc-win"], { wins: 1, total: 2 });
});

test("buildTradeWinrateSnapshots: open trades use only history before entry", async () => {
  const { buildTradeWinrateSnapshots } = await loadModule(SRC);
  const snapshots = buildTradeWinrateSnapshots([
    longTrade({
      id: "before-loss",
      status: "sl",
      closePrice: 80,
      followedAt: 10,
      closedAt: 100,
    }),
    longTrade({ id: "open-mid", status: "open", followedAt: 150 }),
    longTrade({
      id: "after-win",
      status: "tp1",
      closePrice: 120,
      followedAt: 160,
      closedAt: 200,
    }),
    longTrade({ id: "open-early", status: "open", followedAt: 50 }),
  ]);

  assert.deepEqual(snapshots["open-mid"], { wins: 0, total: 1 });
  assert.deepEqual(snapshots["open-early"], { wins: 0, total: 0 });
  assert.deepEqual(snapshots["after-win"], { wins: 1, total: 2 });
});

test("buildTradeWinrateSnapshots: breakeven does not change wins or denominator", async () => {
  const { buildTradeWinrateSnapshots } = await loadModule(SRC);
  const snapshots = buildTradeWinrateSnapshots([
    longTrade({
      id: "loss",
      status: "sl",
      closePrice: 80,
      closedAt: 100,
    }),
    longTrade({
      id: "flat",
      status: "sl",
      exitReason: "breakeven_stop",
      closePrice: 100,
      closedAt: 200,
    }),
    longTrade({
      id: "win",
      status: "tp1",
      closePrice: 120,
      closedAt: 300,
    }),
  ]);

  assert.deepEqual(snapshots.loss, { wins: 0, total: 1 });
  assert.deepEqual(snapshots.flat, { wins: 0, total: 1 });
  assert.deepEqual(snapshots.win, { wins: 1, total: 2 });
});

test("long 100 -> 150 closes at tp3", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  const ev = evaluateFollow(longTrade(), 150);
  assert.equal(ev.closed, true);
  assert.equal(ev.status, "tp3");
  assert.equal(ev.closePrice, 150);
  assert.equal(ev.exitReason, "final_take_profit");
});

test("long 100 -> 85 (no TP) closes as sl loss", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  const ev = evaluateFollow(longTrade(), 79);
  assert.equal(ev.closed, true);
  assert.equal(ev.status, "sl");
  assert.equal(ev.closePrice, 80);
  assert.equal(ev.exitReason, "initial_stop");
});

test("long: TP1 raises the next-step stop to entry", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  // first sync touches tp1 (125 >= 120) but stays open
  const mid = evaluateFollow(longTrade(), 125);
  assert.equal(mid.closed, false);
  assert.equal(mid.highestTpReached, 1);
  // A later sync applies the raised stop at entry.
  const ev = evaluateFollow(longTrade({ highestTpReached: 1 }), 80);
  assert.equal(ev.closed, true);
  assert.equal(ev.status, "sl");
  assert.equal(ev.highestTpReached, 1);
  assert.equal(ev.closePrice, 100);
  assert.equal(ev.exitReason, "breakeven_stop");
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
  // tp1 = 120; its newly raised entry stop does not apply retroactively inside
  // this candle, and the close remains above entry.
  const mid = evaluateFollow(longTrade(), 110, [
    { high: 122, low: 108, timestamp: 2000 },
  ]);
  assert.equal(mid.highestTpReached, 1);
  assert.equal(mid.closed, false);
  assert.equal(mid.status, "open");
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

test("order matters: TP1 before a retrace closes at the raised entry stop", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  // short: dips to tp1 first, THEN a later candle crosses the raised entry stop.
  const ev = evaluateFollow(shortTrade(), 100, [
    { high: 95, low: 79, timestamp: 1000 },
    { high: 121, low: 90, timestamp: 2000 },
  ]);
  assert.equal(ev.closed, true);
  assert.equal(ev.status, "sl");
  assert.equal(ev.highestTpReached, 1);
  assert.equal(ev.closePrice, 100);
  assert.equal(ev.closedAt, 2000);
  assert.equal(ev.exitReason, "breakeven_stop");
});

test("progressive LONG: TP2 raises the stop one rung behind to TP1", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  const t = longTrade({
    entryPrice: 100,
    stopLoss: 50,
    takeProfits: [150, 200, 250],
  });
  const ev = evaluateFollow(t, 35, [
    { high: 180, low: 100, timestamp: 1 },
    { high: 220, low: 180, timestamp: 2 },
    { high: 200, low: 35, timestamp: 3 },
  ]);
  assert.equal(ev.status, "sl");
  assert.equal(ev.highestTpReached, 2);
  assert.equal(ev.closePrice, 150);
  assert.equal(ev.closed, true);
  assert.equal(ev.exitReason, "progressive_stop");
});

test("spec LONG: 100→35 straight to SL is a stop-loss (no TP touched)", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  const t = longTrade({
    entryPrice: 100,
    stopLoss: 50,
    takeProfits: [150, 200, 250],
  });
  const ev = evaluateFollow(t, 35, [{ high: 100, low: 35, timestamp: 1 }]);
  assert.equal(ev.status, "sl");
  assert.equal(ev.closePrice, 50);
});

test("progressive SHORT: TP2 raises the stop one rung behind to TP1", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  const t = shortTrade({
    entryPrice: 700,
    stopLoss: 750,
    takeProfits: [500, 350, 250],
  });
  const ev = evaluateFollow(t, 800, [
    { high: 700, low: 400, timestamp: 1 },
    { high: 450, low: 320, timestamp: 2 },
    { high: 800, low: 320, timestamp: 3 },
  ]);
  assert.equal(ev.status, "sl");
  assert.equal(ev.highestTpReached, 2);
  assert.equal(ev.closePrice, 500);
  assert.equal(ev.exitReason, "progressive_stop");
});

test("spec SHORT: 700→800 straight to SL is a stop-loss", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  const t = shortTrade({
    entryPrice: 700,
    stopLoss: 750,
    takeProfits: [500, 350, 250],
  });
  const ev = evaluateFollow(t, 800, [{ high: 800, low: 700, timestamp: 1 }]);
  assert.equal(ev.status, "sl");
  assert.equal(ev.closePrice, 750);
});

test("same bar touches final TP and original SL: conservative stop-first outcome", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  // ONE candle dips to final TP3 and also spikes to the original SL.
  const ev = evaluateFollow(shortTrade(), 60, [
    { high: 121, low: 49, timestamp: 1 },
  ]);
  assert.equal(ev.status, "sl");
  assert.equal(ev.closePrice, 120);
  assert.equal(ev.closed, true);
});

test("a gap through the raised entry stop fills at the open", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  const ev = evaluateFollow(longTrade(), 115, [
    { open: 100, high: 122, low: 100, timestamp: 1000 },
    { open: 110, high: 115, low: 105, timestamp: 2000 },
    { open: 75, high: 78, low: 70, timestamp: 3000 },
  ]);

  assert.equal(ev.closed, true);
  assert.equal(ev.status, "sl");
  assert.equal(ev.highestTpReached, 1);
  assert.equal(ev.closePrice, 75);
  assert.equal(ev.closedAt, 3000);
  assert.equal(ev.exitReason, "breakeven_stop");
});

test("a newly raised stop never closes retroactively inside the TP candle", async () => {
  const { evaluateFollow } = await loadModule(SRC);
  const ev = evaluateFollow(longTrade(), 105, [
    { open: 100, high: 122, low: 95, close: 105, timestamp: 1000 },
  ]);

  assert.equal(ev.closed, false);
  assert.equal(ev.highestTpReached, 1);
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
  assert.equal(ev.exitReason, "final_take_profit");
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
  assert.equal(justClosed[0].exitReason, "final_take_profit");
  assert.equal(stillOpen.length, 2);
});

test("applyPriceSync reports a TP milestone while the trade stays open", async () => {
  const { applyPriceSync } = await loadModule(SRC);
  const trade = longTrade();
  const { stillOpen, justClosed, progressed } = applyPriceSync(
    [trade],
    { [trade.symbol]: 125 },
    {
      [trade.symbol]: [
        { open: 100, high: 122, low: 100, timestamp: 1000 },
      ],
    },
  );

  assert.equal(justClosed.length, 0);
  assert.equal(stillOpen[0].highestTpReached, 1);
  assert.equal(progressed[0].highestTpReached, 1);
});

test("buildTrackerStats: flat trades stay recorded but leave win-rate denominator", async () => {
  const { buildTrackerStats } = await loadModule(SRC);
  const win = longTrade({
    symbol: "A",
    status: "tp1",
    closePrice: 120,
    closedAt: 2,
  });
  const loss = longTrade({
    symbol: "B",
    status: "sl",
    closePrice: 80,
    closedAt: 1,
  });
  const flat = longTrade({
    symbol: "C",
    status: "sl",
    exitReason: "breakeven_stop",
    closePrice: 100,
    closedAt: 3,
  });
  const stats = buildTrackerStats([win, loss, flat], 3);
  assert.equal(stats.closed, 3);
  assert.equal(stats.open, 3);
  assert.equal(stats.totalFollowed, 6);
  assert.equal(stats.winRate, 50);
  assert.deepEqual(stats.winLoss, { wins: 1, losses: 1, breakevens: 1 });
  // ordered by closedAt: loss (-1R) then win (+1R) => cum ends at 0
  assert.equal(stats.equitySeries[0].symbol, "B");
  assert.equal(stats.equitySeries[1].cumR, 0);
  assert.equal(stats.perAsset.length, 3);
  assert.equal(stats.longVsShort[0].signal, "long");
  assert.equal(stats.longVsShort[0].count, 3);
});

test("deriveFollowProgress: open trade lights up TP from live candles", async () => {
  const { deriveFollowProgress } = await loadModule(SRC);
  // open trade; an intraday candle wicks through TP2 (132 >= 130) then pulls back.
  const p = deriveFollowProgress(longTrade(), 128, [
    { high: 132, low: 100, timestamp: 10 },
  ]);
  assert.equal(p.lifecycle, "open");
  assert.equal(p.tpReached, 2);
  assert.equal(p.tpSecured, 0);
  assert.equal(p.tpTotal, 3);
  assert.equal(p.slHit, false);
});

test("deriveFollowProgress: never downgrades below the stored milestone", async () => {
  const { deriveFollowProgress } = await loadModule(SRC);
  // stored floor = 1, but the fetched candle window shows no TP touch (115 < 120).
  // A truncated candle window must not erase the persisted milestone.
  const p = deriveFollowProgress(longTrade({ highestTpReached: 1 }), 110, [
    { high: 115, low: 105, timestamp: 10 },
  ]);
  assert.equal(p.lifecycle, "open");
  assert.equal(p.tpReached, 1);
});

test("deriveFollowProgress: closed sl -> slHit, no TP", async () => {
  const { deriveFollowProgress } = await loadModule(SRC);
  const p = deriveFollowProgress(
    longTrade({ status: "sl", highestTpReached: 0, closePrice: 80 }),
    80,
  );
  assert.equal(p.lifecycle, "closed");
  assert.equal(p.slHit, true);
  assert.equal(p.tpReached, 0);
  assert.equal(p.tpSecured, 0);
  assert.equal(p.exitReason, "initial_stop");
});

test("deriveFollowProgress: closed tp3 -> all pips, no SL", async () => {
  const { deriveFollowProgress } = await loadModule(SRC);
  const p = deriveFollowProgress(
    longTrade({ status: "tp3", highestTpReached: 3, closePrice: 150 }),
    150,
  );
  assert.equal(p.lifecycle, "closed");
  assert.equal(p.tpReached, 3);
  assert.equal(p.tpSecured, 3);
  assert.equal(p.slHit, false);
  assert.equal(p.exitReason, "final_take_profit");
});

test("deriveFollowProgress derives the secured rung from the actual close price", async () => {
  const { deriveFollowProgress } = await loadModule(SRC);
  const historicalV3 = deriveFollowProgress(
    longTrade({
      status: "tp2",
      highestTpReached: 2,
      closePrice: 130,
      engineVersion: "engine-v3",
    }),
    130,
  );
  const progressiveV4 = deriveFollowProgress(
    longTrade({
      status: "sl",
      highestTpReached: 2,
      closePrice: 120,
      exitReason: "progressive_stop",
      engineVersion: "engine-v4",
    }),
    120,
  );
  const breakeven = deriveFollowProgress(
    longTrade({
      status: "sl",
      highestTpReached: 1,
      closePrice: 100,
      exitReason: "breakeven_stop",
      engineVersion: "engine-v4",
    }),
    100,
  );
  const gapLoss = deriveFollowProgress(
    longTrade({
      status: "sl",
      highestTpReached: 2,
      closePrice: 75,
      exitReason: "progressive_stop",
      engineVersion: "engine-v4",
    }),
    75,
  );

  assert.equal(historicalV3.exitReason, "progressive_stop");
  assert.equal(historicalV3.tpSecured, 2);
  assert.equal(progressiveV4.tpSecured, 1);
  assert.equal(breakeven.tpSecured, 0);
  assert.equal(gapLoss.tpSecured, 0);
});

test("tradeOutcomeBucket groups protected profit as TP and keeps zero neutral", async () => {
  const { tradeOutcomeBucket } = await loadModule(SRC);
  assert.equal(
    tradeOutcomeBucket(
      longTrade({
        status: "sl",
        exitReason: "progressive_stop",
        highestTpReached: 2,
        closePrice: 120,
      }),
    ),
    "tp",
  );
  assert.equal(
    tradeOutcomeBucket(
      longTrade({
        status: "sl",
        exitReason: "breakeven_stop",
        highestTpReached: 1,
        closePrice: 100,
      }),
    ),
    "breakeven",
  );
  assert.equal(
    tradeOutcomeBucket(
      longTrade({
        status: "sl",
        exitReason: "progressive_stop",
        highestTpReached: 2,
        closePrice: 75,
      }),
    ),
    "sl",
  );
});

test("trade outcome labels show realized result instead of active-stop internals", async () => {
  const { tradeOutcomeLabel } = await loadModule(OUTCOME);
  const t = (key, values = {}) => {
    if (key === "journal.tp_progress") {
      return `TP ${values.reached}/${values.total}`;
    }
    return {
      "journal.outcome_initial_stop": "SL",
      "journal.outcome_breakeven": "BE",
      "journal.outcome_reversal": "REVERSAL",
      "journal.outcome_closed": "CLOSED",
    }[key];
  };

  assert.equal(tradeOutcomeLabel(t, "progressive_stop", 1, 3, "profit"), "TP 1/3");
  assert.equal(tradeOutcomeLabel(t, "breakeven_stop", 0, 3, "flat"), "BE");
  assert.equal(tradeOutcomeLabel(t, "progressive_stop", 0, 3, "loss"), "SL");
  assert.equal(tradeOutcomeLabel(t, "final_take_profit", 3, 3, "profit"), "TP 3/3");
});
