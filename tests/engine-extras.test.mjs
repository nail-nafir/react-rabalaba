import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

// Swallow stray async rejections emitted while Vite's SSR server tears down at
// end-of-file. Real test failures surface synchronously as assertion errors.
process.on("unhandledRejection", () => {});

let server;

async function loadModule(path) {
  if (!server) {
    server = await createServer({
      appType: "custom",
      configFile: "vite.config.ts",
      logLevel: "silent",
      server: { middlewareMode: true, watch: null },
    });
  }
  return server.ssrLoadModule(path);
}

test.after(async () => {
  try {
    if (server) await server.close();
  } catch {
    // Vite's SSR server can reject on teardown; not a test failure.
  }
});

test("calculateRSISeries (O(n)) matches the reference RSI at the final candle", async () => {
  const { calculateRSISeries, calculateRSI } = await loadModule(
    "/src/features/engine/indicators.ts",
  );
  const prices = Array.from(
    { length: 60 },
    (_, i) => 100 + Math.sin(i / 3) * 5 + i * 0.2,
  );
  const series = calculateRSISeries(prices);
  assert.ok(series.length > 0);
  assert.ok(
    Math.abs(series[series.length - 1] - calculateRSI(prices)) < 1e-9,
    "incremental series tail equals a full RSI recompute",
  );
});

function makeChartResult(symbol) {
  const count = 130;
  const close = Array.from({ length: count }, (_, i) => 100 + i);
  return {
    meta: {
      symbol,
      regularMarketPrice: close[count - 1],
      regularMarketVolume: 1000,
      previousClose: close[count - 2],
      range: "1mo",
      dataGranularity: "1h",
      instrumentType: symbol.includes("-USD") ? "CRYPTOCURRENCY" : "EQUITY",
    },
    timestamp: close.map((_, i) => i + 1),
    indicators: {
      quote: [
        {
          open: close.map((c) => c - 0.5),
          high: close.map((c) => c + 1),
          low: close.map((c) => c - 1),
          close,
          volume: close.map(() => 1000),
        },
      ],
    },
  };
}

test("Fear & Greed is scoped to crypto only", async () => {
  const { adaptYahooChart } = await loadModule(
    "/src/services/adapters/yahoo-adapter.ts",
  );
  // Extreme-fear reading (12) passed for both a crypto and a stock.
  const eth = adaptYahooChart(makeChartResult("ETH-USD"), 12);
  const aapl = adaptYahooChart(makeChartResult("AAPL"), 12);

  assert.equal(eth.assetType, "crypto");
  assert.equal(aapl.assetType, "us-stock");
  assert.ok(
    eth.outlook.analysis.sentiment.includes("Fear & Greed"),
    "crypto sentiment reflects the F&G index",
  );
  assert.ok(
    aapl.outlook.analysis.sentiment.toLowerCase().includes("unavailable"),
    "stock sentiment does NOT apply the crypto F&G index",
  );
});
