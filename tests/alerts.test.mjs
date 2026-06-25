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

const ALERTS = "/src/core/alerts.ts";

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

  // A reversal (with or without a TP) reports as "reversed", carrying the %.
  const rev = alerts.find((a) => a.kind === "reversed");
  assert.equal(rev.symbol, "NEAR-USD");
  assert.equal(rev.pnlPct, 0.28);
});

test("buildAutoJournalAlerts: a reversal-after-TP reports as reversed, not tp_hit", async () => {
  const { buildAutoJournalAlerts } = await loadModule(ALERTS);
  const alerts = buildAutoJournalAlerts({
    inserts: [],
    closures: [
      {
        id: "r",
        symbol: "TON-USD",
        status: "tp1",
        close_price: 1.59,
        closed_at: "2026-06-21T00:00:00Z",
        highest_tp_reached: 1,
        reversed: true,
        pnl_pct: 1.75,
      },
    ],
  });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].kind, "reversed");
});

test("formatAlertsForDiscord renders the Sensei message, null when empty", async () => {
  const { buildAutoJournalAlerts, formatAlertsForDiscord } =
    await loadModule(ALERTS);
  const msg = formatAlertsForDiscord(buildAutoJournalAlerts(PLAN));
  assert.ok(msg.includes("🥋 WANGSIT RABALABA SENSEI"));
  assert.ok(msg.includes("🚨 SINYAL:"));
  assert.ok(msg.includes("📢 HASIL:"));
  assert.ok(msg.includes("🧘 PETUAH SENSEI"));
  assert.ok(
    msg.includes(
      "🟢 **BTC-USD** • LONG • A\n↳ ENTRY: `@65.000`\n↳ TP1: `@67.000` `(+3.1%)`\n↳ SL: `@63.000` `(-3.1%)`",
    ),
  );
  // Each outcome carries the realized P&L line then a DURATION line.
  assert.ok(
    msg.includes(
      "🎯 **EIGEN-USD** • LONG • A\n↳ TP1: `@0.28` `(+12%)`\n↳ DURATION: `1 HARI 9 JAM`",
    ),
  );
  assert.ok(
    msg.includes(
      "⛔ **MYX-USD** • SHORT • B\n↳ SL: `@9` `(-8.3%)`\n↳ DURATION: `32 MENIT`",
    ),
  );
  assert.ok(
    msg.includes(
      "🔄 **NEAR-USD** • SHORT • C\n↳ REVERSED: `@5.12` `(+0.28%)`\n↳ DURATION: `52 DETIK`",
    ),
  );
  assert.ok(msg.includes("Bersemedi di depan chart")); // closing wisdom
  assert.ok(msg.includes("━━━")); // divider rule

  assert.equal(formatAlertsForDiscord([]), null);
});
