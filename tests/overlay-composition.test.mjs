import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const ROOT = resolve("src");
const APP_EXTENSIONS = new Set([".ts", ".tsx"]);

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return APP_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
  });
}

const files = sourceFiles(ROOT).filter(
  (path) => !relative(ROOT, path).startsWith("components/ui/"),
);
const sources = files.map((path) => ({
  path: relative(ROOT, path),
  source: readFileSync(path, "utf8"),
}));
const source = sources.map((file) => file.source).join("\n");

function count(pattern, value = source) {
  return value.match(pattern)?.length ?? 0;
}

test("every application overlay root has a matching Trigger", () => {
  for (const primitive of [
    "Dialog",
    "AlertDialog",
    "Popover",
    "Sheet",
    "Select",
    "DropdownMenu",
    "Tooltip",
  ]) {
    const roots = count(new RegExp(`<${primitive}(?=[\\s>])`, "g"));
    const triggers = count(new RegExp(`<${primitive}Trigger(?=[\\s>])`, "g"));
    assert.equal(
      triggers,
      roots,
      `${primitive}: ${roots} roots, ${triggers} triggers`,
    );
  }
});

test("controlled visibility is limited to local async Dialog workflows", () => {
  const primitiveTags = Object.fromEntries(
    [
      "Dialog",
      "AlertDialog",
      "Popover",
      "Sheet",
      "Select",
      "DropdownMenu",
      "Tooltip",
    ].map((primitive) => [
      primitive,
      source.match(new RegExp(`<${primitive}(?=[\\s>])[\\s\\S]*?>`, "g")) ?? [],
    ]),
  );

  for (const tags of Object.values(primitiveTags)) {
    for (const tag of tags) {
      assert.equal(/\bopen=/.test(tag), /\bonOpenChange=/.test(tag), tag);
    }
  }

  assert.equal(
    primitiveTags.AlertDialog.filter((tag) => /\bopen=/.test(tag)).length,
    primitiveTags.AlertDialog.length,
  );
  assert.equal(
    primitiveTags.Dialog.filter((tag) => /\bopen=/.test(tag)).length,
    13,
  );
  for (const primitive of [
    "Popover",
    "Sheet",
    "Select",
    "DropdownMenu",
    "Tooltip",
  ]) {
    for (const tag of primitiveTags[primitive]) {
      assert.doesNotMatch(tag, /\bopen=/, tag);
    }
  }
});

test("every AlertDialogAction uses a local success-only async close handler", () => {
  const hiddenCloses = (
    source.match(/<AlertDialogCancel\b[\s\S]*?>/g) ?? []
  ).filter((tag) => tag.includes('className="hidden"'));
  const controlledAlerts = (
    source.match(/<AlertDialog(?=[\s>])[\s\S]*?>/g) ?? []
  ).filter((tag) => /\bopen=/.test(tag));

  assert.equal(hiddenCloses.length, 0);
  let actionCount = 0;

  for (const file of sources) {
    const actions = file.source.match(/<AlertDialogAction\b[\s\S]*?>/g) ?? [];
    actionCount += actions.length;
    for (const action of actions) {
      const handler = action.match(
        /\bonClick=\{(handle[A-Za-z]*Action)\}/,
      )?.[1];
      assert.ok(handler, `${file.path}: ${action}`);
      assert.match(action, /\bdisabled=/, `${file.path}: ${action}`);
      assert.match(action, /\baria-busy=/, `${file.path}: ${action}`);

      const handlerStart = file.source.indexOf(`const ${handler} = async`);
      assert.ok(handlerStart >= 0, `${file.path}: ${handler}`);
      const handlerSource = file.source.slice(
        handlerStart,
        handlerStart + 1800,
      );
      assert.match(handlerSource, /event\.preventDefault\(\)/, file.path);
      assert.match(handlerSource, /if\s*\(await\s+[^)]+\)/, file.path);
      assert.match(handlerSource, /set[A-Za-z]*Open\(false\)/, file.path);
    }
  }

  assert.ok(actionCount > 0);
  assert.equal(controlledAlerts.length, actionCount);
});

