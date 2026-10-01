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

const ALERTS = "/src/core/automation/alerts.ts";

const PLAN = {
  inserts: [
    {
      symbol: "BTC-USD",
      signal: "long",
      entry_price: 65000,
      stop_loss: 63000,
      take_profits: [67000],
      strength_at_entry: 70,
      grade: "A",
    },
  ],
  closures: [
    {
      id: "row1",
      symbol: "EIGEN-USD",
      status: "tp1",
      close_price: 0.28,
      closed_at: "2026-06-20T00:00:00Z",
      highest_tp_reached: 1,
      secured_tp_level: 1,
      tp_total: 1,
      exit_reason: "final_take_profit",
      pnl_pct: 12,
      duration_ms: (86400 + 9 * 3600) * 1000, // 1 day 9 hours
      signal: "long",
      grade: "A",
    },
    {
      id: "row2",
      symbol: "MYX-USD",
      status: "sl",
      close_price: 9,
      closed_at: "2026-06-20T00:00:00Z",
      highest_tp_reached: 0,
      exit_reason: "initial_stop",
      pnl_pct: -8.3,
      duration_ms: 32 * 60 * 1000, // 32 minutes
      signal: "short",
      grade: "B",
    },
    {
      id: "row3",
      symbol: "NEAR-USD",
      status: "reversed",
      close_price: 5.12,
      closed_at: "2026-06-20T00:00:00Z",
      highest_tp_reached: 0,
      reversed: true,
      exit_reason: "reversal",
      pnl_pct: 0.28,
      duration_ms: 52 * 1000, // 52 seconds
      signal: "short",
      grade: "C",
    },
  ],
};

test("buildAutoJournalAlerts maps inserts and closures to events", async () => {
  const { buildAutoJournalAlerts } = await loadModule(ALERTS);
  const alerts = buildAutoJournalAlerts(PLAN);

  const newLong = alerts.find((a) => a.kind === "new_long");
  assert.ok(newLong);
  assert.equal(newLong.symbol, "BTC-USD");
  assert.equal(newLong.grade, "A");
  assert.equal(newLong.entry, 65000);
  assert.deepEqual(newLong.takeProfits, [67000]);
  assert.equal(newLong.stopLoss, 63000);

  const tp = alerts.find((a) => a.kind === "tp_hit");
  assert.equal(tp.symbol, "EIGEN-USD");
  assert.equal(tp.tpLevel, 1);
  assert.equal(tp.pnlPct, 12);

  const sl = alerts.find((a) => a.kind === "sl_hit");
  assert.equal(sl.symbol, "MYX-USD");

  // A no-TP reversal reports as "reversed", carrying the realized %.
  const rev = alerts.find((a) => a.kind === "reversed");
  assert.equal(rev.symbol, "NEAR-USD");
  assert.equal(rev.pnlPct, 0.28);
});

test("buildAutoJournalAlerts: a reversal after TP remains a reversal", async () => {
  const { buildAutoJournalAlerts } = await loadModule(ALERTS);
  const alerts = buildAutoJournalAlerts({
    inserts: [],
    closures: [
      {
        id: "r",
        symbol: "TON-USD",
        status: "reversed",
        close_price: 1.59,
        closed_at: "2026-06-21T00:00:00Z",
        highest_tp_reached: 1,
        secured_tp_level: 1,
        tp_total: 3,
        reversed: true,
        exit_reason: "reversal",
        pnl_pct: 1.75,
      },
    ],
  });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].kind, "reversed");
  assert.equal(alerts[0].tpLevel, 1);
});

test("alerts preserve exact protected-stop and reversal outcomes", async () => {
  const { buildAutoJournalAlerts, formatAlertBatchesForDiscord } =
    await loadModule(ALERTS);
  const alerts = buildAutoJournalAlerts({
    inserts: [],
    closures: [
      {
        id: "r",
        symbol: "TON-USD",
        status: "reversed",
        close_price: 1.59,
        closed_at: "2026-06-21T00:00:00Z",
        highest_tp_reached: 2,
        tp_total: 3,
        reversed: true,
        exit_reason: "reversal",
        pnl_pct: 8.4,
        duration_ms: 3 * 3600 * 1000,
        signal: "long",
        grade: "A",
      },
      {
        id: "be",
        symbol: "ETH-USD",
        status: "sl",
        close_price: 100,
        closed_at: "2026-06-21T00:00:00Z",
        highest_tp_reached: 1,
        secured_tp_level: 0,
        tp_total: 3,
        exit_reason: "breakeven_stop",
        pnl_pct: 0,
        signal: "long",
      },
      {
        id: "progressive",
        symbol: "SOL-USD",
        status: "sl",
        close_price: 110,
        closed_at: "2026-06-21T00:00:00Z",
        highest_tp_reached: 2,
        secured_tp_level: 1,
        tp_total: 3,
        exit_reason: "progressive_stop",
        pnl_pct: 10,
        signal: "long",
      },
    ],
  });
  assert.equal(alerts.filter((a) => a.kind === "reversed").length, 1);
  assert.equal(alerts.filter((a) => a.kind === "protected_stop").length, 2);
  const [{ content: msg, alertCount }] = formatAlertBatchesForDiscord(alerts);
  assert.equal(alertCount, 3);
  assert.ok(msg.includes("↳ REVERSED PROFIT: `@1.59` `(+8.4%)`"));
  assert.ok(msg.includes("↳ SEMPAT: `TP2`"));
  assert.ok(msg.includes("↳ BE: `@100` `(+0%)`"));
  assert.ok(msg.includes("↳ TP 1/3: `@110` `(+10%)`"));
});

