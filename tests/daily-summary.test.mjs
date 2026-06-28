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

test("formatDailySummaryForDiscord renders the recap with correct stats", async () => {
  const { formatDailySummaryForDiscord } = await loadModule(ALERTS);
  const msg = formatDailySummaryForDiscord(INPUT);

  // Persona + sections present.
  assert.ok(msg.includes("🥋 WANGSIT RABALABA SENSEI"));
  assert.ok(msg.includes("📊 REKAP • 29-06-2026"));
  assert.ok(msg.includes("📢 DITUTUP HARI INI:"));
  assert.ok(msg.includes("🚨 SINYAL BARU:"));
  assert.ok(msg.includes("🟡 MASIH TERBUKA:"));
  assert.ok(msg.includes("🧘 PETUAH SENSEI"));
  assert.ok(msg.includes("━━━"));

  // 3 closed → 2 wins (12, 0.28) / 1 loss (-8.3) → rasio laba rugi 67%.
  assert.ok(msg.includes("✅ DITUTUP: 3 (2 Laba / 1 Rugi) • RASIO LABA RUGI: `67%`"));
  // Total = 12 - 8.3 + 0.28 = 3.98 (≈ +4%), terbaik EIGEN +12%, terburuk MYX -8.3%.
  assert.ok(msg.includes("👑 TERBAIK: **EIGEN-USD** `(+12%)`"));
  assert.ok(msg.includes("🥀 TERBURUK: **MYX-USD** `(-8.3%)`"));
  assert.ok(msg.includes("🚨 SINYAL BARU: 2 • 🟡 MASIH TERBUKA: 3"));

  // A closed one-liner carries outcome label, % and duration.
  assert.ok(
    msg.includes("🎯 **EIGEN-USD** • LONG • A — TP2 `(+12%)` · `1 HARI 9 JAM`"),
  );
  assert.ok(msg.includes("⛔ **MYX-USD** • SHORT • B — SL `(-8.3%)`"));
});

test("open positions sort by floating %, rows without a price last", async () => {
  const { formatDailySummaryForDiscord } = await loadModule(ALERTS);
  const msg = formatDailySummaryForDiscord(INPUT);
  const openIdx = msg.indexOf("🟡 MASIH TERBUKA:");
  const tail = msg.slice(openIdx);
  const xrp = tail.indexOf("XRP-USD"); // +9.1 → first
  const eth = tail.indexOf("ETH-USD"); // +4.2 → second
  const ada = tail.indexOf("ADA-USD"); // no price → last
  assert.ok(xrp < eth && eth < ada);
  // The priceless row shows no % suffix.
  assert.ok(tail.includes("🟢 **ADA-USD** • LONG • C\n"));
});

test("recap marks reversals with their secured TP, badge-style", async () => {
  const { formatDailySummaryForDiscord } = await loadModule(ALERTS);
  const msg = formatDailySummaryForDiscord({
    dateLabel: "29-06-2026",
    closed: [
      // Secured-TP reversal: persisted status is tp2, but reversed=true marks it.
      {
        symbol: "TON-USD",
        signal: "long",
        grade: "A",
        status: "tp2",
        reversed: true,
        tpReached: 2,
        tpTotal: 3,
        pnlPct: 8.4,
      },
      // No-TP reversal.
      {
        symbol: "NEAR-USD",
        signal: "short",
        grade: "C",
        status: "reversed",
        reversed: true,
        tpReached: 0,
        tpTotal: 3,
        pnlPct: -1.2,
      },
    ],
    emitted: [],
    open: [],
  });
  assert.ok(
    msg.includes("🔄 **TON-USD** • LONG • A — REVERSED (TP 2/3) `(+8.4%)`"),
  );
  assert.ok(
    msg.includes("🔄 **NEAR-USD** • SHORT • C — REVERSED (TANPA TP) `(-1.2%)`"),
  );
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

test("open-only day still sends a recap (win rate 0, no closed section)", async () => {
  const { formatDailySummaryForDiscord } = await loadModule(ALERTS);
  const msg = formatDailySummaryForDiscord({
    dateLabel: "29-06-2026",
    closed: [],
    emitted: [],
    open: [{ symbol: "ETH-USD", signal: "long", grade: "B", floatingPct: 1.5 }],
  });
  assert.ok(msg.includes("✅ DITUTUP: 0 (0 Laba / 0 Rugi)"));
  assert.ok(!msg.includes("📢 DITUTUP HARI INI:"));
  assert.ok(msg.includes("🟡 MASIH TERBUKA:"));
});
