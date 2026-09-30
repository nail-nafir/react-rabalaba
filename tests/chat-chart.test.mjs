import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { createServer } from "vite";

let server;
async function load(path) {
  server ??= await createServer({
    appType: "custom",
    configFile: "vite.config.ts",
    logLevel: "silent",
    server: { middlewareMode: true, watch: null },
  });
  return server.ssrLoadModule(path);
}
test.after(async () => server?.close());

const now = Date.now();
const base = Math.floor(now / 1_000) - 86_400;
const candles = [
  { timestamp: base, open: 100, high: 104, low: 99, close: 103, volume: 10 },
  { timestamp: base + 86_400, open: 103, high: 105, low: 97, close: 98, volume: 12 },
];
const asset = {
  kind: "trade",
  source: "Terminal",
  symbol: "QCOM",
  assetType: "us-stock",
  timeframe: "swing",
  quoteTime: now,
  capturedAt: now,
  recentCandles: candles,
  outlook: { signal: "long" },
  tradingPlan: { entry: 100, stopLoss: 95, takeProfit1: 105, takeProfit2: 110 },
  position: { signal: "short", entryPrice: 101, stopLoss: 106, takeProfits: [96, 92] },
};

test("chart spec accepts setup and preserves existing chart types without data fields", async () => {
  const { parseChartSpec } = await load("/src/features/chat/chart-model.ts");
  assert.deepEqual(parseChartSpec('{"type":"setup","symbols":["QCOM"]}'), {
    type: "setup", symbols: ["QCOM"],
  });
  assert.equal(parseChartSpec('{"type":"price","symbols":["QCOM"]}')?.type, "price");
  assert.equal(parseChartSpec('{"type":"relativePerformance","symbols":["QCOM","MU"]}')?.type, "relativePerformance");
  assert.equal(parseChartSpec('{"type":"setup","symbols":["QCOM","MU"]}'), null);
  assert.equal(parseChartSpec('{"type":"setup","symbols":["QCOM"],"ohlc":[1]}'), null);
  assert.equal(parseChartSpec('{"type":"setup","symbols":["<svg>"]}'), null);
  assert.equal(parseChartSpec('{"type":"setup"'), null);
});

test("price and relative charts preserve terminal data, alignment, and timeframe rules", async () => {
  const { buildChartData } = await load("/src/features/chat/chart-model.ts");
  const peer = {
    symbol: "MU",
    timeframe: "swing",
    stale: false,
    recentCandles: [
      { ...candles[0], close: 50 },
      { ...candles[1], close: 55 },
    ],
  };
  const price = buildChartData({ type: "price", symbols: ["QCOM"] }, asset, []);
  assert.ok(price);
  assert.equal(price.data[0].QCOM, 103);
  assert.equal(price.data[1].QCOM, 98);
  assert.equal(price.stale, false);

  const relative = buildChartData(
    { type: "relativePerformance", symbols: ["QCOM", "MU"] },
    asset,
    [peer],
  );
  assert.ok(relative);
  assert.equal(relative.data[0].QCOM, 0);
  assert.ok(Math.abs(relative.data[1].MU - 10) < 1e-10);
  assert.ok(Math.abs(relative.data[1].QCOM - (98 / 103 - 1) * 100) < 1e-10);
  assert.equal(buildChartData(
    { type: "relativePerformance", symbols: ["QCOM", "MU"] },
    asset,
    [{ ...peer, timeframe: "day" }],
  ), null);
});

test("setup chart uses actual OHLC and the followed position before a newer plan", async () => {
  const { buildSetupChartModel } = await load("/src/features/chat/chart-model.ts");
  const model = buildSetupChartModel("qcom", asset, []);
  assert.ok(model);
  assert.deepEqual(model.candles, candles);
  assert.deepEqual(model.levels.map(({ key, price }) => [key, price]), [
    ["entry", 101], ["stop_loss", 106], ["tp1", 96], ["tp2", 92],
  ]);
  assert.ok(model.min < 92 && model.max > 106);
  assert.equal(model.stale, false);
});

