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

  assert.match(
    source,
    /if \(tier === "premium"\)[\s\S]*license\.status_premium[\s\S]*license\.close_btn/,
  );
  assert.ok(
    source.indexOf('if (tier === "premium")') < source.indexOf("<form"),
  );
  assert.match(source, /license\.input_placeholder/);
  assert.match(source, /license\.activate_btn/);
});
