import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

const CORE = "/src/core/automation/auto-journal-core.ts";
const V4_MIGRATION =
  "supabase/migrations/20260829100120_progressive_exit_v4.sql";

/** A signal-bearing asset the cron would emit (long/short + plan). */
function makeAsset({
  symbol,
  signal,
  price = 100,
  entry = price,
  sl = 90,
  tps = [110, 120],
  quoteTime = Date.now(),
  decisionCandleClosedAt = quoteTime,
  executionCandleOpenAt = decisionCandleClosedAt,
  assetType = "crypto",
}) {
  const neutral = signal === "neutral";
  return {
    symbol,
    name: symbol,
    assetType,
    timeframe: "1mo",
    price,
    quoteTime,
    decisionCandleOpenAt: quoteTime - 60 * 60 * 1000,
    decisionCandleClosedAt,
    executionCandleOpenAt,
    outlook: {
      signal,
      strength: neutral ? 10 : 70,
      tier: neutral ? "C" : "B",
      regime: "trending",
      higherTimeframeReady: true,
      higherTimeframeTrend: signal === "short" ? "bearish" : "bullish",
      directionScore: signal === "short" ? -0.7 : signal === "long" ? 0.7 : 0,
    },
    tradingPlan: neutral
      ? null
      : {
          entry,
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
    exit_reason: null,
    engine_version: "engine-v4",
    decision_candle_open_at: null,
    decision_candle_closed_at: null,
    reversed: false,
    opened_at: iso,
    closed_at: null,
    close_price: null,
    created_at: iso,
    updated_at: iso,
  };
}

/** An asset carrying daily candles since `openedAtMs` (for the sync path). */
function makeCandleAsset({ symbol, price, openedAtMs, highs, lows, closes, signal = "long", quoteTime = Date.now(), assetType = "crypto" }) {
  const baseSec = Math.floor(openedAtMs / 1000);
  return {
    symbol,
    name: symbol,
    assetType,
    timeframe: "1mo",
    price,
    quoteTime,
    decisionCandleOpenAt: quoteTime - 60 * 60 * 1000,
    decisionCandleClosedAt: quoteTime,
    executionCandleOpenAt: quoteTime,
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
  assert.equal(inserts[0].engine_version, "engine-v5");
  assert.equal(inserts[0].regime, "trending");
  assert.ok(inserts[0].decision_candle_open_at);
  assert.ok(inserts[0].decision_candle_closed_at);
  assert.equal(closures.length, 0);
});

test("runAutoJournal: entry and opened_at come from the execution candle, not spot or cron", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const { buildAutoJournalAlerts } = await loadModule(
    "/src/core/automation/alerts.ts",
  );
  const { applySignalEpisode } = await loadModule(
    "/src/core/automation/signal-episode.ts",
  );
  const now = Date.UTC(2024, 0, 2, 12, 5);
  const executionCandleOpenAt = Date.UTC(2024, 0, 2, 12, 0);
  const asset = makeAsset({
    symbol: "AAA",
    signal: "long",
    price: 135,
    entry: 100,
    quoteTime: now,
    decisionCandleClosedAt: executionCandleOpenAt,
    executionCandleOpenAt,
  });

  const result = runAutoJournal([asset], [], { now });

  assert.equal(result.inserts[0].entry_price, 100);
  assert.equal(
    result.inserts[0].opened_at,
    new Date(executionCandleOpenAt).toISOString(),
  );
  assert.equal(result.signalStateUpdates[0].entry_price, 100);
  assert.equal(buildAutoJournalAlerts(result)[0].entry, 100);
  assert.equal(
    applySignalEpisode(asset, result.signalStateUpdates[0]).tradingPlan.entry,
    100,
  );
});

test("runAutoJournal: no execution candle means no synthetic trade", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const asset = makeAsset({ symbol: "AAA", signal: "long" });
  delete asset.executionCandleOpenAt;

  assert.equal(runAutoJournal([asset], []).inserts.length, 0);
});