test("setup chart rejects missing candles and invalid levels without inventing values", async () => {
  const { buildSetupChartModel } = await load("/src/features/chat/chart-model.ts");
  assert.equal(buildSetupChartModel("MISSING", asset, []), null);
  assert.equal(buildSetupChartModel("QCOM", { ...asset, recentCandles: candles.slice(0, 1) }, []), null);
  assert.equal(buildSetupChartModel("QCOM", { ...asset, recentCandles: [candles[0], { ...candles[1], high: 90 }] }, []), null);
  const invalid = buildSetupChartModel("QCOM", { ...asset, position: { ...asset.position, takeProfits: [110] } }, []);
  assert.ok(invalid);
  assert.deepEqual(invalid.levels, []);
  const malformed = buildSetupChartModel("QCOM", { ...asset, position: { ...asset.position, takeProfits: null } }, []);
  assert.ok(malformed);
  assert.deepEqual(malformed.levels, []);
});

test("setup chart resolves searched market data and marks stale snapshots", async () => {
  const { buildSetupChartModel } = await load("/src/features/chat/chart-model.ts");
  const market = {
    source: "Yahoo Finance",
    symbol: "QCOM",
    name: "QUALCOMM Incorporated",
    assetType: "us-stock",
    price: 98,
    changePercent: -1,
    quoteTime: now,
    capturedAt: now,
    stale: true,
    timeframe: "swing",
    outlook: asset.outlook,
    tradingPlan: asset.tradingPlan,
    recentCandles: candles,
  };
  const model = buildSetupChartModel("QCOM", null, [market]);
  assert.ok(model);
  assert.equal(model.asset.source, "Yahoo Finance");
  assert.equal(model.stale, true);
  assert.deepEqual(model.levels.map((level) => level.price), [100, 95, 105, 110]);
});

test("setup chart renders SVG candles and localized labels in both languages", async () => {
  const { buildSetupChartModel } = await load("/src/features/chat/chart-model.ts");
  const { AssistantSetupChart } = await load("/src/features/chat/components/assistant-setup-chart.tsx");
  const model = buildSetupChartModel("QCOM", asset, []);
  assert.ok(model);
  const resources = Object.fromEntries(["id", "en"].map((locale) => [
    locale,
    { translation: JSON.parse(readFileSync(`src/assets/locales/${locale}.json`, "utf8")) },
  ]));
  const labels = { id: "Grafik konfirmasi setup", en: "Setup confirmation chart" };
  for (const locale of ["id", "en"]) {
    const i18n = createInstance();
    await i18n.init({ lng: locale, fallbackLng: false, resources });
    const html = renderToString(React.createElement(I18nextProvider, { i18n }, React.createElement(AssistantSetupChart, { model })));
    assert.match(html, /<svg[^>]*role="img"/);
    assert.equal([...html.matchAll(/<rect\b/g)].length, candles.length);
    assert.match(html, /var\(--color-emerald-400\)/);
    assert.match(html, /var\(--color-rose-400\)/);
    assert.ok(html.includes(labels[locale]));
    assert.ok(html.includes("$103") && html.includes("$98.00"));
    assert.ok(html.includes("Yahoo Finance") === false);
  }
  const i18n = createInstance();
  await i18n.init({ lng: "en", fallbackLng: false, resources });
  const fallback = renderToString(React.createElement(
    I18nextProvider,
    { i18n },
    React.createElement(AssistantSetupChart, {
      model: { ...model, levels: [], stale: true },
    }),
  ));
  assert.match(fallback, /Setup levels are unavailable in this snapshot/);
  assert.match(fallback, /Snapshot may be stale/);
});

test("fragmented chart response stays intact across SSE chunks", async () => {
  const { readChatStream } = await load("/src/features/chat/chat-stream.ts");
  const chart = '```chart\n{"type":"setup","symbols":["QCOM"]}\n```';
  const encoder = new TextEncoder();
  const frames = [chart.slice(0, 19), chart.slice(19)].map((response) =>
    `data: ${JSON.stringify({ response })}\n\n`,
  ).join("") + "data: [DONE]\n\n";
  const bytes = encoder.encode(frames);
  const source = new ReadableStream({
    start(controller) {
      for (let index = 0; index < bytes.length; index += 7) {
        controller.enqueue(bytes.slice(index, index + 7));
      }
      controller.close();
    },
  });
  let actual = "";
  await readChatStream(source, (text) => { actual += text; });
  assert.equal(actual, chart);
});
