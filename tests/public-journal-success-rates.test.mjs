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
    // Vite SSR server teardown reject is ignored.
  }
});

test("public success-rate rows are indexed and bigint-like values normalized", async () => {
  const { indexPublicJournalSuccessRates } = await loadModule(
    "/src/features/market/lib/public-journal-success-rates.ts",
  );

  assert.deepEqual(
    indexPublicJournalSuccessRates([
      { symbol: "BTC-USD", wins: "7", total: "10" },
      { symbol: "GC=F", wins: 3, total: 4 },
    ]),
    {
      "BTC-USD": { wins: 7, total: 10 },
      "GC=F": { wins: 3, total: 4 },
    },
  );
});

test("migration exposes only the aggregate RPC and keeps privileges explicit", () => {
  const sql = readFileSync(
    new URL(
      "../supabase/migrations/20260722025846_public_journal_success_rates.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(sql, /get_public_journal_success_rates\(\)/);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /from public\.journal_trades as jt/i);
  assert.match(sql, /where jt\.status <> 'open'/i);
  assert.match(
    sql,
    /revoke all on function public\.get_public_journal_success_rates\(\) from public/i,
  );
  assert.match(
    sql,
    /grant execute on function public\.get_public_journal_success_rates\(\)[\s\S]*to anon, authenticated/i,
  );
  assert.doesNotMatch(sql, /create policy/i);
});
