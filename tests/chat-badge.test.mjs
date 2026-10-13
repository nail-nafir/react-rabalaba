import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { createServer } from "vite";

let server;
async function load(path) {
  server ??= await createServer({ appType: "custom", configFile: "vite.config.ts", logLevel: "silent", server: { middlewareMode: true, watch: null } });
  return server.ssrLoadModule(path);
}
test.after(async () => server?.close());

const symbols = new Set(["BTC-USD", "BRK-B", "BBCA.JK", "EURUSD=X", "SL"]);

test("inline badges normalize only known trading labels and decorative separators", async () => {
  const { inlineBadge } = await load("/src/features/chat/inline-badge.ts");
  for (const [input, label] of [
    ["stop_loss", "Stop loss"], ["stopLoss", "Stop loss"], ["stop-loss", "Stop loss"],
    ["stop_loss: 95.000;", "Stop loss 95.000"], ["entry_price", "Entry"],
    ["entry_price = 100", "Entry 100"], ["take_profit_1", "TP1"],
    ["takeProfit2: 110;", "TP2 110"], ["risk_reward_ratio", "Risk reward"],
    ["riskRewardRatio 1:2", "Risk reward 1:2"], ["SL", "Stop loss"],
  ]) assert.equal(inlineBadge(input, new Set())?.label, label, input);
});

test("badge values retain signs, precision, grouping, currency, percent and ratio punctuation", async () => {
  const { inlineBadge } = await load("/src/features/chat/inline-badge.ts");
  for (const value of ["95.000,25 IDR", "$95,000.50", "Rp95.000", "−0.5R", "-0,5%", "+2.00%", "1:2", "1 : 2.5", ".25%", "100 USDT"]) {
    assert.equal(inlineBadge(`Risk ${value}`, symbols)?.label, `Risk ${value}`);
  }
  assert.equal(inlineBadge("Risiko 1%", symbols)?.label, "Risiko 1%");
});

test("known tickers win over label normalization and keep their exact display text", async () => {
  const { inlineBadge } = await load("/src/features/chat/inline-badge.ts");
  for (const ticker of [...symbols, "$BTC-USD", "btc-usd"]) {
    assert.deepEqual(inlineBadge(ticker, symbols), { label: ticker, tone: "neutral" });
  }
  assert.equal(inlineBadge("ETH-USD", symbols), null);
});

test("badge colors keep the existing financial meanings", async () => {
  const { inlineBadge } = await load("/src/features/chat/inline-badge.ts");
  for (const [input, tone] of [
    ["LONG", "positive"], ["SHORT", "negative"], ["TP1 110", "positive"],
    ["Stop loss 95", "negative"], ["OVERBOUGHT", "warning"], ["TIER A", "neutral"], ["NEUTRAL", "neutral"],
    ["Entry 100", "neutral"], ["Risk reward 1:2", "neutral"],
  ]) assert.equal(inlineBadge(input, symbols)?.tone, tone, input);
});

test("concepts, sentences, programming identifiers and malformed values are not badges", async () => {
  const { inlineBadge } = await load("/src/features/chat/inline-badge.ts");
  for (const text of [
    "FOMO", "invalidasi", "cuy;", "WKWKWK", "portfolio_value", "stop_loss_enabled",
    "stop_loss()", "const stop_loss = 95;", "Stop loss jangan digeser", "Risk reward pasti cuan",
    "Risk 1%; jangan all in", "Entry NaN", "Entry <img src=x>", "Entry 100\nSHORT",
    "https://example.com/stop_loss", '{"stop_loss":95}', "",
  ]) assert.equal(inlineBadge(text, symbols), null, text);
});

test("the actual Markdown renderer normalizes badges without rewriting code, links or prose", async () => {
  const { AssistantMarkdown } = await load("/src/features/chat/components/research-copilot.tsx");
  const i18n = createInstance();
  await i18n.init({ lng: "en", resources: {}, initImmediate: false });
  const content = [
    "`BTC-USD` `LONG` `stop_loss: 95.000;` `Risk reward 1:2`",
    "FOMO tetap prosa; `portfolio_value` tetap identifier.",
    "[Sumber](https://example.com/stop_loss?a=1;b=2)",
    "```js\nconst stop_loss = -95;\n```",
    "```\nstop_loss: 95;\n```",
  ].join("\n\n");
  const render = (streaming) => renderToStaticMarkup(React.createElement(I18nextProvider, { i18n },
    React.createElement(AssistantMarkdown, {
      content, terminalContext: { symbol: "BTC-USD" }, marketContexts: [], streaming,
    })));
  for (const streaming of [true, false]) {
    const html = render(streaming);
    assert.equal((html.match(/data-slot="badge"/g) ?? []).length, 4);
    assert.match(html, />Stop loss 95\.000<\/span>/);
    assert.match(html, />Risk reward 1:2<\/span>/);
    assert.match(html, /FOMO tetap prosa;/);
    assert.match(html, /<code[^>]*>portfolio_value<\/code>/);
    assert.match(html, /href="https:\/\/example.com\/stop_loss\?a=1;b=2"/);
    assert.match(html, /const stop_loss = -95;/);
    assert.match(html, /<code class="font-mono">stop_loss: 95;<\/code>/);
    assert.match(html, /border-rose-500\/30 bg-rose-500\/10 text-rose-500/);
  }
  assert.ok(content.includes("`stop_loss: 95.000;`"), "raw message stays available for copy/history");
});
