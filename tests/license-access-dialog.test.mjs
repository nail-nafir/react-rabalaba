import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("premium subscription dialog shows status instead of activation form", () => {
  const source = readFileSync(
    new URL(
      "../src/components/shared/license-access-dialog.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /const showCodeForm = tier !== "premium"/);
  assert.match(source, /tier === "premium"\s*\?\s*t\("license\.status_premium"/);
  assert.match(source, /\{showCodeForm \? \(/);
  assert.match(source, /license\.input_placeholder/);
  assert.match(source, /license\.activate_btn/);
});
