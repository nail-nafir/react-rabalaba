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
    },
    {
      id: "row2",
      symbol: "MYX-USD",
      status: "sl",
      close_price: 9,
      closed_at: "2026-06-20T00:00:00Z",
      highest_tp_reached: 0,
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

  const tp = alerts.find((a) => a.kind === "tp_hit");
  assert.equal(tp.symbol, "EIGEN-USD");
  assert.equal(tp.tpLevel, 1);

  const sl = alerts.find((a) => a.kind === "sl_hit");
  assert.equal(sl.symbol, "MYX-USD");
});

test("formatAlertsForDiscord renders a readable message, null when empty", async () => {
  const { buildAutoJournalAlerts, formatAlertsForDiscord } =
    await loadModule(ALERTS);
  const msg = formatAlertsForDiscord(buildAutoJournalAlerts(PLAN));
  assert.ok(msg.includes("RabaLaba Sensei"));
  assert.ok(msg.includes("SINYAL:"));
  assert.ok(msg.includes("HASIL:"));
  assert.ok(msg.includes("**BTC-USD** • LONG • Grade A • Entry @65,000"));
  assert.ok(msg.includes("**EIGEN-USD** → TP1 @0.28"));
  assert.ok(msg.includes("**MYX-USD** → SL @9"));
  assert.ok(msg.includes("━")); // divider

  assert.equal(formatAlertsForDiscord([]), null);
});
