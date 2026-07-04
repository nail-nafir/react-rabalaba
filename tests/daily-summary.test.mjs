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

const INPUT = {
  dateLabel: "29-06-2026",
  closed: [
    {
      symbol: "EIGEN-USD",
      signal: "long",
      grade: "A",
      status: "tp2",
      pnlPct: 12,
      durationMs: (86400 + 9 * 3600) * 1000, // 1 day 9 hours
    },
    {
      symbol: "MYX-USD",
      signal: "short",
      grade: "B",
      status: "sl",
      pnlPct: -8.3,
      durationMs: 32 * 60 * 1000, // 32 minutes
    },
    {
      symbol: "NEAR-USD",
      signal: "short",
      grade: "C",
      status: "reversed",
      reversed: true,
      tpReached: 0,
      tpTotal: 3,
      pnlPct: 0.28,
      durationMs: 52 * 1000,
    },
  ],
  emitted: [
    { symbol: "BTC-USD", signal: "long", grade: "A" },
    { symbol: "SOL-USD", signal: "short", grade: "B" },
  ],
  open: [
    { symbol: "ETH-USD", signal: "long", grade: "B", floatingPct: 4.2 },
    { symbol: "ADA-USD", signal: "long", grade: "C" }, // no live price
    { symbol: "XRP-USD", signal: "short", grade: "A", floatingPct: 9.1 },
  ],
};

test("formatDailySummaryForDiscord renders the compact scoreboard recap", async () => {
  const { formatDailySummaryForDiscord } = await loadModule(ALERTS);
  const msg = formatDailySummaryForDiscord(INPUT);

  // Persona + framing present.
  assert.ok(msg.includes("🥋 WANGSIT RABALABA SENSEI"));
  assert.ok(msg.includes("🗓️ REKAP 29-06-2026"));
  assert.ok(msg.includes("🧘 PETUAH SENSEI"));
  assert.ok(msg.includes("━━━"));

  // Scoreboard: 3 closed → 2 wins (12, 0.28) / 1 loss (-8.3) → 67%.
  // Total = 12 - 8.3 + 0.28 = 3.98 ≈ +4%; terbaik EIGEN +12%, terburuk MYX -8.3%.
  assert.ok(msg.includes("💰 TOTAL: `(+4%)`"));
  assert.ok(msg.includes("👑 TERBAIK: **EIGEN-USD** `(+12%)`"));
  assert.ok(msg.includes("🥀 TERBURUK: **MYX-USD** `(-8.3%)`"));
  assert.ok(msg.includes("🚨 SINYAL BARU: `2`"));
  assert.ok(msg.includes("⏳ MASIH TERBUKA: `3`"));
  assert.ok(msg.includes("🏁 SUDAH DITUTUP: `3`"));
  assert.ok(msg.includes("🥇 RASIO LABA RUGI: `67%` `(2 Laba / 1 Rugi)`"));

  // The compact recap DROPS the per-trade / per-signal / per-open listings.
  assert.ok(!msg.includes("📢 DITUTUP HARI INI:"));
  assert.ok(!msg.includes("— TP2"));
  assert.ok(!msg.includes("ETH-USD")); // open positions are no longer listed
});

test("a completely empty day returns null", async () => {
  const { formatDailySummaryForDiscord } = await loadModule(ALERTS);
  assert.equal(
    formatDailySummaryForDiscord({
      dateLabel: "29-06-2026",
      closed: [],
      emitted: [],
      open: [],
    }),
    null,
  );
});

test("open-only day still sends a recap (counts only, no closed stats)", async () => {
  const { formatDailySummaryForDiscord } = await loadModule(ALERTS);
  const msg = formatDailySummaryForDiscord({
    dateLabel: "29-06-2026",
    closed: [],
    emitted: [],
    open: [{ symbol: "ETH-USD", signal: "long", grade: "B", floatingPct: 1.5 }],
  });
  assert.ok(msg.includes("🚨 SINYAL BARU: `0`"));
  assert.ok(msg.includes("⏳ MASIH TERBUKA: `1`"));
  assert.ok(msg.includes("🏁 SUDAH DITUTUP: `0`"));
  // No closed trades → no total / best / worst / win-rate lines.
  assert.ok(!msg.includes("💰 TOTAL:"));
  assert.ok(!msg.includes("🥇 RASIO LABA RUGI:"));
  assert.ok(!msg.includes("👑 TERBAIK:"));
});

