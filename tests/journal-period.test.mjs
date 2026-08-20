import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    // Vite SSR teardown reject is ignored.
  }
});

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const wibMs = (year, month, day, hour = 0, minute = 0) =>
  Date.UTC(year, month - 1, day, hour, minute) - WIB_OFFSET_MS;

const PERIOD_MODULE = "/src/features/journal/model/journal-period.ts";

test("1-month period uses the current WIB calendar month", async () => {
  const { resolveJournalPeriod } = await loadModule(PERIOD_MODULE);
  const bounds = resolveJournalPeriod(1, null, wibMs(2026, 7, 27, 10, 49));

  assert.equal(bounds.startMs, wibMs(2026, 7, 1));
  assert.equal(bounds.endMs, wibMs(2026, 8, 1));
  assert.equal(bounds.nextRolloverMs, wibMs(2026, 8, 1));
});

test("3-month period uses fixed WIB calendar quarters", async () => {
  const { resolveJournalPeriod } = await loadModule(PERIOD_MODULE);
  const bounds = resolveJournalPeriod(3, null, wibMs(2026, 8, 30, 18, 5));

  assert.equal(bounds.startMs, wibMs(2026, 7, 1));
  assert.equal(bounds.endMs, wibMs(2026, 10, 1));
  assert.equal(bounds.nextRolloverMs, wibMs(2026, 10, 1));
});

test("6-month period uses calendar semesters", async () => {
  const { resolveJournalPeriod } = await loadModule(PERIOD_MODULE);
  const firstHalf = resolveJournalPeriod(6, null, wibMs(2026, 2, 28, 23, 59));
  const secondHalf = resolveJournalPeriod(6, null, wibMs(2026, 12, 31, 23, 59));

  assert.equal(firstHalf.startMs, wibMs(2026, 1, 1));
  assert.equal(firstHalf.endMs, wibMs(2026, 7, 1));
  assert.equal(secondHalf.startMs, wibMs(2026, 7, 1));
  assert.equal(secondHalf.endMs, wibMs(2027, 1, 1));
});

test("12-month period handles the WIB year boundary", async () => {
  const { resolveJournalPeriod } = await loadModule(PERIOD_MODULE);
  const bounds = resolveJournalPeriod(12, null, wibMs(2026, 12, 31, 23, 59));

  assert.equal(bounds.startMs, wibMs(2026, 1, 1));
  assert.equal(bounds.endMs, wibMs(2027, 1, 1));
});

test("manual reset overrides a calendar window only until its next rollover", async () => {
  const { resolveJournalPeriod } = await loadModule(PERIOD_MODULE);
  const resetAt = wibMs(2026, 7, 29, 13, 30);

  const sameQuarter = resolveJournalPeriod(
    3,
    new Date(resetAt).toISOString(),
    wibMs(2026, 8, 30, 9),
  );
  assert.equal(sameQuarter.startMs, resetAt);
  assert.equal(sameQuarter.endMs, wibMs(2026, 10, 1));

  const nextQuarter = resolveJournalPeriod(
    3,
    new Date(resetAt).toISOString(),
    wibMs(2026, 10, 1, 0, 1),
  );
  assert.equal(nextQuarter.startMs, wibMs(2026, 10, 1));
  assert.equal(nextQuarter.endMs, wibMs(2027, 1, 1));
});

test("closed boundaries are start-inclusive and end-exclusive", async () => {
  const { isClosedTradeInPeriod } = await loadModule(PERIOD_MODULE);
  const bounds = {
    startMs: wibMs(2026, 7, 1),
    endMs: wibMs(2026, 10, 1),
    nextRolloverMs: wibMs(2026, 10, 1),
  };

  assert.equal(isClosedTradeInPeriod(bounds.startMs, bounds), true);
  assert.equal(isClosedTradeInPeriod(bounds.endMs - 1, bounds), true);
  assert.equal(isClosedTradeInPeriod(bounds.endMs, bounds), false);
  assert.equal(isClosedTradeInPeriod(bounds.startMs - 1, bounds), false);
});

test("batched row loader retrieves and deduplicates more than 1,000 rows", async () => {
  const { collectPaginatedRows } = await loadModule(
    "/src/features/journal/model/paginated-rows.ts",
  );
  const rows = Array.from({ length: 1_792 }, (_, index) => ({
    id: `trade-${index}`,
  }));
  const ranges = [];

  const result = await collectPaginatedRows(async (from, to) => {
    ranges.push([from, to]);
    if (from === 0) return rows.slice(0, 1_000);
    return [rows[999], ...rows.slice(1_000)];
  });

  assert.equal(result.length, 1_792);
  assert.equal(new Set(result.map((row) => row.id)).size, 1_792);
  assert.deepEqual(ranges, [
    [0, 999],
    [1_000, 1_999],
  ]);
});

