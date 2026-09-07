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
    SkeletonAssetSignalRow: 10,
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
    /<CardContent className="flex items-center gap-3 sm:gap-4"/,
  );
  assert.match(calendar, /h-5 w-14 rounded-md/);
  assert.doesNotMatch(calendar, /hover:/);
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
