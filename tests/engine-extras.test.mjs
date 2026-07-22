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



/** Hourly chart spanning `hours` bars ending at `refSec`, with per-bar closes
 *  supplied by `closeAt(hoursAgo)` — hoursAgo counts back from the ref bar. */
function makeHourlyChart(symbol, { hours, refSec, closeAt, meta = {} }) {
  const timestamps = Array.from(
    { length: hours + 1 },
    (_, i) => refSec - (hours - i) * 3600,
  );
  const close = timestamps.map((_, i) => closeAt(hours - i));
  return {
    meta: {
      symbol,
      regularMarketPrice: close[close.length - 1],
      regularMarketVolume: 1000,
      regularMarketTime: refSec,
      range: "1mo",
      dataGranularity: "1h",
      instrumentType: symbol.includes("-USD") ? "CRYPTOCURRENCY" : "EQUITY",
      ...meta,
    },
    timestamp: timestamps,
    indicators: {
      quote: [
        {
          open: close.map((c) => c),
          high: close.map((c) => c * 1.001),
          low: close.map((c) => c * 0.999),
          close,
          volume: close.map(() => 1000),
        },
      ],
    },
  };
}

test("crypto daily change is a ROLLING 24h window, stocks keep previous session close", async () => {
  const { adaptYahooChart } = await loadModule(
    "/src/services/adapters/yahoo-adapter.ts",
  );
  const refSec = 1_700_000_000;
  // 48h of hourly bars: close was 100 exactly 24h ago, 109.07 now; Yahoo's
  // previousClose (last UTC-midnight close) says 104 — the "understated"
  // baseline the app used to display.
  const closeAt = (hoursAgo) =>
    hoursAgo >= 24 ? 100 - (hoursAgo - 24) * 0.1 : 100 + (24 - hoursAgo) * 0.37791666;
  const sol = adaptYahooChart(
    makeHourlyChart("SOL-USD", {
      hours: 48,
      refSec,
      closeAt,
      meta: { previousClose: 104 },
    }),
  );
  assert.ok(
    Math.abs(sol.changePercent - 9.07) < 0.05,
    `crypto change ≈ +9.07% (rolling 24h vs 100), got ${sol.changePercent}`,
  );

  // Same series as a STOCK: the exchange convention (vs previous session
  // close from meta) must be preserved.
  const stock = adaptYahooChart(
    makeHourlyChart("AAPL", {
      hours: 48,
      refSec,
      closeAt,
      meta: { previousClose: 104, instrumentType: "EQUITY" },
    }),
  );
  assert.ok(
    Math.abs(stock.changePercent - ((stock.price - 104) / 104) * 100) < 1e-9,
    "stock change stays vs meta previousClose",
  );
});

test("crypto change ignores a garbage near-zero Yahoo baseline (the +1,000,000% bug)", async () => {
  const { adaptYahooChart } = await loadModule(
    "/src/services/adapters/yahoo-adapter.ts",
  );
  const refSec = 1_700_000_000;
  // IP-USD case: coin trades ~0.31 → 0.336 over the day, but Yahoo meta says
  // previousClose = 0.0000292 → the old code printed +1,152,135%.
  const ip = adaptYahooChart(
    makeHourlyChart("IP-USD", {
      hours: 48,
      refSec,
      closeAt: (hoursAgo) => (hoursAgo >= 24 ? 0.31 : 0.31 + (24 - hoursAgo) * 0.0010833),
      meta: { previousClose: 0.0000292 },
    }),
  );
  assert.ok(
    ip.changePercent > 0 && ip.changePercent < 15,
    `garbage meta baseline bypassed via candles, got ${ip.changePercent}%`,
  );

  // Candles that do NOT reach 24h back (young listing) fall back to the meta
  // chain rather than silently reporting 0.
  const young = adaptYahooChart(
    makeHourlyChart("NEW-USD", {
      hours: 6,
      refSec,
      closeAt: (hoursAgo) => 1 + (6 - hoursAgo) * 0.01,
      meta: { previousClose: 1 },
    }),
  );
  assert.ok(
    Math.abs(young.changePercent - ((young.price - 1) / 1) * 100) < 1e-9,
    "short candle span falls back to meta previousClose",
  );
});
