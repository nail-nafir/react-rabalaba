import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("asset-name migration only backfills blank names", () => {
  const sql = read(
    "supabase/migrations/20260728125625_backfill_journal_asset_names.sql",
  );

  assert.match(sql, /from public\.journal_trades/i);
  assert.match(sql, /nullif\(btrim\(asset\.name\), ''\) is null/i);
  assert.match(sql, /'DCII\.JK'[\s\S]*'GOTO\.JK'[\s\S]*'SINI\.JK'/);
  assert.doesNotMatch(
    sql,
    /\b(?:delete\s+from|insert\s+into)\s+public\.journal_assets/i,
  );
});

test("asset table waits for every initial source and has aligned skeletons", () => {
  const table = read(
    "src/features/management/components/journal-assets-table.tsx",
  );
  const skeletons = read("src/components/shared/skeleton-card.tsx");
  const skeletonRow = skeletons.match(
    /export function SkeletonJournalAssetRow\(\)[\s\S]*?\n}\n/,
  )?.[0];

  assert.match(
    table,
    /isTableLoading\s*=\s*isLoading\s*\|\|\s*isLoadingUsers\s*\|\|\s*isMarketDataLoading/,
  );
  assert.match(table, /\{isTableLoading \? \(/);
  assert.match(
    table,
    /\{!isTableLoading && \([\s\S]*?<DataTablePagination/,
  );
  assert.equal(skeletonRow?.match(/<TableCell>/g)?.length, 8);
});
