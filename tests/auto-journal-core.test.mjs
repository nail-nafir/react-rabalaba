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

const CORE = "/src/core/auto-journal-core.ts";

/** A signal-bearing asset the cron would emit (long/short + plan). */
function makeAsset({ symbol, signal, price = 100, sl = 90, tps = [110, 120], quoteTime = Date.now(), assetType = "crypto" }) {
  const neutral = signal === "neutral";
  return {
    symbol,
    name: symbol,
    assetType,
    timeframe: "1mo",
    price,
    quoteTime,
    outlook: { signal, strength: neutral ? 10 : 70, tier: neutral ? "C" : "B" },
    tradingPlan: neutral
      ? null
      : {
          stopLoss: sl,
          takeProfit1: tps[0],
          takeProfit2: tps[1],
          takeProfit3: undefined,
          riskRewardRatio: 2,
        },
  };
}

/** An open journal_trades row (status 'open'). */
function makeRow({ symbol, signal = "long", entry = 100, stop = 90, tps = [110], openedAtMs }) {
  const iso = new Date(openedAtMs).toISOString();
  return {
    id: `${symbol}-id`,
    symbol,
    name: symbol,
    asset_type: "crypto",
    signal,
    timeframe: "1mo",
    entry_price: entry,
    stop_loss: stop,
    take_profits: tps,
    risk_reward_ratio: 2,
    strength_at_entry: 70,
    grade: "B",
    status: "open",
    highest_tp_reached: 0,
    opened_at: iso,
    closed_at: null,
    close_price: null,
    created_at: iso,
    updated_at: iso,
  };
}

/** An asset carrying daily candles since `openedAtMs` (for the sync path). */
function makeCandleAsset({ symbol, price, openedAtMs, highs, lows, closes, signal = "long", quoteTime = Date.now(), assetType = "crypto" }) {
  const baseSec = Math.floor(openedAtMs / 1000) + 3600; // first bar 1h after entry
  return {
    symbol,
    name: symbol,
    assetType,
    timeframe: "1mo",
    price,
    quoteTime,
    outlook: { signal, strength: 70, tier: "B" },
    tradingPlan: null, // already open → never re-emitted; keep emit out of it
    quoteIndicators: {
      open: highs.map(() => price),
      high: highs,
      // lows/closes default to the old derived shape; pass them to DECOUPLE candle
      // reality from the spot `price` (needed to exercise the phantom-spot guard).
      low: lows ?? highs.map((h) => h - 5),
      close: closes ?? highs.map(() => price),
      volume: highs.map(() => 1000),
    },
    timestamps: highs.map((_, i) => baseSec + i * 3600),
  };
}

test("runAutoJournal: emits long/short with a plan, skips neutral", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const assets = [
    makeAsset({ symbol: "AAA", signal: "long" }),
    makeAsset({ symbol: "BBB", signal: "neutral" }),
    makeAsset({ symbol: "CCC", signal: "short", sl: 110, tps: [90, 80] }),
  ];

  const { inserts, closures } = runAutoJournal(assets, []);

  const symbols = inserts.map((i) => i.symbol).sort();
  assert.deepEqual(symbols, ["AAA", "CCC"], "neutral skipped, long+short emitted");
  assert.equal(inserts.find((i) => i.symbol === "AAA").signal, "long");
  assert.equal(inserts.find((i) => i.symbol === "CCC").signal, "short");
  assert.equal(inserts[0].status, "open");
  assert.equal(closures.length, 0);
});

test("runAutoJournal: dedup — skips a symbol that already has an open trade", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const assets = [
    makeAsset({ symbol: "AAA", signal: "long" }),
    makeAsset({ symbol: "BBB", signal: "long" }),
  ];
  const openRows = [makeRow({ symbol: "AAA", openedAtMs: Date.UTC(2024, 0, 1) })];

  const { inserts } = runAutoJournal(assets, openRows);

  assert.deepEqual(inserts.map((i) => i.symbol), ["BBB"], "AAA already open → not re-emitted");
});