test("v4 migration adds exact exit reasons and moves only unresolved trades", async () => {
  const sql = await readFile(V4_MIGRATION, "utf8");

  assert.match(sql, /add column if not exists exit_reason text/i);
  for (const reason of [
    "initial_stop",
    "breakeven_stop",
    "progressive_stop",
    "final_take_profit",
    "reversal",
  ]) {
    assert.match(sql, new RegExp(`'${reason}'`));
  }
  assert.match(sql, /update public\.journal_trades/i);
  assert.match(sql, /set engine_version = 'engine-v4'/i);
  assert.match(sql, /where status = 'open'/i);
  assert.doesNotMatch(sql, /\bdelete\b/i);
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

test("runAutoJournal: closes a final TP and blocks same-direction re-entry", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const openedAtMs = Date.UTC(2024, 0, 1);
  const openRows = [makeRow({ symbol: "AAA", entry: 100, stop: 90, tps: [110], openedAtMs })];
  // High reaches 112 (>= TP 110) on the 2nd bar; lows stay above the 90 stop.
  const asset = makeCandleAsset({ symbol: "AAA", price: 112, openedAtMs, highs: [108, 112] });
  asset.tradingPlan = {
    entry: 112,
    stopLoss: 100,
    takeProfit1: 124,
    takeProfit2: 136,
    takeProfit3: undefined,
    riskRewardRatio: 2,
  };

  const { closures, inserts } = runAutoJournal([asset], openRows);

  assert.equal(closures.length, 1, "TP hit → one closure");
  assert.equal(closures[0].id, "AAA-id");
  assert.equal(closures[0].status, "tp1");
  assert.equal(closures[0].highest_tp_reached, 1);
  assert.equal(closures[0].secured_tp_level, 1);
  assert.equal(closures[0].exit_reason, "final_take_profit");
  assert.equal(inserts.length, 0, "the lingering LONG stays in the closed episode");
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

test("runAutoJournal persists a reached TP milestone before the final exit", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const openedAtMs = Date.UTC(2024, 0, 1);
  const openRows = [
    makeRow({
      symbol: "AAA",
      entry: 100,
      stop: 90,
      tps: [110, 120],
      openedAtMs,
    }),
  ];
  const assets = [
    makeCandleAsset({
      symbol: "AAA",
      price: 105,
      openedAtMs,
      highs: [116],
      lows: [101],
      closes: [115],
    }),
  ];

  const { closures, progressUpdates } = runAutoJournal(assets, openRows);

  assert.equal(closures.length, 0);
  assert.deepEqual(progressUpdates, [
    { id: "AAA-id", highest_tp_reached: 1 },
  ]);
});

test("runAutoJournal raises a short stop one rung behind after TP2", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const openedAtMs = Date.UTC(2024, 0, 1);
  const openRows = [
    makeRow({
      symbol: "PRL-USD",
      signal: "short",
      entry: 100,
      stop: 110,
      tps: [90, 80, 70],
      openedAtMs,
    }),
  ];
  const retraced = makeCandleAsset({
    symbol: "PRL-USD",
    signal: "short",
    price: 82,
    openedAtMs,
    highs: [100],
    lows: [79],
    closes: [82],
  });

  const first = runAutoJournal([retraced], openRows);
  assert.equal(first.closures.length, 0);
  assert.deepEqual(first.progressUpdates, [
    { id: "PRL-USD-id", highest_tp_reached: 2 },
  ]);

  const stopped = makeCandleAsset({
    symbol: "PRL-USD",
    signal: "short",
    price: 85,
    openedAtMs,
    highs: [100, 95],
    lows: [79, 84],
    closes: [82, 85],
  });
  const second = runAutoJournal([stopped], openRows);

  assert.equal(second.closures.length, 1);
  assert.equal(second.closures[0].status, "sl");
  assert.equal(second.closures[0].highest_tp_reached, 2);
  assert.equal(second.closures[0].close_price, 90);
  assert.equal(second.closures[0].exit_reason, "progressive_stop");
  assert.equal(second.closures[0].secured_tp_level, 1);
});

test("runAutoJournal: closes a long reversal and opens the current short in the same scan", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const openedAtMs = Date.UTC(2024, 0, 1);
  const openRows = [
    makeRow({ symbol: "AAA", signal: "long", entry: 100, stop: 90, tps: [110], openedAtMs }),
  ];
  // No TP/SL hit (price 105, between stop & TP) but the signal flipped to short.
  const asset = makeCandleAsset({
    symbol: "AAA",
    price: 105,
    openedAtMs,
    highs: [104, 106],
    signal: "short",
  });
  asset.tradingPlan = {
    entry: 105,
    stopLoss: 115,
    takeProfit1: 95,
    takeProfit2: 85,
    takeProfit3: undefined,
    riskRewardRatio: 2,
  };

  const { closures, inserts } = runAutoJournal([asset], openRows);

  assert.equal(closures.length, 1, "reversal → closed");
  assert.equal(closures[0].id, "AAA-id");
  assert.equal(closures[0].status, "reversed"); // dedicated status for a no-TP reversal close
  assert.equal(closures[0].exit_reason, "reversal");
  assert.equal(closures[0].reversed, true);
  assert.equal(closures[0].close_price, 105); // exits at the current price
  assert.equal(inserts.length, 1, "current SHORT is journaled without a one-cycle gap");
  assert.equal(inserts[0].signal, "short");
});

