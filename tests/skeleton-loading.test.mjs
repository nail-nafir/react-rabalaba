import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

const ROOT = resolve("src");

function read(path) {
  return readFileSync(resolve(path), "utf8");
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.(?:ts|tsx)$/.test(entry.name)
        ? [path]
        : [];
  });
}

const skeletonCard = read("src/components/shared/skeleton-card.tsx");
const allSource = sourceFiles(ROOT)
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

test("skeleton keeps one shared animation and surface baseline", () => {
  const skeleton = read("src/components/ui/skeleton.tsx");

  assert.match(skeleton, /animate-pulse/);
  assert.match(skeleton, /rounded-md/);
  assert.match(skeleton, /bg-muted/);
  assert.doesNotMatch(skeleton, /animate-shimmer/);
});

test("shared table skeletons preserve their live column counts", () => {
  const expectedColumns = {
    SkeletonAssetSignalRow: 11,
    SkeletonFollowHistoryRow: 9,
    SkeletonJournalAssetRow: 8,
    SkeletonAdminUserRow: 7,
    SkeletonPaymentMethodRow: 5,
    SkeletonSubscriptionPlanRow: 6,
    SkeletonInvitationRow: 6,
    SkeletonAccessCodeRow: 8,
  };

  for (const [name, count] of Object.entries(expectedColumns)) {
    const body = skeletonCard.match(
      new RegExp(`export function ${name}\\(\\)[\\s\\S]*?(?=\\nexport function|$)`),
    )?.[0];

    assert.ok(body, `${name} should exist`);
    assert.equal(
      body.match(/<TableCell>/g)?.length,
      count,
      `${name} should keep ${count} cells`,
    );
  }
});

test("calendar loading item mirrors the event card shell", () => {
  const calendar = skeletonCard.match(
    /export function SkeletonCalendarItem\(\)[\s\S]*?(?=\nexport function|$)/,
  )?.[0];

  assert.ok(calendar);
  assert.match(calendar, /<Card className="border border-border"/);
  assert.match(
    calendar,
    /<CardContent className="flex items-center gap-3 px-4 py-4 sm:gap-4"/,
  );
  assert.match(calendar, /size-7 shrink-0 rounded-lg sm:size-8/);
  assert.match(calendar, /h-5 w-20 shrink-0 rounded-md/);
  assert.match(calendar, /h-4 w-3\/4 max-w-64/);
  assert.match(calendar, /h-3 w-1\/4 max-w-16/);
  assert.match(calendar, /h-5 w-16 shrink-0 rounded-md/);
  assert.doesNotMatch(calendar, /hover:/);
});

test("testimonials loading rows preserve every live column", () => {
  const testimonials = read("src/features/management/components/testimonials-table.tsx");
  const body = testimonials.match(
    /function SkeletonRows\(\)[\s\S]*?(?=\nexport function|$)/,
  )?.[0];

  assert.ok(body);
  assert.equal(body.match(/<TableCell>/g)?.length, 8);
  assert.match(body, /h-3\.5 w-full max-w-72/);
  assert.match(body, /h-3\.5 w-11\/12 max-w-64/);
  assert.match(body, /h-3\.5 w-2\/3 max-w-48/);
  assert.match(body, /size-7 rounded-md/);
});

test("page and dialog loading shells reserve their final content geometry", () => {
  const statistics = read("src/pages/management/statistics.tsx");
  const assetDialog = read("src/features/trading-plan/components/asset-detail-dialog.tsx");
  const tradeDialog = read("src/features/follow-trade/components/trade-detail-dialog.tsx");

  assert.match(statistics, /h-64 w-full rounded-xl/);
  assert.match(statistics, /min-h-40 flex-1 flex-col rounded-lg/);
  assert.match(assetDialog, /h-8 w-32 max-w-full/);
  assert.match(assetDialog, /mx-auto size-24 rounded-full/);
  assert.match(tradeDialog, /h-6 w-20/);
});

test("data skeletons do not use decorative shimmer", () => {
  assert.doesNotMatch(allSource, /<Skeleton[^>]*animate-shimmer/);
});

test("unused shared card skeleton exports stay removed", () => {
  assert.doesNotMatch(skeletonCard, /export function Skeleton(?:Card|CryptoCard|IndexCard)/);
  assert.doesNotMatch(allSource, /Skeleton(?:CryptoCard|IndexCard)/);
  assert.doesNotMatch(
    allSource,
    /import\s*{[^}]*SkeletonCard[^}]*}\s*from ["']@\/components\/shared\/skeleton-card["']/,
  );
});