test("runAutoJournal: closes an open trade when a candle hits the final TP", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const openedAtMs = Date.UTC(2024, 0, 1);
  const openRows = [makeRow({ symbol: "AAA", entry: 100, stop: 90, tps: [110], openedAtMs })];
  // High reaches 112 (>= TP 110) on the 2nd bar; lows stay above the 90 stop.
  const assets = [makeCandleAsset({ symbol: "AAA", price: 112, openedAtMs, highs: [108, 112] })];

  const { closures, inserts } = runAutoJournal(assets, openRows);

  assert.equal(inserts.length, 0, "open symbol is not re-emitted");
  assert.equal(closures.length, 1, "TP hit → one closure");
  assert.equal(closures[0].id, "AAA-id");
  assert.equal(closures[0].status, "tp1");
  assert.equal(closures[0].highest_tp_reached, 1);
});

test("runAutoJournal: leaves an open trade open when no TP/SL is hit", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const openedAtMs = Date.UTC(2024, 0, 1);
  const openRows = [makeRow({ symbol: "AAA", entry: 100, stop: 90, tps: [110], openedAtMs })];
  // Stays between stop (90) and TP (110) → no terminal hit.
  const assets = [makeCandleAsset({ symbol: "AAA", price: 105, openedAtMs, highs: [104, 106] })];

  const { closures } = runAutoJournal(assets, openRows);

  assert.equal(closures.length, 0, "no TP/SL hit → stays open");
});

test("runAutoJournal: closes a long trade on signal REVERSAL to short", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const openedAtMs = Date.UTC(2024, 0, 1);
  const openRows = [
    makeRow({ symbol: "AAA", signal: "long", entry: 100, stop: 90, tps: [110], openedAtMs }),
  ];
  // No TP/SL hit (price 105, between stop & TP) but the signal flipped to short.
  const assets = [
    makeCandleAsset({ symbol: "AAA", price: 105, openedAtMs, highs: [104, 106], signal: "short" }),
  ];

  const { closures } = runAutoJournal(assets, openRows);

  assert.equal(closures.length, 1, "reversal → closed");
  assert.equal(closures[0].id, "AAA-id");
  assert.equal(closures[0].status, "reversed"); // dedicated status for a no-TP reversal close
  assert.equal(closures[0].reversed, true);
  assert.equal(closures[0].close_price, 105); // exits at the current price
});

test("runAutoJournal: signal going NEUTRAL does NOT close (only reversal does)", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const openedAtMs = Date.UTC(2024, 0, 1);
  const openRows = [
    makeRow({ symbol: "AAA", signal: "long", entry: 100, stop: 90, tps: [110], openedAtMs }),
  ];
  const assets = [
    makeCandleAsset({ symbol: "AAA", price: 105, openedAtMs, highs: [104, 106], signal: "neutral" }),
  ];

  const { closures } = runAutoJournal(assets, openRows);

  assert.equal(closures.length, 0, "neutral = conviction faded, not reversed → keeps running");
});

test("runAutoJournal: SKIPS emit for a stale crypto quote (no journaling off dead data)", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const now = Date.UTC(2024, 0, 2, 12, 0, 0);
  const stale = makeAsset({ symbol: "AAA", signal: "long", quoteTime: now - 3 * 60 * 60 * 1000 }); // 3h old
  const fresh = makeAsset({ symbol: "BBB", signal: "long", quoteTime: now - 5 * 60 * 1000 }); // 5m old

  const { inserts } = runAutoJournal([stale, fresh], [], { now });

  assert.deepEqual(inserts.map((i) => i.symbol), ["BBB"], "stale crypto skipped, fresh emitted");
});

test("runAutoJournal: a STALE quote does not sync/close an open trade", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const now = Date.UTC(2024, 0, 2, 12, 0, 0);
  const openedAtMs = Date.UTC(2024, 0, 1);
  const openRows = [makeRow({ symbol: "AAA", entry: 100, stop: 90, tps: [110], openedAtMs })];
  // Price 80 is below the 90 stop → WOULD close, but the quote is 3h stale → skip.
  const staleAsset = makeCandleAsset({
    symbol: "AAA", price: 80, openedAtMs, highs: [95, 80], quoteTime: now - 3 * 60 * 60 * 1000,
  });

  const { closures } = runAutoJournal([staleAsset], openRows, { now });

  assert.equal(closures.length, 0, "stale quote → open trade left untouched (not closed off dead data)");
});

