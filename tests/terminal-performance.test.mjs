import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { once } from "node:events";
import { Worker as NodeWorker } from "node:worker_threads";
import { build } from "esbuild";
import { createServer } from "vite";
import React from "react";
import { renderToString } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

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
test.after(async () => {
  await server?.close();
});

const candles = Array.from({ length: 360 }, (_, i) => {
  const close = 100 + i * 0.1 + Math.sin(i / 8) * 8;
  return {
    timestamp: 1704067200 + i * 3600,
    open: close - 0.3,
    high: close + 1,
    low: close - 1,
    close,
    volume: 10000 + i * 100,
  };
});
const asset = { symbol: "BTC-USD", assetType: "crypto", timeframe: "swing" };

test("chart restore control matches the terminal refresh affordance", () => {
  const terminal = readFileSync(
    "src/features/market/components/asset-signal-table.tsx",
    "utf8",
  );
  const chart = readFileSync(
    "src/features/trading-plan/components/trade-setup-chart.tsx",
    "utf8",
  );
  const refreshControl = terminal.match(
    /\{t\("market\.screener"\)\}[\s\S]*?<Button[\s\S]*?<\/Button>/,
  )?.[0];
  const resetControl = chart.match(
    /\{viewport !== null && \([\s\S]*?<\/Button>/,
  )?.[0];
  const expectedClass =
    "h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-primary hover:bg-muted cursor-pointer";

  assert.ok(refreshControl);
  assert.ok(resetControl);
  assert.match(refreshControl, /variant="link"/);
  assert.match(refreshControl, /size="icon"/);
  assert.ok(refreshControl.includes(`className="${expectedClass}"`));
  assert.match(resetControl, /variant="link"/);
  assert.match(resetControl, /size="icon"/);
  const resetClass = resetControl.match(
    /className="absolute right-2 top-2 z-10 ([^"]+)"/,
  )?.[1];
  assert.equal(resetClass, expectedClass);
  assert.doesNotMatch(
    resetControl,
    /bg-background|backdrop-blur|rounded-md|border-border|shadow-xs/,
  );
  assert.match(resetControl, /setViewport\(null\)/);
  assert.match(resetControl, /onPointerDown=\{\(e\) => e\.stopPropagation\(\)\}/);
  assert.match(resetControl, /onDoubleClick=\{\(e\) => e\.stopPropagation\(\)\}/);

  assert.match(chart, /overscroll-x-none/);
  assert.match(chart, /overflow-x-auto/);
  assert.match(chart, /touchAction: "pan-y"/);
  assert.match(chart, /addEventListener\("wheel", onWheel, \{ passive: false \}\)/);

  for (const path of [
    "src/features/trading-plan/components/asset-detail-dialog.tsx",
    "src/features/follow-trade/components/trade-detail-dialog.tsx",
  ]) {
    const dialog = readFileSync(path, "utf8");
    assert.match(dialog, /TradeSetupChart/);
    assert.match(dialog, /<TradeSetupChart/);
  }
});

test("closed market and journal dialogs do not mount detail queries or analysis", async () => {
  const { AssetDetailDialog } = await load(
    "/src/features/trading-plan/components/asset-detail-dialog.tsx",
  );
  const { TradeDetailDialog } = await load(
    "/src/features/follow-trade/components/trade-detail-dialog.tsx",
  );
  // No query/auth providers: rendering a detail child here would throw.
  for (const [component, props] of [
    [
      AssetDetailDialog,
      {
        symbol: asset.symbol,
        signalStateAvailable: false,
        signalStateFetching: false,
      },
    ],
    [TradeDetailDialog, { trade: { id: "saved-trade", symbol: asset.symbol } }],
  ]) {
    const html = renderToString(
      React.createElement(component, {
        ...props,
        trigger: React.createElement(
          "tr",
          { role: "button", tabIndex: 0 },
          React.createElement("td", null, "Analyze"),
        ),
      }),
    );
    assert.match(html, /data-state="closed"/);
    assert.doesNotMatch(html, /role="dialog"/);
  }
});

test("mini charts render through Recharts with their SSR-safe dimensions", async () => {
  const { Sparkline } = await load("/src/components/charts/sparkline.tsx");
  const { StrengthBar } = await load(
    "/src/components/charts/strength-bar.tsx",
  );
  const { SuccessRateBar } = await load(
    "/src/components/charts/success-rate-bar.tsx",
  );
  const i18n = createInstance();
  await i18n.init({
    lng: "en",
    resources: { en: { translation: {} } },
  });
  const html = renderToString(
    React.createElement(
      I18nextProvider,
      { i18n },
      React.createElement(
        "div",
        null,
        React.createElement(Sparkline, {
          values: [100, 102, 101, 104],
          width: 64,
          height: 32,
        }),
        React.createElement(StrengthBar, { value: 71 }),
        React.createElement(SuccessRateBar, { wins: 13, total: 40 }),
      ),
    ),
  );
  assert.match(html, /recharts-surface/);
  assert.doesNotMatch(html, /<polyline|<polygon/);
});