test("runAutoJournal: reversal after TP progress stays a reversal", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const openedAtMs = Date.UTC(2024, 0, 1);
  const openRows = [
    makeRow({
      symbol: "AAA",
      signal: "long",
      entry: 100,
      stop: 90,
      tps: [110, 120, 130],
      openedAtMs,
    }),
  ];
  const asset = makeCandleAsset({
    symbol: "AAA",
    price: 105,
    openedAtMs,
    highs: [115],
    lows: [101],
    closes: [105],
    signal: "short",
  });

  const { closures } = runAutoJournal([asset], openRows);

  assert.equal(closures.length, 1);
  assert.equal(closures[0].status, "reversed");
  assert.equal(closures[0].exit_reason, "reversal");
  assert.equal(closures[0].highest_tp_reached, 1);
  assert.equal(closures[0].reversed, true);
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

test("runAutoJournal: accepts entries only during the 15-minute post-close window", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const now = Date.UTC(2024, 0, 2, 12, 30, 0);
  const fresh = makeAsset({
    symbol: "FRESH",
    signal: "long",
    quoteTime: now,
    decisionCandleClosedAt: now - 15 * 60 * 1000,
  });
  const staleDecision = makeAsset({
    symbol: "LATE",
    signal: "long",
    quoteTime: now,
    decisionCandleClosedAt: now - 16 * 60 * 1000,
  });

  const { inserts } = runAutoJournal([fresh, staleDecision], [], { now });

  assert.deepEqual(inserts.map((item) => item.symbol), ["FRESH"]);
});

test("signal episode: TP blocks retry, neutral re-arms, next long opens once", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const openedAtMs = Date.UTC(2024, 0, 1);
  const openRows = [
    makeRow({ symbol: "AAA", entry: 100, stop: 90, tps: [110], openedAtMs }),
  ];
  const hit = makeCandleAsset({
    symbol: "AAA",
    price: 112,
    openedAtMs,
    highs: [112],
  });

  const closed = runAutoJournal([hit], openRows);
  const blocked = closed.signalStateUpdates.find((state) => state.symbol === "AAA");
  assert.equal(blocked.active_signal, null);
  assert.equal(blocked.blocked_signal, "long");

  const retry = runAutoJournal([hit], [], { signalStates: [blocked] });
  assert.equal(retry.inserts.length, 0, "same raw LONG retry is idempotent");

  const neutral = makeAsset({ symbol: "AAA", signal: "neutral" });
  const rearmed = runAutoJournal([neutral], [], { signalStates: [blocked] });
  const neutralState = rearmed.signalStateUpdates.find(
    (state) => state.symbol === "AAA",
  );
  assert.equal(neutralState.blocked_signal, null);

  const next = makeAsset({ symbol: "AAA", signal: "long" });
  const reopened = runAutoJournal([next], [], {
    signalStates: [neutralState],
  });
  assert.equal(reopened.inserts.length, 1);
  assert.equal(reopened.signalStateUpdates[0].active_signal, "long");
});

