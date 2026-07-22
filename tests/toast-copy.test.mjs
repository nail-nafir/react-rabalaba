import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import ts from "typescript";

const ROOT = resolve("src");
const APP_EXTENSIONS = new Set([".ts", ".tsx"]);

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return APP_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
  });
}

function flatten(value, prefix = "", output = {}) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object") flatten(child, path, output);
    else output[path] = child;
  }
  return output;
}

const sources = sourceFiles(ROOT).map((path) => ({
  path: relative(ROOT, path),
  source: readFileSync(path, "utf8"),
}));
const locales = Object.fromEntries(
  ["id", "en"].map((locale) => [
    locale,
    JSON.parse(
      readFileSync(resolve(ROOT, `assets/locales/${locale}.json`), "utf8"),
    ).toasts,
  ]),
);
const flatLocales = Object.fromEntries(
  Object.entries(locales).map(([locale, value]) => [locale, flatten(value)]),
);
const localeKeys = Object.keys(flatLocales.id).sort();

function parseSource(file) {
  return ts.createSourceFile(
    file.path,
    file.source,
    ts.ScriptTarget.Latest,
    true,
    file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function directToastCalls(file) {
  const sourceFile = parseSource(file);
  const calls = [];

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(sourceFile) === "toast" &&
      ["success", "error", "info"].includes(node.expression.name.text)
    ) {
      calls.push({
        args: node.arguments,
        sourceFile,
        text: node.getText(sourceFile),
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return calls;
}

function referencedToastKeys() {
  const known = new Set(localeKeys);
  const referenced = new Set();

  for (const file of sources) {
    const sourceFile = parseSource(file);
    function visit(node) {
      if (ts.isStringLiteralLike(node)) {
        const key = node.text.startsWith("toasts.")
          ? node.text.slice("toasts.".length)
          : node.text;
        if (known.has(key)) referenced.add(key);
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }

  return [...referenced].sort();
}

test("application uses Sonner directly with one localized title", () => {
  assert.equal(existsSync(resolve(ROOT, "lib/notify.ts")), false);

  for (const file of sources) {
    assert.doesNotMatch(file.source, /@\/lib\/notify/, file.path);
    assert.doesNotMatch(
      file.source,
      /\bnotify\.(?:success|error|info)\(/,
      file.path,
    );

    const calls = directToastCalls(file);
    if (calls.length > 0) {
      assert.match(
        file.source,
        /import\s*\{[^}]*\btoast\b[^}]*\}\s*from\s*["']sonner["']/,
        file.path,
      );
    }
    for (const call of calls) {
      assert.equal(call.args.length, 1, `${file.path}: ${call.text}`);
      assert.ok(
        ts.isCallExpression(call.args[0]),
        `${file.path}: ${call.text}`,
      );
      assert.match(
        call.args[0].expression.getText(call.sourceFile),
        /^(?:t|i18n\.t)$/,
        file.path,
      );
      assert.equal(call.args[0].arguments.length, 1, file.path);
    }
  }
});

test("toast locale keys are flat, complete, and referenced", () => {
  assert.equal(localeKeys.length, 90);
  assert.deepEqual(Object.keys(flatLocales.en).sort(), localeKeys);
  assert.deepEqual(referencedToastKeys(), localeKeys);

  for (const [locale, groups] of Object.entries(locales)) {
    for (const [group, entries] of Object.entries(groups)) {
      assert.equal(typeof entries, "object", `${locale}.${group}`);
      assert.equal(Array.isArray(entries), false, `${locale}.${group}`);
      for (const [event, value] of Object.entries(entries)) {
        assert.equal(typeof value, "string", `${locale}.${group}.${event}`);
        assert.ok(value.trim(), `${locale}.${group}.${event}`);
      }
    }
  }
});

test("toast copy stays single language, pronoun free, and dash free", () => {
  const dash = /[-‐‑‒–—]/u;
  const idPronoun =
    /\b(?:aku|saya|gue|gua|kami|kita|kamu|anda|kau|lo|lu|kalian|dia|ia|beliau|mereka)\b/i;
  const enPronoun =
    /\b(?:i|me|my|mine|myself|we|us|our|ours|ourselves|you|your|yours|yourself|yourselves|he|him|his|himself|she|her|hers|herself|they|them|their|theirs|themselves|it|its|itself)\b/i;
  const englishInIndonesian =
    /\b(?:link|password|trial|market|scan|landing|disclaimer|ticker|user)\b/i;
  const indonesianInEnglish =
    /\b(?:gagal|berhasil|simpan|hapus|pengguna|aset|kode|tautan|undangan|ulasan|pasar|pemindaian|coba|lagi|sudah|aman|siap|gas|cuan|gacor|rungkad|masuk|keluar)\b/i;

  for (const [path, value] of Object.entries(flatLocales.id)) {
    assert.doesNotMatch(value, dash, `id.${path}`);
    assert.doesNotMatch(value, idPronoun, `id.${path}`);
    assert.doesNotMatch(value, englishInIndonesian, `id.${path}`);
    assert.doesNotMatch(value, /\{\{|\r|\n|[.?!]$/u, `id.${path}`);
  }
  for (const [path, value] of Object.entries(flatLocales.en)) {
    assert.doesNotMatch(value, dash, `en.${path}`);
    assert.doesNotMatch(value, enPronoun, `en.${path}`);
    assert.doesNotMatch(value, indonesianInEnglish, `en.${path}`);
    assert.doesNotMatch(value, /\{\{|\r|\n|[.?!]$/u, `en.${path}`);
  }
});

test("localized toast pairs keep fixed tone and comparable one-line lengths", () => {
  const prefixPairs = [
    ["Sip, ", "Nice, "],
    ["Waduh, ", "Yikes, "],
    ["Santai, ", "Chill, "],
  ];

  for (const key of localeKeys) {
    const id = flatLocales.id[key];
    const en = flatLocales.en[key];
    const pair = prefixPairs.find(([idPrefix]) => id.startsWith(idPrefix));

    assert.ok(pair, `id.${key}`);
    assert.ok(en.startsWith(pair[1]), `en.${key}`);
    assert.ok(id.length >= 22 && id.length <= 28, `id.${key}`);
    assert.ok(en.length >= 22 && en.length <= 28, `en.${key}`);
    assert.ok(Math.abs(id.length - en.length) <= 4, key);
  }
});