test("formatAlertBatchesForDiscord renders signal + outcome sections", async () => {
  const { buildAutoJournalAlerts, formatAlertBatchesForDiscord } =
    await loadModule(ALERTS);
  const [{ content: msg, alertCount }] = formatAlertBatchesForDiscord(
    buildAutoJournalAlerts(PLAN),
  );
  assert.equal(alertCount, 4);
  assert.ok(msg.includes("🚨 SINYAL:"));
  assert.ok(msg.includes("📢 HASIL:"));
  assert.ok(
    msg.includes(
      "🟢 **BTC-USD** • LONG • A\n↳ ENTRY: `@65.000`\n↳ TP1: `@67.000` `(+3.1%)`\n↳ SL: `@63.000` `(-3.1%)`",
    ),
  );
  // Each outcome carries the realized P&L line then a DURATION line.
  assert.ok(
    msg.includes(
      "🎯 **EIGEN-USD** • LONG • A\n↳ TP 1/1: `@0.28` `(+12%)`\n↳ DURATION: `1 HARI 9 JAM`",
    ),
  );
  assert.ok(
    msg.includes(
      "⛔ **MYX-USD** • SHORT • B\n↳ SL: `@9` `(-8.3%)`\n↳ DURATION: `32 MENIT`",
    ),
  );
  // Reversal reads as REVERSED PROFIT / LOSS by realized P&L (🔄 kept).
  assert.ok(
    msg.includes(
      "🔄 **NEAR-USD** • SHORT • C\n↳ REVERSED PROFIT: `@5.12` `(+0.28%)`\n↳ DURATION: `52 DETIK`",
    ),
  );
  assert.ok(msg.includes("━━━")); // divider rule

  assert.deepEqual(formatAlertBatchesForDiscord([]), []);
});

test("formatAlertBatchesForDiscord keeps every alert once without truncation", async () => {
  const {
    buildAutoJournalAlerts,
    formatAlertBatchesForDiscord,
    DISCORD_MAX,
  } = await loadModule(ALERTS);
  const inserts = Array.from({ length: 30 }, (_, index) => ({
    symbol: `BATCH-${String(index).padStart(2, "0")}-USD`,
    signal: index % 2 === 0 ? "long" : "short",
    entry_price: 100 + index,
    stop_loss: index % 2 === 0 ? 90 + index : 110 + index,
    take_profits:
      index % 2 === 0
        ? [110 + index, 120 + index, 130 + index]
        : [90 + index, 80 + index, 70 + index],
    strength_at_entry: 70,
    grade: "B",
  }));
  const alerts = buildAutoJournalAlerts({ inserts, closures: [] });
  const batches = formatAlertBatchesForDiscord(alerts);

  assert.ok(batches.length > 1, "large recovery scan is split into messages");
  assert.equal(
    batches.reduce((total, batch) => total + batch.alertCount, 0),
    alerts.length,
  );
  assert.ok(batches.every((batch) => batch.content.length <= DISCORD_MAX));

  const allContent = batches.map((batch) => batch.content).join("\n");
  assert.equal(allContent.includes("truncated"), false);
  for (const insert of inserts) {
    const marker = `**${insert.symbol}**`;
    assert.equal(allContent.split(marker).length - 1, 1, `${insert.symbol} once`);
  }
});

/** A still-open engine-v7 long that just crossed TP1 (entry 100, TP 102/104/106). */
const CHECKPOINT = {
  id: "cp",
  highest_tp_reached: 1,
  from_tp_reached: 0,
  symbol: "SOL-USD",
  signal: "long",
  grade: "A",
  entry_price: 100,
  take_profits: [102, 104, 106],
  stop_loss: 100,
  partial_legs: 1,
};

function renderCheckpoints(module, progressUpdates, closures = []) {
  const alerts = module.buildAutoJournalAlerts({
    inserts: [],
    closures,
    progressUpdates,
  });
  return module.formatAlertBatchesForDiscord(alerts).map((b) => b.content).join("\n");
}