test("signal episode self-heals an active state with no open trade", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const asset = makeAsset({ symbol: "AAA", signal: "long" });
  const staleState = {
    symbol: "AAA",
    timeframe: "swing",
    active_signal: "long",
    blocked_signal: null,
    last_raw_signal: "long",
    decision_candle_open_at: null,
    decision_candle_closed_at: null,
    entry_price: 100,
    stop_loss: 90,
    take_profits: [110, 120],
    risk_reward_ratio: 2,
    updated_at: new Date().toISOString(),
  };

  const healed = runAutoJournal([asset], [], { signalStates: [staleState] });

  assert.equal(healed.inserts.length, 0);
  assert.equal(healed.signalStateUpdates[0].active_signal, null);
  assert.equal(healed.signalStateUpdates[0].blocked_signal, "long");
});

test("runAutoJournal: entry candle can close at a TP2-raised stop", async () => {
  const { runAutoJournal } = await loadModule(CORE);
  const openedAtMs = Math.floor(Date.now() / 1000) * 1000;
  const row = makeRow({
    symbol: "AAA",
    entry: 100,
    stop: 80,
    tps: [110, 120, 130],
    openedAtMs,
  });
  const asset = makeCandleAsset({
    symbol: "AAA",
    price: 110,
    openedAtMs,
    highs: [120],
    lows: [100],
    closes: [110],
  });
  asset.decisionCandleOpenAt = openedAtMs;

  const result = runAutoJournal([asset], [row]);

  assert.equal(result.closures[0].exit_reason, "progressive_stop");
  assert.equal(result.closures[0].close_price, 110);
  assert.equal(result.closures[0].highest_tp_reached, 2);
  assert.equal(result.inserts.length, 0);
});

test("Terminal projection keeps active episode and suppresses a blocked raw signal", async () => {
  const { applySignalEpisode } = await loadModule(
    "/src/core/automation/signal-episode.ts",
  );
  const rawNeutral = makeAsset({ symbol: "AAA", signal: "neutral", price: 180 });
  const active = applySignalEpisode(rawNeutral, {
    symbol: "AAA",
    timeframe: "swing",
    active_signal: "long",
    blocked_signal: null,
    last_raw_signal: "neutral",
    decision_candle_open_at: null,
    decision_candle_closed_at: null,
    entry_price: 100,
    stop_loss: 80,
    take_profits: [210, 220, 230],
    risk_reward_ratio: 5.5,
    updated_at: new Date().toISOString(),
  });
  assert.equal(active.outlook.signal, "long");
  assert.equal(active.price, 180, "market price stays live");
  assert.deepEqual(active.tradingPlan, {
    entry: 100,
    stopLoss: 80,
    takeProfit1: 210,
    takeProfit2: 220,
    takeProfit3: 230,
    riskRewardRatio: 5.5,
  });

  const rawLong = makeAsset({ symbol: "BBB", signal: "long" });
  const blocked = applySignalEpisode(rawLong, {
    symbol: "BBB",
    timeframe: "swing",
    active_signal: null,
    blocked_signal: "long",
    last_raw_signal: "long",
    decision_candle_open_at: null,
    decision_candle_closed_at: null,
    entry_price: 100,
    stop_loss: 90,
    take_profits: [110, 120],
    risk_reward_ratio: 2,
    updated_at: new Date().toISOString(),
  });
  assert.equal(blocked.outlook.signal, "neutral");
  assert.equal(blocked.tradingPlan, null);
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
  assert.equal(closures[0].exit_reason, "initial_stop");
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
