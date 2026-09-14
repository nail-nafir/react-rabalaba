import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const srcRoot = join(root, "src");

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.tsx?$/.test(entry.name)
        ? [path]
        : [];
  });
}

function shape(value) {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, shape(child)]),
    );
  }
  return typeof value;
}

test("empty states use the shadcn primitive and locales stay balanced", () => {
  const wrapper = join(srcRoot, "components/shared/empty-state.tsx");
  assert.equal(existsSync(wrapper), false, "custom EmptyState wrapper remains");

  const sources = sourceFiles(srcRoot).map((file) => ({
    file,
    source: readFileSync(file, "utf8"),
  }));
  for (const { file, source } of sources) {
    assert.doesNotMatch(source, /\bEmptyState\b|shared\/empty-state/, file);
    if (file.endsWith("src/components/ui/empty.tsx")) continue;
    if (!/<Empty\b/.test(source)) continue;
    assert.match(
      source,
      /from ["']@\/components\/ui\/empty["']/,
      `${file} must import Empty directly from shadcn/ui`,
    );
  }

  const en = JSON.parse(
    readFileSync(join(srcRoot, "assets/locales/en.json"), "utf8"),
  );
  const id = JSON.parse(
    readFileSync(join(srcRoot, "assets/locales/id.json"), "utf8"),
  );
  assert.deepEqual(shape(en), shape(id), "EN/ID locale structures differ");
});