test("runAutoJournal: a phantom spot price (>= SL) does NOT close when candles never hit it", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const openedAtMs = Date.UTC(2024, 0, 1);
  // SHORT: entry 100, SL 110 (above), TP1 90 / TP2 80 (below) — mirrors the USDIDR bug.
  const openRows = [
    makeRow({ symbol: "AAA", signal: "short", entry: 100, stop: 110, tps: [90, 80], openedAtMs }),
  ];
  // Lows touch TP1 (90) but highs NEVER reach the 110 stop; closes are real (~92-93).
  // The spot `price` is a phantom 115 (>= SL) — the stale/forward-filled forex print
  // that used to manufacture a fake "secured TP1" close via the live-tick step.
  const asset = makeCandleAsset({
    symbol: "AAA", openedAtMs, signal: "short",
    highs: [95, 96], lows: [90, 91], closes: [92, 93], price: 115,
  });

  const { closures } = runAutoJournal([asset], openRows);

  assert.equal(closures.length, 0, "phantom spot ignored; only timestamped candles decide → stays open");
});

test("runAutoJournal: a candle high that REALLY hits the SL still closes (short)", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const openedAtMs = Date.UTC(2024, 0, 1);
  const openRows = [
    makeRow({ symbol: "AAA", signal: "short", entry: 100, stop: 110, tps: [90, 80], openedAtMs }),
  ];
  // A real candle HIGH of 112 (>= 110 stop) on the 2nd bar → genuine SL, no TP secured.
  const asset = makeCandleAsset({
    symbol: "AAA", openedAtMs, signal: "short",
    highs: [108, 112], lows: [104, 107], closes: [106, 109], price: 109,
  });

  const { closures } = runAutoJournal([asset], openRows);

  assert.equal(closures.length, 1, "real candle SL → closed");
  assert.equal(closures[0].status, "sl");
  assert.equal(closures[0].highest_tp_reached, 0);
  assert.equal(closures[0].close_price, 110, "exits at the stop level");
});

test("runAutoJournal: a STALE FOREX quote does not sync/close (guard now covers all asset types)", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const now = Date.UTC(2024, 0, 2, 12, 0, 0);
  const openedAtMs = Date.UTC(2024, 0, 1);
  const openRows = [
    makeRow({ symbol: "EURUSD=X", signal: "short", entry: 100, stop: 110, tps: [90, 80], openedAtMs }),
  ];
  // A real candle high 112 (>= 110 stop) WOULD close — but the forex quote is 3h
  // stale, and the guard is no longer crypto-only → skip, leaving the trade open.
  const staleForex = makeCandleAsset({
    symbol: "EURUSD=X", openedAtMs, signal: "short", assetType: "forex",
    highs: [108, 112], lows: [104, 107], closes: [106, 109], price: 109,
    quoteTime: now - 3 * 60 * 60 * 1000,
  });

  const { closures } = runAutoJournal([staleForex], openRows, { now });

  assert.equal(closures.length, 0, "stale forex skipped (was crypto-only before) → trade untouched");
});

test("runAutoJournal: re-entry cooldown blocks re-taking the same symbol+direction", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const now = Date.UTC(2024, 0, 2, 12, 0, 0);
  const longAsset = makeAsset({ symbol: "AAA", signal: "long", quoteTime: now - 60 * 1000 });
  // Same symbol+direction closed 1h ago → still inside the 6h cooldown.
  const recentClosed = [
    { symbol: "AAA", signal: "long", closed_at: new Date(now - 60 * 60 * 1000).toISOString() },
  ];

  const { inserts } = runAutoJournal([longAsset], [], { now, recentClosed });
  assert.equal(inserts.length, 0, "AAA long in cooldown → not re-emitted");

  // The OPPOSITE direction is allowed immediately (a genuine flip, not a re-take).
  const shortAsset = makeAsset({ symbol: "AAA", signal: "short", sl: 110, tps: [90, 80], quoteTime: now - 60 * 1000 });
  const { inserts: ins2 } = runAutoJournal([shortAsset], [], { now, recentClosed });
  assert.deepEqual(ins2.map((i) => i.signal), ["short"], "opposite direction allowed despite cooldown");

  // Once the cooldown elapses (close 7h ago), the same direction is allowed again.
  const oldClosed = [
    { symbol: "AAA", signal: "long", closed_at: new Date(now - 7 * 60 * 60 * 1000).toISOString() },
  ];
  const { inserts: ins3 } = runAutoJournal([longAsset], [], { now, recentClosed: oldClosed });
  assert.deepEqual(ins3.map((i) => i.symbol), ["AAA"], "cooldown elapsed → re-emit allowed");
});