// ── recapWindow: WIB calendar windows for daily / weekly / monthly recaps ──

const PERIOD = "/src/core/period-summary.ts";
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
/** A WIB wall-clock moment expressed as a UTC instant (ms). Month is 1-based. */
const wibMs = (y, m, d, h = 0, min = 0) =>
  Date.UTC(y, m - 1, d, h, min) - WIB_OFFSET_MS;

test("recapWindow daily: the WIB calendar day of ref, always a send day", async () => {
  const { recapWindow } = await loadModule(PERIOD);
  const w = recapWindow("daily", wibMs(2026, 7, 1, 23, 50));
  assert.equal(w.startMs, wibMs(2026, 7, 1));
  assert.equal(w.endMs, wibMs(2026, 7, 2));
  assert.equal(w.isSendDay, true);
});

test("recapWindow weekly: Monday-start week, Sunday is the send day", async () => {
  const { recapWindow } = await loadModule(PERIOD);
  // 2026-07-05 is a Sunday (2026-07-02 is Thursday).
  const sunday = recapWindow("weekly", wibMs(2026, 7, 5, 23, 50));
  assert.equal(sunday.startMs, wibMs(2026, 6, 29), "week starts Mon Jun 29 WIB");
  assert.equal(sunday.endMs, wibMs(2026, 7, 6), "week ends Mon Jul 6 WIB");
  assert.equal(sunday.isSendDay, true, "Sunday closes the week");

  // Mid-week ref: same window, NOT a send day.
  const thursday = recapWindow("weekly", wibMs(2026, 7, 2, 12));
  assert.equal(thursday.startMs, wibMs(2026, 6, 29));
  assert.equal(thursday.isSendDay, false);

  // WIB/UTC boundary: Sunday 18:00 UTC is already Monday 01:00 WIB — the WIB
  // calendar (not UTC) must decide, so this belongs to the NEXT week.
  const utcSunday = recapWindow("weekly", Date.UTC(2026, 6, 5, 18, 0));
  assert.equal(utcSunday.startMs, wibMs(2026, 7, 6), "already next WIB week");
  assert.equal(utcSunday.isSendDay, false);
});

test("recapWindow monthly: WIB calendar month, its last day is the send day", async () => {
  const { recapWindow } = await loadModule(PERIOD);
  const lastOfJuly = recapWindow("monthly", wibMs(2026, 7, 31, 23, 50));
  assert.equal(lastOfJuly.startMs, wibMs(2026, 7, 1));
  assert.equal(lastOfJuly.endMs, wibMs(2026, 8, 1));
  assert.equal(lastOfJuly.isSendDay, true);

  const midJuly = recapWindow("monthly", wibMs(2026, 7, 30));
  assert.equal(midJuly.isSendDay, false, "Jul 30 is not the last day");

  // Non-leap February: the 28th closes the month.
  const feb = recapWindow("monthly", wibMs(2026, 2, 28, 6));
  assert.equal(feb.endMs, wibMs(2026, 3, 1));
  assert.equal(feb.isSendDay, true);

  // Year rollover: December ends at Jan 1 of the NEXT year.
  const dec = recapWindow("monthly", wibMs(2026, 12, 31, 1));
  assert.equal(dec.endMs, wibMs(2027, 1, 1));
  assert.equal(dec.isSendDay, true);
});

test("recapWindow: an hour-0 send (ref = now − 10min) recaps the JUST-completed period", async () => {
  const { recapWindow } = await loadModule(PERIOD);
  // Cron fires Monday 2026-07-06 00:00 WIB → ref backs into Sunday 23:50.
  const weekly = recapWindow("weekly", wibMs(2026, 7, 6, 0, 0) - 10 * 60_000);
  assert.equal(weekly.isSendDay, true);
  assert.equal(weekly.startMs, wibMs(2026, 6, 29), "covers the FULL prior week");

  // Cron fires Saturday 2026-08-01 00:00 WIB → ref backs into Jul 31.
  const monthly = recapWindow("monthly", wibMs(2026, 8, 1, 0, 0) - 10 * 60_000);
  assert.equal(monthly.isSendDay, true);
  assert.equal(monthly.startMs, wibMs(2026, 7, 1), "covers the FULL prior month");
});