test("worker runs the same engine and preserves metrics across the message boundary", async () => {
  const { runBacktest } = await load("/src/core/engine/backtest.ts");
  const { outputFiles } = await build({
    entryPoints: ["src/features/trading-plan/model/backtest.worker.ts"],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    alias: { "@": "./src" },
  });
  const worker = new NodeWorker(
    `const { parentPort } = require('node:worker_threads'); global.self = { postMessage: value => parentPort.postMessage(value) };\n${outputFiles[0].text}\nparentPort.on('message', data => self.onmessage({ data }));`,
    { eval: true },
  );
  try {
    for (const assetType of [
      "crypto",
      "us-stock",
      "id-stock",
      "forex",
      "commodity",
    ]) {
      const message = once(worker, "message");
      worker.postMessage({ candles, assetType, timeframe: "swing" });
      assert.deepEqual((await message)[0], {
        metrics: runBacktest(candles, { assetType, timeframe: "swing" })
          .metrics,
      });
    }
    const message = once(worker, "message");
    worker.postMessage({
      candles: null,
      assetType: "crypto",
      timeframe: "swing",
    });
    assert.equal(typeof (await message)[0].error, "string");
  } finally {
    await worker.terminate();
  }
});

test("backtest cache revisions, close cancellation, errors and retry release their workers", async (t) => {
  const { assetBacktestOptions, runBacktestInWorker } = await load(
    "/src/features/trading-plan/hooks/use-asset-backtest.ts",
  );
  const workers = [];
  class FakeWorker {
    terminated = false;
    constructor() {
      workers.push(this);
    }
    postMessage(input) {
      this.input = input;
    }
    terminate() {
      this.terminated = true;
    }
    finish(data) {
      this.onmessage({ data });
    }
  }
  const originalWorker = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  globalThis.Worker = FakeWorker;
  t.after(() => {
    if (originalWorker)
      Object.defineProperty(globalThis, "Worker", originalWorker);
    else delete globalThis.Worker;
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const metrics = { trades: 0, profitFactor: Infinity };
  try {
    const first = client.fetchQuery(assetBacktestOptions(asset, candles, 1));
    workers.at(-1).finish({ metrics });
    assert.deepEqual(await first, metrics);
    assert.equal(workers.at(-1).terminated, true);
    assert.deepEqual(
      await client.fetchQuery(assetBacktestOptions(asset, candles, 1)),
      metrics,
    );
    assert.equal(
      workers.length,
      1,
      "warm revision must not start another worker",
    );

    const updated = client.fetchQuery(assetBacktestOptions(asset, candles, 2));
    assert.equal(workers.length, 2, "new candle revision gets fresh metrics");
    workers.at(-1).finish({ metrics });
    await updated;
    assert.notDeepEqual(
      assetBacktestOptions(asset, candles, 2).queryKey,
      assetBacktestOptions({ ...asset, timeframe: "position" }, candles, 2)
        .queryKey,
    );
    assert.equal(
      assetBacktestOptions(asset, candles.slice(0, 149), 1).enabled,
      false,
    );

    const options = assetBacktestOptions(asset, candles, 3);
    const observer = new QueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => {});
    const cancelled = workers.at(-1);
    unsubscribe();
    assert.equal(
      cancelled.terminated,
      true,
      "closing the last observer aborts computation",
    );
    cancelled.finish({ metrics });
    assert.equal(
      client.getQueryData(options.queryKey),
      undefined,
      "cancelled output must not enter cache",
    );

    const failed = client.fetchQuery(assetBacktestOptions(asset, candles, 4));
    workers.at(-1).finish({ error: "engine failure" });
    await assert.rejects(failed, /engine failure/);
    assert.equal(workers.at(-1).terminated, true);
    const retried = client.fetchQuery(assetBacktestOptions(asset, candles, 4));
    workers.at(-1).finish({ metrics });
    assert.deepEqual(await retried, metrics);

    for (const event of ["onerror", "onmessageerror"]) {
      const promise = runBacktestInWorker(
        { candles, assetType: "crypto", timeframe: "swing" },
        new AbortController().signal,
      );
      workers.at(-1)[event]({ message: "worker crash", preventDefault() {} });
      await assert.rejects(promise);
      assert.equal(workers.at(-1).terminated, true);
    }
    const aborted = new AbortController();
    aborted.abort();
    const count = workers.length;
    await assert.rejects(runBacktestInWorker({ candles }, aborted.signal), {
      name: "AbortError",
    });
    assert.equal(
      workers.length,
      count,
      "pre-cancelled work never creates a worker",
    );
  } finally {
    client.clear();
  }
});
