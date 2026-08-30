import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createServer } from "vite";

process.env.TZ = "UTC";
process.on("unhandledRejection", () => {});

let server;

async function loadModule() {
  if (!server) {
    server = await createServer({
      appType: "custom",
      configFile: "vite.config.ts",
      logLevel: "silent",
      server: { middlewareMode: true, watch: null },
    });
  }
  return server.ssrLoadModule(
    "/src/features/journal/model/journal-performance.ts",
  );
}

test.after(async () => {
  try {
    if (server) await server.close();
  } catch {
    // Vite SSR teardown rejection is harmless here.
  }
});

const closedTrade = ({
  id,
  assetType,
  signal = "long",
  entryPrice = 100,
  closePrice,
  followedAt,
  closedAt = followedAt,
}) => ({
  id,
  symbol: id,
  name: id,
  assetType,
  signal,
  timeframe: "1h",
  entryPrice,
  stopLoss: signal === "long" ? 90 : 110,
  takeProfits: [],
  riskRewardRatio: 1,
  strengthAtEntry: 80,
  followedAt,
  highestTpReached: 0,
  status: "reversed",
  closePrice,
  closedAt,
});

const yahooChart = (points) => ({
  timestamp: points.map(({ at }) => at / 1000),
  indicators: {
    quote: [{ close: points.map(({ close }) => close) }],
  },
});

test("asset categories sum direction-aware closed-trade percentages", async () => {
  const { buildAssetTypePercentSeries } = await loadModule();
  const at = Date.UTC(2026, 7, 1);
  const result = buildAssetTypePercentSeries(
    [
      closedTrade({
        id: "long-win",
        assetType: "crypto",
        closePrice: 110,
        followedAt: at,
      }),
      closedTrade({
        id: "short-win",
        assetType: "crypto",
        signal: "short",
        closePrice: 90,
        followedAt: at,
      }),
      closedTrade({
        id: "loss",
        assetType: "commodity",
        closePrice: 80,
        followedAt: at,
      }),
    ],
    ["crypto", "commodity"],
  );

  assert.deepEqual(result, [
    { assetType: "crypto", pct: 20 },
    { assetType: "commodity", pct: -20 },
  ]);
});

test("journal performance sums direction-aware closed-trade percentages", async () => {
  const { buildJournalPerformanceSeries } = await loadModule();
  const aug1 = Date.UTC(2026, 7, 1);
  const aug2 = Date.UTC(2026, 7, 2);
  const aug3 = Date.UTC(2026, 7, 3);
  const aug4 = Date.UTC(2026, 7, 4, 12);
  const result = buildJournalPerformanceSeries({
    history: [
      closedTrade({
        id: "one",
        assetType: "crypto",
        closePrice: 110,
        followedAt: aug1,
        closedAt: aug2,
      }),
      closedTrade({
        id: "two",
        assetType: "crypto",
        signal: "short",
        closePrice: 90,
        followedAt: aug2,
        closedAt: aug3,
      }),
      closedTrade({
        id: "three",
        assetType: "crypto",
        closePrice: 80,
        followedAt: aug3,
        closedAt: aug4,
      }),
    ],
    timeframe: "ALL",
    oldestTradeMs: aug1,
    nowMs: aug4,
  });

  assert.deepEqual(result.map(({ dayPct }) => dayPct), [0, 10, 10, -20]);
  assert.deepEqual(result.map(({ cumPct }) => cumPct), [0, 10, 20, 0]);
  assert.equal(result[2].dayPctWin, 10);
  assert.equal(result[2].dayPctLoss, null);
  assert.equal(result[3].dayPctWin, null);
  assert.equal(result[3].dayPctLoss, -20);
});

test("BTC and Gold benchmarks normalize from their first available close", async () => {
  const { buildJournalPerformanceSeries } = await loadModule();
  const aug1 = Date.UTC(2026, 7, 1, 12);
  const aug2 = Date.UTC(2026, 7, 2, 12);
  const aug3 = Date.UTC(2026, 7, 3, 12);
  const aug4 = Date.UTC(2026, 7, 4, 12);
  const result = buildJournalPerformanceSeries({
    history: [
      closedTrade({
        id: "baseline",
        assetType: "crypto",
        closePrice: 100,
        followedAt: aug1,
      }),
    ],
    timeframe: "ALL",
    oldestTradeMs: aug1,
    nowMs: aug4,
    benchmarkData: {
      btcPct: yahooChart([
        { at: aug1, close: 100 },
        { at: aug3, close: 110 },
      ]),
      goldPct: yahooChart([
        { at: aug2, close: 200 },
        { at: aug4, close: 180 },
      ]),
    },
  });

  assert.deepEqual(result.map(({ btcPct }) => btcPct), [0, 0, 10, 10]);
  assert.deepEqual(result.map(({ goldPct }) => goldPct), [null, 0, 0, -10]);
});