test("active-period metrics share one scoped dataset while history stays lifetime", async () => {
  const { isClosedTradeInPeriod } = await loadModule(PERIOD_MODULE);
  const { buildTrackerStats, buildTradeWinrateSnapshots } = await loadModule(
    "/src/core/trade/follow-trade-model.ts",
  );
  const start = wibMs(2026, 7, 27);
  const end = wibMs(2026, 8, 3);
  const base = {
    name: "Asset",
    assetType: "crypto",
    signal: "long",
    timeframe: "1d",
    entryPrice: 100,
    stopLoss: 90,
    takeProfits: [110, 120, 130],
    riskRewardRatio: 3,
    strengthAtEntry: 80,
    grade: "A",
    highestTpReached: 0,
  };
  const lifetime = [
    {
      ...base,
      id: "old-loss",
      symbol: "ETH-USD",
      followedAt: start - 20_000,
      closedAt: start - 10_000,
      closePrice: 90,
      status: "sl",
    },
    {
      ...base,
      id: "current-win",
      symbol: "ETH-USD",
      followedAt: start + 10_000,
      closedAt: start + 20_000,
      closePrice: 120,
      status: "tp2",
    },
    {
      ...base,
      id: "carry-open",
      symbol: "SOL-USD",
      followedAt: start - 50_000,
      status: "open",
    },
  ];
  const bounds = { startMs: start, endMs: end, nextRolloverMs: end };
  const active = lifetime.filter(
    (trade) =>
      trade.status === "open" || isClosedTradeInPeriod(trade.closedAt, bounds),
  );

  assert.deepEqual(
    active.map((trade) => trade.id),
    ["current-win", "carry-open"],
    "old closed trades disappear but old open positions carry over",
  );

  const activeClosed = active.filter((trade) => trade.status !== "open");
  const lifetimeClosed = lifetime.filter((trade) => trade.status !== "open");
  const activeStats = buildTrackerStats(activeClosed, 1);
  const lifetimeStats = buildTrackerStats(lifetimeClosed, 1);

  assert.equal(activeStats.winRate, 100);
  assert.equal(activeStats.totalR, 2);
  assert.deepEqual(activeStats.perAsset, [{ symbol: "ETH-USD", pct: 20 }]);
  assert.equal(lifetimeStats.winRate, 50);
  assert.equal(lifetimeStats.totalR, 1);
  assert.deepEqual(lifetimeStats.perAsset, [{ symbol: "ETH-USD", pct: 10 }]);
  assert.deepEqual(buildTradeWinrateSnapshots(active)["current-win"], {
    wins: 1,
    total: 1,
  });
  assert.deepEqual(buildTradeWinrateSnapshots(lifetime)["current-win"], {
    wins: 1,
    total: 2,
  });
});

test("migration exposes guarded RPCs and never deletes journal trades", () => {
  const initialSql = readFileSync(
    new URL(
      "../supabase/migrations/20260727042144_journal_active_period.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const monthsSql = readFileSync(
    new URL(
      "../supabase/migrations/20260727045554_journal_period_months.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const sql = `${initialSql}\n${monthsSql}`;

  assert.match(
    monthsSql,
    /rename column journal_period_mode to journal_period_months/i,
  );
  assert.match(monthsSql, /journal_period_months set default 1/i);
  assert.match(monthsSql, /journal_period_months in \(1, 3, 6, 12\)/i);
  assert.match(sql, /journal_period_reset_at timestamptz/i);
  assert.match(sql, /journal_period_reset_by uuid/i);
  assert.match(monthsSql, /get_journal_period_config\(\)/i);
  assert.match(initialSql, /admin_start_new_journal_period\(\)/i);
  assert.match(monthsSql, /auth\.uid\(\)\) is not null/i);
  assert.match(initialSql, /public\.is_admin\(\)/i);
  assert.match(monthsSql, /security definer/i);
  assert.match(initialSql, /security invoker/i);
  assert.match(monthsSql, /revoke all on function[\s\S]*from anon/i);
  assert.match(monthsSql, /grant execute on function[\s\S]*to authenticated/i);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.journal_trades/i);
});

test("terminal query keeps open carryover separate and filters closed rows server-side", () => {
  const source = readFileSync(
    new URL(
      "../src/features/journal/hooks/use-journal-trades.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /\.eq\("status", "open"\)/);
  assert.match(source, /\.neq\("status", "open"\)/);
  assert.match(source, /\.gte\("closed_at"/);
  assert.match(source, /\.lt\("closed_at"/);
  assert.match(source, /\.range\(from, to\)/);
  assert.match(source, /Promise\.all\(\[\s*fetchOpenRows\(\)/);
});

test("terminal is fixed to active period while admin statistics stays lifetime", () => {
  const terminal = readFileSync(
    new URL(
      "../src/features/journal/components/journal-terminal-content.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const adminStatistics = readFileSync(
    new URL("../src/pages/management/statistics.tsx", import.meta.url),
    "utf8",
  );

  assert.match(terminal, /scope:\s*"active"/);
  assert.doesNotMatch(terminal, /JournalPeriodBar|setScope|period_scope/);
  assert.match(adminStatistics, /useJournalTrades\(\{ scope: "history" \}\)/);
});

test("period settings reuse the compact shared controls", () => {
  const source = readFileSync(
    new URL(
      "../src/features/management/components/journal-period-settings.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /PERIOD_MONTH_OPTIONS[^=]*= \[1, 3, 6, 12\]/);
  assert.match(source, /<SettingSelect/);
  assert.match(source, /<ManualActionCard/);
  assert.match(source, /<AlertDialogContent>/);
  assert.doesNotMatch(source, /ToggleGroup|period_mode_manual/);
});

test("failed settings saves roll back and rethrow before the success toast path", () => {
  const hook = readFileSync(
    new URL("../src/features/management/hooks/use-journal-settings.ts", import.meta.url),
    "utf8",
  );
  const dialog = readFileSync(
    new URL(
      "../src/features/management/components/journal-settings-dialog.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    hook,
    /if \(error\) \{\s*queryClient\.setQueryData\(QUERY_KEY, previous\);\s*throw error;/,
  );
  assert.match(hook, /if \(!data\) \{[\s\S]*update was not applied/);
  assert.match(dialog, /await update\(\{/);
  assert.match(
    dialog,
    /catch \{\s*toast\.error\(t\("toasts\.journal_settings\.save_error"\)\)/,
  );
});
