import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { createServer } from "vite";

test("main-page help has one labelled native trigger and a closed tooltip in ID/EN", async () => {
  const server = await createServer({
    appType: "custom", configFile: "vite.config.ts", logLevel: "silent",
    server: { middlewareMode: true, watch: null },
  });
  try {
    const { PageHelp } = await server.ssrLoadModule("/src/components/shared/page-help.tsx");
    const { TooltipProvider } = await server.ssrLoadModule("/src/components/ui/tooltip.tsx");
    const resources = Object.fromEntries(["id", "en"].map((language) => [language, {
      translation: JSON.parse(readFileSync(`src/assets/locales/${language}.json`, "utf8")),
    }]));
    const instance = createInstance();
    await instance.init({ resources, lng: "id" });
    for (const language of ["id", "en"]) {
      await instance.changeLanguage(language);
      for (const page of ["terminal", "calendar", "calculator", "learn", "subscription"]) {
        const title = instance.t(`${page}.title`);
        const html = renderToStaticMarkup(React.createElement(I18nextProvider, { i18n: instance },
          React.createElement(TooltipProvider, null, React.createElement(PageHelp, {
            title, description: instance.t(`page_help.${page}`),
          })),
        ));
        const label = `${language}: ${page}`;
        assert.equal((html.match(/<button\b/g) ?? []).length, 1, label);
        assert.match(html, /type="button"/, label);
        assert.ok(html.includes(`aria-label="${instance.t("page_help.label", { title })}"`), label);
        assert.match(html, /data-state="closed"/, label);
        assert.doesNotMatch(html, /\saria-(?:haspopup|expanded|describedby)=/, label);
        assert.match(html, /<svg[^>]*aria-hidden="true"/, label);
        assert.doesNotMatch(html, /data-slot="(?:tooltip|popover)-content"|<a\b|\stitle=/, label);
      }
    }
  } finally { await server.close(); }
});

test("main-page help is one short paragraph with two sentences and balanced ID/EN lengths", () => {
  const locales = Object.fromEntries(["id", "en"].map((language) => [language,
    JSON.parse(readFileSync(`src/assets/locales/${language}.json`, "utf8")),
  ]));
  const narratives = ["terminal", "calendar", "calculator", "learn", "subscription"].map((page) =>
    [locales.id.page_help[page], locales.en.page_help[page]],
  );
  const personalPronouns = /\b(?:aku|saya|gue|gua|gw|kamu|anda|lu|lo|kalian|kita|kami|mereka|dia|beliau|i|me|my|mine|we|us|our|ours|you|your|yours|they|them|their|theirs|he|him|his|she|her|hers|it|its|myself|yourself|ourselves|themselves)\b/i;
  const descriptions = narratives.flat();
  for (const copy of descriptions) {
    assert.equal((copy.match(/[.!?]+(?=\s|$)/g) ?? []).length, 2, copy);
    assert.ok(copy.length <= 80, copy);
    assert.doesNotMatch(copy, /[\r\n]|<[^>]+>/, copy);
  }
  const lengths = descriptions.map((copy) => copy.length);
  assert.ok((Math.max(...lengths) - Math.min(...lengths)) / Math.max(...lengths) <= 0.1);
  for (const locale of Object.values(locales)) {
    for (const copy of Object.values(locale.page_help)) {
      assert.doesNotMatch(copy, /[\p{Dash_Punctuation}\u2212;]/u, copy);
      assert.doesNotMatch(copy, personalPronouns, copy);
    }
    assert.equal(Object.hasOwn(locale.calendar, "timezone"), false);
  }
});