test("benchmark query windows match each journal timeframe", async () => {
  const { benchmarkQueryWindow } = await loadModule();
  const now = Date.UTC(2026, 7, 29);

  assert.deepEqual(benchmarkQueryWindow("1D", now, now), {
    range: "2d",
    interval: "30m",
  });
  assert.deepEqual(benchmarkQueryWindow("1W", now, now), {
    range: "1mo",
    interval: "1d",
  });
  assert.deepEqual(benchmarkQueryWindow("ALL", now - 32 * 86_400_000, now), {
    range: "3mo",
    interval: "1d",
  });
});

test("1D benchmark ignores the previous day returned by the 2d query", async () => {
  const { buildJournalPerformanceSeries } = await loadModule();
  const yesterday = Date.UTC(2026, 7, 28, 18);
  const now = Date.UTC(2026, 7, 29, 12);
  const result = buildJournalPerformanceSeries({
    history: [],
    timeframe: "1D",
    oldestTradeMs: now,
    nowMs: now,
    benchmarkData: {
      btcPct: yahooChart([
        { at: yesterday, close: 100 },
        { at: Date.UTC(2026, 7, 29, 8), close: 110 },
      ]),
    },
  });

  assert.equal(result[7].btcPct, null);
  assert.equal(result[8].btcPct, 0);
  assert.equal(result[18].btcPct, 0);
});

test("journal charts keep automatic animation and every asset category tick", () => {
  const source = readFileSync(
    new URL(
      "../src/features/journal/components/journal-dashboard.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.doesNotMatch(source, /isAnimationActive=\{false\}/);
  const categoryAxis = source.match(
    /<XAxis\s+dataKey="assetType"[\s\S]*?\/>/,
  )?.[0];
  assert.ok(categoryAxis, "asset category X axis must exist");
  assert.match(categoryAxis, /interval=\{0\}/);
  assert.match(categoryAxis, /fontSize=\{11\}/);
});

test("journal cumulative hover dot renders above the benchmark dots", () => {
  const source = readFileSync(
    new URL(
      "../src/features/journal/components/journal-dashboard.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const chartStart = source.indexOf("<ComposedChart");
  const chartEnd = source.indexOf("</ComposedChart>", chartStart);
  const chartSource = source.slice(chartStart, chartEnd);

  assert.ok(chartSource.indexOf("{BENCHMARKS.map") >= 0);
  assert.ok(
    chartSource.indexOf("{BENCHMARKS.map") <
      chartSource.indexOf('dataKey="cumPct"'),
  );
});

test("journal legend puts cumulative after the asset benchmarks", () => {
  const source = readFileSync(
    new URL(
      "../src/features/journal/components/journal-dashboard.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const legendStart = source.indexOf("const equityLegendItems");
  const legendEnd = source.indexOf("const assetTypeLegendItems", legendStart);
  const legendSource = source.slice(legendStart, legendEnd);

  assert.ok(
    legendSource.indexOf("...BENCHMARKS.map") <
      legendSource.indexOf('name: t("journal.cumulative")'),
  );
});

test("journal dashboard renders only BTC and Gold asset benchmarks", () => {
  const source = readFileSync(
    new URL(
      "../src/features/journal/components/journal-dashboard.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /BENCHMARKS/);
  assert.match(source, /useQueries/);
  assert.match(source, /fetchYahooChart/);
  assert.match(source, /symbol: "BTC-USD"/);
  assert.match(source, /symbol: "GC=F"/);
  assert.doesNotMatch(source, /ihsgPct|sp500Pct|\^JKSE|\^GSPC/);
});

test("journal benchmark chart uses compact localized labels", () => {
  const id = JSON.parse(
    readFileSync(
      new URL("../src/assets/locales/id.json", import.meta.url),
      "utf8",
    ),
  );
  const en = JSON.parse(
    readFileSync(
      new URL("../src/assets/locales/en.json", import.meta.url),
      "utf8",
    ),
  );

  assert.equal(id.journal.chart_equity_benchmark, "Acuan Kinerja");
  assert.equal(en.journal.chart_equity_benchmark, "Performance Benchmark");
  assert.equal(id.journal.benchmark_btc, "Acuan (Bitcoin)");
  assert.equal(id.journal.benchmark_gold, "Acuan (Gold)");
  assert.equal(en.journal.benchmark_btc, "Benchmark (Bitcoin)");
  assert.equal(en.journal.benchmark_gold, "Benchmark (Gold)");
  assert.equal(id.journal.cumulative, "Kinerja Jurnal");
  assert.equal(en.journal.cumulative, "Journal Performance");
});