test("every AlertDialog footer has one disabled-aware Cancel and Action", () => {
  let footerCount = 0;

  for (const file of sources) {
    const footers =
      file.source.match(/<AlertDialogFooter\b[\s\S]*?<\/AlertDialogFooter>/g) ??
      [];
    for (const footer of footers) {
      footerCount += 1;
      const cancels =
        footer.match(/<AlertDialogCancel\b[\s\S]*?<\/AlertDialogCancel>/g) ??
        [];
      const actions = footer.match(/<AlertDialogAction\b[\s\S]*?>/g) ?? [];
      assert.equal(cancels.length, 1, file.path);
      assert.equal(actions.length, 1, file.path);
      assert.match(cancels[0], /\bdisabled=/, file.path);
      assert.match(cancels[0], /common\.cancel/, file.path);
      assert.match(actions[0], /\bdisabled=/, file.path);
    }
  }

  assert.ok(footerCount > 0);
});

test("dialog primary actions share canonical icon, label, and pending content", () => {
  let footerCount = 0;

  for (const file of sources) {
    for (const footer of [
      ...(file.source.match(/<DialogFooter\b[\s\S]*?<\/DialogFooter>/g) ?? []),
      ...(file.source.match(
        /<AlertDialogFooter\b[\s\S]*?<\/AlertDialogFooter>/g,
      ) ?? []),
    ]) {
      footerCount += 1;
      assert.match(footer, /<ActionButtonContent\b/, file.path);
      assert.doesNotMatch(footer, /<(?:Loader2|Spinner)\b/, file.path);
    }
  }

  assert.ok(footerCount > 0);

  const helper = readFileSync(
    resolve(ROOT, "components/shared/action-button-content.tsx"),
    "utf8",
  );
  assert.match(helper, /<Spinner\b/);
  assert.match(helper, /<span>\{label\}<\/span>/);
});

test("canonical dialog action labels are one word in every locale", () => {
  const expectedActions = [
    "add",
    "save",
    "create",
    "confirm",
    "delete",
    "activate",
    "deactivate",
    "publish",
    "replace",
    "move",
    "submit",
    "unlock",
    "login",
    "logout",
    "upgrade",
    "reject",
    "feature",
  ];

  for (const locale of ["id", "en"]) {
    const translations = JSON.parse(
      readFileSync(resolve(ROOT, `assets/locales/${locale}.json`), "utf8"),
    );
    assert.deepEqual(
      Object.keys(translations.common.actions).sort(),
      [...expectedActions].sort(),
      locale,
    );
    for (const [key, label] of Object.entries(translations.common.actions)) {
      assert.equal(label.trim().split(/\s+/).length, 1, `${locale}.${key}`);
    }
  }
});

test("overlay composition has no shared or imperative close workarounds", () => {
  const dialogSources = sources.filter(({ source: fileSource }) =>
    /<Dialog(?=[\s>])/.test(fileSource),
  );
  const hiddenDialogCloses = (
    source.match(/<DialogClose\b[\s\S]*?>/g) ?? []
  ).filter((tag) => tag.includes('className="hidden"'));
  const removedPaths = [
    "components/shared/symbol-search-dialog.tsx",
    "hooks/use-dialog-close.ts",
    "hooks/use-async-alert-dialog-action.ts",
  ];

  for (const path of removedPaths) {
    assert.equal(existsSync(resolve(ROOT, path)), false, path);
  }
  assert.equal(hiddenDialogCloses.length, 0);
  assert.doesNotMatch(
    source,
    /SymbolSearchDialog|useDialogClose|useAsyncAlertDialogAction/,
  );
  assert.doesNotMatch(source, /\.current\?\.click\(\)/);
  for (const file of dialogSources) {
    assert.doesNotMatch(file.source, /document\.getElementById/);
  }

  for (const path of [
    "features/admin/components/add-journal-asset-dialog.tsx",
    "features/market/components/add-signal-asset-dialog.tsx",
  ]) {
    const file = sources.find((candidate) => candidate.path === path);
    assert.ok(file, path);
    assert.match(file.source, /\buseYahooSearch\(/);
    assert.match(file.source, /\bpendingSymbols\b/);
    assert.match(file.source, /<Dialog open=\{open\}/);
  }
});
