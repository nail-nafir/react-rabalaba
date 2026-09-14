import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const widgetPath = join(
  root,
  "src/features/chat/components/research-copilot.tsx",
);
const widget = readFileSync(widgetPath, "utf8");
const en = JSON.parse(
  readFileSync(join(root, "src/assets/locales/en.json"), "utf8"),
);
const id = JSON.parse(
  readFileSync(join(root, "src/assets/locales/id.json"), "utf8"),
);

function getPath(value, path) {
  return path.split(".").reduce((current, key) => current?.[key], value);
}

function stringValues(value) {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(stringValues);
}

test("chat copy, locale parity, and widget primitives stay consistent", () => {
  assert.equal(
    existsSync(join(root, "src/components/shared/empty-state.tsx")),
    false,
  );
  assert.match(widget, /from ["']@\/components\/ui\/popover["']/);
  assert.match(widget, /PopoverTrigger/);
  assert.match(widget, /PopoverContent/);
  assert.match(widget, /forceMount/);
  assert.match(widget, /modal=\{false\}/);
  assert.match(widget, /from ["']@\/components\/ui\/message["']/);
  assert.match(widget, /MessageAvatar/);
  assert.match(widget, /from ["']@\/components\/ui\/empty["']/);
  assert.match(widget, /<Empty\b/);
  assert.match(widget, /from ["']@\/components\/ui\/input-group["']/);
  assert.match(widget, /<InputGroup\b/);
  assert.match(widget, /role="alert"/);
  assert.match(widget, /aria-label=/);
  assert.match(widget, /aria-describedby=/);
  assert.match(widget, /aria-hidden="true"/);
  assert.match(widget, /motion-reduce:/);
  assert.match(
    widget,
    /text: t\(`chat\.prompts\.\$\{template\.key\}`\)/,
  );
  assert.match(widget, /function randomPromptTemplates\(\)/);
  assert.match(
    widget,
    /new Set\(PROMPT_TEMPLATE_CONFIG\.map\(\(\{ accent \}\) => accent\)\)/,
  );
  assert.match(widget, /return accents\.map\(\(accent\) =>/);
  assert.match(widget, /useState\(\s*randomPromptTemplates,?\s*\)/);
  assert.match(widget, /setPromptTemplateConfig\(randomPromptTemplates\(\)\)/);
  assert.match(widget, /promptTemplateConfig\.map\(/);
  assert.match(widget, /<EmptyHeader className="w-full items-start/);
  assert.match(widget, /<div className="w-full space-y-1 text-left">/);
  assert.doesNotMatch(widget, /text-center/);
  const promptStart = widget.indexOf("{promptTemplates.map((template) => (");
  const promptEnd = widget.indexOf("</EmptyContent>", promptStart);
  const promptSection = widget.slice(promptStart, promptEnd);
  assert.match(promptSection, /<Card\b/);
  assert.doesNotMatch(promptSection, /<Button\b/);
  assert.match(
    promptSection,
    /group w-full cursor-pointer select-none border border-border transition-all duration-200/,
  );
  assert.match(promptSection, /hover:border-primary hover:bg-muted\/50/);
  assert.match(promptSection, /role="button"/);
  assert.match(promptSection, /tabIndex=\{0\}/);
  assert.match(promptSection, /aria-label=\{template\.text\}/);
  assert.match(promptSection, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(promptSection, /template\.accent/);
  assert.match(promptSection, /justify-between/);
  assert.match(promptSection, /<template\.icon/);
  const accentValues = [
    ...widget.matchAll(/accent:\s*(?:"([^"]+)"|\n\s*"([^"]+)")/g),
  ].map((match) => match[1] ?? match[2]);
  assert.equal(accentValues.length, 8, "all eight templates need an accent");
  assert.equal(
    new Set(accentValues).size,
    3,
    "three visible templates must map to three unique accent groups",
  );
  for (const key of [
    "thesis",
    "invalidation",
    "risk",
    "entry",
    "context",
    "management",
    "catalyst",
    "timeframe",
  ]) {
    assert.match(widget, new RegExp(`key: "${key}"`));
  }
  assert.doesNotMatch(widget, /panelRef|document\.activeElement/);
  assert.doesNotMatch(
    widget,
    />\s*[A-Za-z][^<{]*<\/[A-Za-z]/,
    "visible widget copy must come from translations",
  );

  assert.deepEqual(
    Object.keys(en.chat),
    Object.keys(id.chat),
    "EN/ID chat keys differ",
  );

  const requiredKeys = [
    "title",
    "description",
    "badge",
    "open",
    "close",
    "new_chat",
    "empty_title",
    "empty_description",
    "login_title",
    "login_description",
    "loading",
    "trader",
    "sensei",
    "thinking",
    "input_label",
    "placeholder",
    "composer_hint",
    "send",
    "stop",
    "copy",
    "copied",
    "copy_failed",
    "retry",
    "scroll_latest",
    "messages_label",
    "prompts.thesis",
    "prompts.invalidation",
    "prompts.risk",
    "prompts.entry",
    "prompts.context",
    "prompts.management",
    "prompts.catalyst",
    "prompts.timeframe",
    "errors.auth",
    "errors.input",
    "errors.rate",
    "errors.unavailable",
  ];
  for (const key of requiredKeys) {
    assert.equal(typeof getPath(en.chat, key), "string", `EN missing chat.${key}`);
    assert.equal(typeof getPath(id.chat, key), "string", `ID missing chat.${key}`);
  }

  const copyValues = [
    ...stringValues(en.chat),
    en.common.load_error_title,
    en.common.load_error_description,
    ...stringValues(id.chat),
    id.common.load_error_title,
    id.common.load_error_description,
  ];
  const forbiddenPronoun =
    /\b(?:i|me|my|mine|we|us|our|ours|you|your|yours|they|them|their|theirs|aku|saya|kami|kita|kamu|kalian|mereka|anda|gue|lo)\b/i;
  for (const copy of copyValues) {
    assert.doesNotMatch(copy, forbiddenPronoun, `forbidden pronoun in: ${copy}`);
    assert.doesNotMatch(copy, /-/, `ASCII dash in: ${copy}`);
  }

  const pairedPaths = [
    ...requiredKeys,
    "title",
    "description",
  ];
  for (const path of pairedPaths) {
    const enCopy = getPath(en.chat, path);
    const idCopy = getPath(id.chat, path);
    const ratio = idCopy.length / enCopy.length;
    assert.ok(
      ratio >= 0.65 && ratio <= 1.6,
      `copy length is unbalanced for chat.${path}: ${enCopy.length}/${idCopy.length}`,
    );
  }
  for (const key of ["load_error_title", "load_error_description"]) {
    const ratio = id.common[key].length / en.common[key].length;
    assert.ok(
      ratio >= 0.65 && ratio <= 1.6,
      `copy length is unbalanced for common.${key}`,
    );
  }
});