test("checkpoint: v7 TP1 banks 50% and moves the stop to entry", async () => {
  const module = await loadModule(ALERTS);
  assert.equal(
    renderCheckpoints(module, [CHECKPOINT]),
    "📍 CHECKPOINT:\n\n✅ **SOL-USD** • LONG • A\n↳ TP1: `@102` `(+2%)`\n↳ PARTIAL: `TP1 50%`\n↳ SL BARU: `@100` `(ENTRY)`",
  );
});

test("checkpoint: short TP2, a two-level jump, and a legacy row without partial", async () => {
  const module = await loadModule(ALERTS);
  const short = renderCheckpoints(module, [
    {
      ...CHECKPOINT,
      symbol: "ETH-USD",
      signal: "short",
      grade: "B",
      take_profits: [95, 90, 85],
      highest_tp_reached: 2,
      from_tp_reached: 1,
      stop_loss: 95,
      partial_legs: 2,
    },
  ]);
  assert.ok(
    short.includes(
      "✅ **ETH-USD** • SHORT • B\n↳ TP2: `@90` `(+10%)`\n↳ PARTIAL: `TP2 30%`\n↳ SL BARU: `@95` `(TP1)`",
    ),
  );

  const jump = renderCheckpoints(module, [
    { ...CHECKPOINT, highest_tp_reached: 2, stop_loss: 102, partial_legs: 2 },
  ]);
  assert.ok(
    jump.includes(
      "↳ TP2: `@104` `(+4%)`\n↳ PARTIAL: `TP1 50% + TP2 30%`\n↳ SL BARU: `@102` `(TP1)`",
    ),
  );

  const legacy = renderCheckpoints(module, [
    { ...CHECKPOINT, symbol: "BTC-USD", grade: null, partial_legs: 0 },
  ]);
  assert.ok(
    legacy.includes(
      "✅ **BTC-USD** • LONG\n↳ TP1: `@102` `(+2%)`\n↳ SL BARU: `@100` `(ENTRY)`",
    ),
  );
  assert.equal(legacy.includes("PARTIAL"), false);
});

test("checkpoint: a trade that also closed this run reports only its outcome", async () => {
  const module = await loadModule(ALERTS);
  const msg = renderCheckpoints(
    module,
    [CHECKPOINT],
    [
      {
        id: "cp",
        symbol: "SOL-USD",
        status: "sl",
        close_price: 100,
        closed_at: "2026-10-01T00:00:00Z",
        highest_tp_reached: 1,
        secured_tp_level: 1,
        tp_total: 3,
        exit_reason: "breakeven_stop",
        pnl_pct: 1,
        signal: "long",
        grade: "A",
        partial_legs: 1,
      },
    ],
  );
  assert.equal(msg.includes("📍 CHECKPOINT:"), false);
  assert.equal(msg.split("**SOL-USD**").length - 1, 1);
});

test("sections render SINYAL, then CHECKPOINT, then HASIL", async () => {
  const { buildAutoJournalAlerts, formatAlertBatchesForDiscord } =
    await loadModule(ALERTS);
  const [{ content: msg }] = formatAlertBatchesForDiscord(
    buildAutoJournalAlerts({ ...PLAN, progressUpdates: [CHECKPOINT] }),
  );
  const order = ["🚨 SINYAL:", "📍 CHECKPOINT:", "📢 HASIL:"].map((title) =>
    msg.indexOf(title),
  );
  assert.ok(order.every((index) => index >= 0), "all three sections render");
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test("v7 outcomes name the banked legs as PARTIAL instead of SEMPAT", async () => {
  const { buildAutoJournalAlerts, formatAlertBatchesForDiscord } =
    await loadModule(ALERTS);
  const base = {
    symbol: "SOL-USD",
    closed_at: "2026-10-01T00:00:00Z",
    tp_total: 3,
    signal: "long",
    grade: "A",
  };
  const [{ content: msg }] = formatAlertBatchesForDiscord(
    buildAutoJournalAlerts({
      inserts: [],
      closures: [
        {
          ...base,
          id: "be",
          status: "sl",
          close_price: 100,
          highest_tp_reached: 1,
          secured_tp_level: 1,
          exit_reason: "breakeven_stop",
          pnl_pct: 1,
          partial_legs: 1,
        },
        {
          ...base,
          id: "tp3",
          status: "tp3",
          close_price: 106,
          highest_tp_reached: 3,
          secured_tp_level: 3,
          exit_reason: "final_take_profit",
          pnl_pct: 3.4,
          partial_legs: 2,
        },
      ],
    }),
  );
  assert.ok(
    msg.includes(
      "🛡️ **SOL-USD** • LONG • A\n↳ TP 1/3: `@100` `(+1%)`\n↳ PARTIAL: `TP1 50%`",
    ),
  );
  assert.ok(
    msg.includes(
      "🎯 **SOL-USD** • LONG • A\n↳ TP 3/3: `@106` `(+3.4%)`\n↳ PARTIAL: `TP1 50% + TP2 30%`",
    ),
  );
  assert.equal(msg.includes("SEMPAT"), false);
});
