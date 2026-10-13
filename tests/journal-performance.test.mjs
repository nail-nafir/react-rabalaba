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

async function loadTableModule() {
  if (!server) {
    server = await createServer({
      appType: "custom",
      configFile: "vite.config.ts",
      logLevel: "silent",
      server: { middlewareMode: true, watch: null },
    });
  }
  return server.ssrLoadModule(
    "/src/features/follow-trade/model/live-progress.ts",
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

test("live journal progress stays isolated for duplicate symbols", async () => {
  const { buildLiveProgressByTradeId } = await loadTableModule();
  const followedAt = Date.UTC(2026, 7, 29);
  const trade = (id, takeProfit) => ({
    id,
    symbol: "DUP-USD",
    name: id,
    assetType: "crypto",
    signal: "long",
    timeframe: "swing",
    entryPrice: 100,
    stopLoss: 90,
    takeProfits: [takeProfit],
    riskRewardRatio: 1,
    strengthAtEntry: 80,
    followedAt,
    highestTpReached: 0,
    status: "open",
  });
  const result = buildLiveProgressByTradeId(
    [trade("trade-reached", 105), trade("trade-pending", 120)],
    [
      {
        symbol: "DUP-USD",
        price: 110,
        quoteIndicators: {
          open: [100],
          high: [110],
          low: [99],
          close: [110],
          volume: [1],
        },
        timestamps: [followedAt / 1000],
      },
    ],
  );

  assert.equal(result["trade-reached"].tpReached, 1);
  assert.equal(result["trade-pending"].tpReached, 0);
});

test("journal table deduplicates live symbols and debounces search", () => {
  const source = readFileSync(
    new URL(
      "../src/features/follow-trade/components/follow-history-table.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /\[\.\.\.new Set\(openTrades\.map\(\(tr\) => tr\.symbol\)\)\]/);
  assert.match(source, /useDebounce\(search, 100\)/);
  assert.match(source, /progressByTradeId\[tr\.id\]/);
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
  const { buildJournalPerformanceSeries, journalWindow } = await loadModule();
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
    span: journalWindow("ALL", aug1, aug4),
    nowMs: aug4,
  });

  assert.deepEqual(result.map(({ cumPct }) => cumPct), [0, 10, 20, 0]);
  assert.equal(result[2].dayPctWin, 10);
  assert.equal(result[2].dayPctLoss, null);
  assert.equal(result[3].dayPctWin, null);
  assert.equal(result[3].dayPctLoss, -20);
});

test("BTC and Gold benchmarks normalize from their first available close", async () => {
  const { buildJournalPerformanceSeries, journalWindow } = await loadModule();
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
    span: journalWindow("ALL", aug1, aug4),
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
  const { buildJournalPerformanceSeries, journalWindow } = await loadModule();
  // WIB = UTC+7: yesterday 05:00, today 08:00 and now (today 12:00).
  const yesterday = Date.UTC(2026, 7, 27, 22);
  const now = Date.UTC(2026, 7, 29, 5);
  const result = buildJournalPerformanceSeries({
    history: [],
    timeframe: "1D",
    span: journalWindow("1D", Date.UTC(2026, 6, 31, 17), now),
    nowMs: now,
    benchmarkData: {
      btcPct: yahooChart([
        { at: yesterday, close: 100 },
        { at: Date.UTC(2026, 7, 29, 1), close: 110 },
      ]),
    },
  });

  assert.equal(result.length, 24);
  assert.equal(result[5].btcPct, null);
  assert.equal(result[8].btcPct, 0);
  assert.equal(result[12].btcPct, 0);
  assert.equal(result[13].btcPct, null);
  assert.equal(result[13].cumPct, null);
});

// Saturday 3 Oct 2026 09:03 WIB, journal period opened on 1 Oct (a Thursday).
const OCT3_NOW = Date.UTC(2026, 9, 3, 2, 3);
const OCT1_WIB = Date.UTC(2026, 8, 30, 17);
const wib = (month, day, hour = 0) => Date.UTC(2026, month, day, hour - 7);

test("tabs are WIB calendar windows that never reach before the journal period", async () => {
  const { journalWindow } = await loadModule();

  assert.deepEqual(journalWindow("1D", OCT1_WIB, OCT3_NOW), {
    startMs: wib(9, 3),
    endMs: wib(9, 4),
    dataStartMs: wib(9, 3),
  });
  assert.deepEqual(journalWindow("1W", OCT1_WIB, OCT3_NOW), {
    startMs: wib(8, 28),
    endMs: wib(9, 5),
    dataStartMs: OCT1_WIB,
  });
  assert.deepEqual(journalWindow("1M", OCT1_WIB, OCT3_NOW), {
    startMs: OCT1_WIB,
    endMs: wib(10, 1),
    dataStartMs: OCT1_WIB,
  });
  assert.deepEqual(journalWindow("ALL", OCT1_WIB, OCT3_NOW), {
    startMs: OCT1_WIB,
    endMs: OCT3_NOW,
    dataStartMs: OCT1_WIB,
  });
  // Before the period resolves (no trades loaded yet): empty ALL span, calendar tabs unclipped.
  assert.equal(journalWindow("ALL", null, OCT3_NOW).startMs, OCT3_NOW);
  assert.equal(journalWindow("1W", null, OCT3_NOW).dataStartMs, wib(8, 28));
});

test("week and month charts fill from the period start and leave days not reached yet empty", async () => {
  const { buildJournalPerformanceSeries, journalWindow } = await loadModule();
  const history = [
    closedTrade({ id: "oct1", assetType: "crypto", closePrice: 110, followedAt: wib(9, 1, 10) }),
    closedTrade({ id: "oct2", assetType: "crypto", closePrice: 95, followedAt: wib(9, 2, 15) }),
    closedTrade({ id: "oct3", assetType: "crypto", closePrice: 102, followedAt: wib(9, 3, 8) }),
  ];
  const benchmarkData = {
    btcPct: yahooChart([
      { at: Date.UTC(2026, 8, 28), close: 80 },
      { at: Date.UTC(2026, 9, 1), close: 100 },
      { at: Date.UTC(2026, 9, 2), close: 110 },
      { at: Date.UTC(2026, 9, 3), close: 95 },
    ]),
  };
  const series = (timeframe) => buildJournalPerformanceSeries({
    history,
    timeframe,
    span: journalWindow(timeframe, OCT1_WIB, OCT3_NOW),
    nowMs: OCT3_NOW,
    benchmarkData,
  });

  const week = series("1W");
  assert.deepEqual(week.map(({ date }) => date), [
    "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
  ]);
  assert.deepEqual(week.map(({ cumPct }) => cumPct), [null, null, null, 10, 5, 7, null]);
  assert.deepEqual(week.map(({ btcPct }) => btcPct), [null, null, null, 0, 10, -5, null]);
  assert.deepEqual(week.map(({ dayPctLoss }) => dayPctLoss), [null, null, null, null, -5, null, null]);

  const month = series("1M");
  assert.equal(month.length, 31);
  assert.equal(month[0].date, "2026-10-01");
  assert.deepEqual(month.slice(0, 4).map(({ cumPct }) => cumPct), [10, 5, 7, null]);
  assert.ok(month.slice(3).every(({ cumPct, dayPctWin, btcPct }) => cumPct === null && dayPctWin === null && btcPct === null));
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
