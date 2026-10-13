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

test("every empty state follows the shared recipe", () => {
  // The Sensei welcome is a left aligned intro with prompt cards, and the
  // compact Sentimen Pasar error must fit its card. Everything else matches.
  const exceptions = [/chat\.empty_title/, /market\.data_offline/];
  const allowedClasses = new Set([
    "min-h-72",
    "min-h-[80vh]",
    "h-full",
    "md:col-span-3",
  ]);
  const blocks = sourceFiles(srcRoot)
    .filter((file) => !file.includes(join("components", "ui")))
    .flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/<Empty(?=[\s>])[\s\S]*?<\/Empty>/g)].map(
        ([block]) => ({ file, block }),
      ),
    )
    .filter(({ block }) => !exceptions.some((pattern) => pattern.test(block)));

  assert.ok(blocks.length > 40, `only ${blocks.length} empty states found`);
  for (const { file, block } of blocks) {
    const where = `${file}: ${block.slice(0, 90)}`;
    const openTag = block.match(/^<Empty[^>]*>/)[0];
    const classes = openTag.match(/className="([^"]*)"/)?.[1].split(/\s+/) ?? [];
    for (const token of classes.filter(Boolean)) {
      assert.ok(allowedClasses.has(token), `${where} overrides ${token}`);
      // The taller box only reserves a journal chart's height.
      if (token === "min-h-72") {
        assert.match(file, /journal-dashboard\.tsx$/, `${where} min-h-72`);
      }
    }
    assert.doesNotMatch(
      block,
      /<Empty(?:Header|Media|Title|Description|Content)\b[^>]*className=/,
      `${where} restyles a primitive`,
    );
    const media = block.match(/<EmptyMedia variant="icon">([\s\S]*?)<\/EmptyMedia>/)?.[1];
    assert.ok(media, `${where} needs an icon header`);
    assert.doesNotMatch(media, /className=/, `${where} resizes its icon`);
    assert.match(block, /<EmptyTitle>/, `${where} needs a title`);
    assert.match(block, /<EmptyDescription>/, `${where} needs a description`);
    if (/role="alert"/.test(openTag)) {
      assert.match(media, /<AlertCircle aria-hidden="true" \/>/, `${where} error icon`);
    }
    const content = block.match(/<EmptyContent>([\s\S]*?)<\/EmptyContent>/)?.[1] ?? "";
    for (const [action] of content.matchAll(/<(Button|Link)\b[\s\S]*?<\/\1>/g)) {
      assert.match(action, /data-icon="inline-start"/, `${where} action without icon`);
      if (action.includes("common.retry")) {
        assert.match(action, /<RefreshCw data-icon="inline-start" \/>/, `${where} retry icon`);
      }
    }
  }
});
