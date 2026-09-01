import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const FEATURE = resolve("src/features/learn");
const resources = Object.fromEntries(
  ["en", "id"].map((language) => [
    language,
    JSON.parse(
      readFileSync(resolve(`src/assets/locales/${language}.json`), "utf8"),
    ),
  ]),
);
const locales = Object.fromEntries(
  Object.entries(resources).map(([language, resource]) => [
    language,
    resource.learn,
  ]),
);

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? files(path)
      : /\.(?:ts|tsx)$/.test(entry.name)
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

function get(value, path) {
  return path.split(".").reduce((current, key) => current?.[key], value);
}

test("Learn locales stay complete and structurally identical", () => {
  assert.deepEqual(shape(locales.en), shape(locales.id));

  for (const [language, locale] of Object.entries(locales)) {
    const content = JSON.stringify(locale);
    assert.doesNotMatch(content, /""/, language);
    assert.equal(Object.keys(locale.patterns.candlestick).length, 12);
    assert.equal(Object.keys(locale.patterns.chart).length, 10);
    assert.equal(Object.keys(locale.strategies.items).length, 6);
    assert.equal(Object.keys(locale.quiz.questions).length, 18);
  }
});

test("Learn source has one i18n path and no language-specific fields", () => {
  const source = files(FEATURE)
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  assert.doesNotMatch(source, /i18n\.(?:language|resolvedLanguage)/);
  assert.doesNotMatch(source, /\bisId\b/);
  assert.doesNotMatch(
    source,
    /\b(?:name|title|summary|description|psychology|rules|proTip|question|text|explanation|warningMessage)Id\b/,
  );

  const staticKeys = [
    ...source.matchAll(/\bt\(\s*["']((?:learn|calculator)\.[^"']+)["']/g),
  ].map((match) => match[1]);
  for (const key of staticKeys) {
    for (const [language, resource] of Object.entries(resources)) {
      assert.notEqual(get(resource, key), undefined, `${language}.${key}`);
    }
  }
});
