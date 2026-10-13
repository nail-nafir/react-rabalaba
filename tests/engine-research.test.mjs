import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { aggregate, passesMetrics, windowTrades, pairedBlockBootstrap, selectCandidate, compare } from "../scripts/research-metrics.mjs";
import { journalTrades, claimHoldout, excursions, reconstructJournalEntries } from "../scripts/research-data.mjs";
import { dateBounds } from "../scripts/gate-compare.mjs";
import { parseArchiveCsv, buildCryptoSnapshots } from "../scripts/collect-research-flow.mjs";

let server;
async function load(path) {
  server ??= await createServer({ appType: "custom", configFile: "vite.config.ts", logLevel: "silent", server: { middlewareMode: true, watch: null } });
  return server.ssrLoadModule(path);
}
test.after(async () => { await server?.close(); });

function candles(count = 360) {
  return Array.from({ length: count }, (_, i) => {
    const close = 100 + 0.1 * i + Math.sin(i / 6) * 2;
    return { timestamp: 1735689600 + i * 3600, open: close - 0.1, high: close + 1, low: close - 1, close, volume: 1000 + i * 3 };
  });
}
const trade = (r, timestamp = 3600) => ({ grossR: r, r, decisionTimestamp: 0, decisionClosedAt: 3600, entryTimestamp: 3600, exitTimestamp: timestamp, exitReason: "initial_stop" });

test("research gate rejects the formerly accepted expectancy and PF regressions", () => {
  const baseline = { trades: 100, winRate: 70, expectancy: 0.3, profitFactor: 1.5, maxDrawdownR: 5 };
  assert.equal(passesMetrics({ trades: 60, winRate: 73, expectancy: 0.06, profitFactor: 1.2, maxDrawdownR: 4 }, baseline), false);
  const pass = { trades: 60, winRate: 73, expectancy: 0.36, profitFactor: 1.6, maxDrawdownR: 4 };
  assert.equal(passesMetrics(pass, baseline), true);
  assert.equal(passesMetrics({ ...pass, profitFactor: 1.4 }, baseline), false);
  assert.equal(passesMetrics({ ...pass, trades: 49 }, baseline), false);
  assert.equal(passesMetrics({ ...pass, maxDrawdownR: 6 }, baseline), false);
});

test("net win rate includes breakeven and costs are stressed per trade", () => {
  const rows = [trade(1), trade(0), { ...trade(-1), grossR: -0.8 }];
  assert.ok(Math.abs(aggregate(rows).winRate - 100 / 3) < 1e-12);
  assert.ok(Math.abs(aggregate(rows).expectancy) < 1e-12);
  assert.ok(aggregate(rows, { costMultiplier: 2 }).expectancy < 0);
  assert.equal(aggregate([trade(-1), trade(2)]).maxDrawdownR, aggregate([trade(2), trade(-1)]).maxDrawdownR);
});

test("common UTC folds purge cross-boundary and unfinished trades", () => {
  const { development, holdoutStart } = dateBounds("2025-01-01", "2026-01-01");
  assert.equal(development.at(-1)[1], holdoutStart);
  const rows = [
    { ...trade(1), decisionClosedAt: 80, entryTimestamp: 81, exitTimestamp: 84, exitClosedAt: 84 },
    { ...trade(1), decisionClosedAt: 84, entryTimestamp: 84, exitTimestamp: 92, exitClosedAt: 92 },
    { ...trade(1), decisionClosedAt: 80, entryTimestamp: 81, exitTimestamp: 84, exitClosedAt: 84, exitReason: "end_of_data" },
  ];
  assert.equal(windowTrades(rows, 70, 85).length, 1);
  assert.equal(windowTrades(rows, 85, 100).length, 0);
  assert.throws(() => dateBounds("2025-02-30", "2026-01-01"));
});

test("paired bootstrap keeps correlated assets and strategies in the same time block", () => {
  const rows = Array.from({ length: 16 }, (_, week) => [trade(2, week * 604800 + 3600), trade(-1, week * 604800 + 3600)]).flat();
  const result = pairedBlockBootstrap(rows, rows, 0, 16 * 604800, { iterations: 100 });
  assert.deepEqual(result.winRateDelta95, [0, 0]);
  assert.deepEqual(result.expectancyDelta95, [0, 0]);
  assert.equal(result.sufficient, false);
  assert.equal(selectCandidate({ a: { status: "unproven" } }), null);
  const passing = (expectancy) => ({ status: "passed", normal: { candidate: { expectancy }, baseline: { expectancy: 0.1 } } });
  assert.equal(selectCandidate({ a: passing(0.3), b: passing(0.4), ignored: { ...passing(1), status: "failed" } }), "b");
});

test("aggregate improvement cannot hide damage to one asset class", () => {
  const baseline = [], candidate = [];
  for (let week = 0; week < 14; week++) {
    for (const assetType of ["us-stock", "crypto"]) {
      for (let i = 0; i < 20; i++) {
        const timestamp = week * 604800 + 3600;
        baseline.push({ ...trade(i < 10 ? 1.5 : -1, timestamp), assetType });
        candidate.push({ ...trade(i < (assetType === "us-stock" ? 18 : 6) ? 1.5 : -1, timestamp), assetType });
      }
    }
  }
  assert.equal(passesMetrics(aggregate(candidate), aggregate(baseline)), true);
  const result = compare(candidate, baseline, 0, 14 * 604800, ["us-stock", "crypto"]);
  assert.equal(result.byClass.crypto.costs[0].nonDegrading, false);
  assert.equal(result.status, "failed");
});

test("a consumed holdout rejects another candidate and overlapping date ranges", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rabalaba-holdout-"));
  try {
    const ledger = join(dir, "ledger.json");
    await claimHoldout(ledger, { start: 100, end: 200, candidate: "extension" });
    await assert.rejects(claimHoldout(ledger, { start: 150, end: 250, candidate: "setup-room" }), /already opened/);
    await claimHoldout(ledger, { start: 200, end: 300, candidate: "extension" });
  } finally { await rm(dir, { recursive: true }); }
});

test("session window and research anchors match the exact production input", async () => {
  const { buildDecisionSeries } = await load("/src/core/engine/backtest.ts");
  const { computeSignal } = await load("/src/core/engine/signals.ts");
  const { buildSignalSeriesFromCandles, deriveCandleTrendState, resampleCandles, deriveTrendAnchors } = await load("/src/core/market/candles.ts");
  const bars = [];
  for (let day = 0; day < 110; day++) {
    const at = 1735689600 + day * 86400;
    if ([0, 6].includes(new Date(at * 1000).getUTCDay())) continue;
    for (let hour = 0; hour < 7; hour++) {
      const price = 100 + bars.length / 10;
      bars.push({ timestamp: at + (14 + hour) * 3600, open: price, high: price + 1, low: price - 1, close: price + 0.5, volume: 1000 });
    }
  }
  const decisions = buildDecisionSeries(bars, { assetType: "us-stock", lookbackSessions: 60, includeResearchFeatures: true });
  const last = decisions.at(-1);
  const input = bars.filter((c) => c.timestamp >= last.research.windowStart && c.timestamp <= last.timestamp);
  assert.equal(new Set(input.map((c) => Math.floor(c.timestamp / 86400))).size, 60);
  assert.ok(last.timestamp - input[0].timestamp > 60 * 86400);
  const anchors = deriveTrendAnchors(input, 4);
  const htf = deriveCandleTrendState(resampleCandles(input, 4, { includeTrailingPartial: false }));
  assert.deepEqual(last.outlook, computeSignal({ ...buildSignalSeriesFromCandles(input), assetType: "us-stock", timeframe: "swing", higherTimeframeTrend: htf.trend, higherTimeframeReady: htf.ready, ...anchors }));
  assert.equal(last.research.ema50Daily, anchors.dailyEma50);
  const calendarWindow = buildDecisionSeries(bars, { assetType: "us-stock", lookbackSeconds: 60 * 86400, includeResearchFeatures: true }).at(-1);
  assert.equal(calendarWindow.research.ema50Daily, undefined);
  assert.equal(calendarWindow.research.ema2004h, undefined);
});

test("forex session dates follow the exchange timezone across a UTC midnight", async () => {
  const { sessionStartIndices } = await load("/src/core/engine/research.ts");
  const bars = candles(2).map((c, i) => ({ ...c, timestamp: Date.parse("2026-07-19T23:00:00Z") / 1000 + i * 3600 }));
  assert.deepEqual(sessionStartIndices(bars), [0, 1]);
  assert.deepEqual(sessionStartIndices(bars, "Europe/London"), [0]);
});

test("future candles, current-day volume and missing flow cannot rewrite past decisions", async () => {
  const { buildDecisionSeries } = await load("/src/core/engine/backtest.ts");
  const { equityFlow } = await load("/src/core/engine/research.ts");
  const input = candles(1000);
  const options = { assetType: "us-stock", lookbackSessions: 60, includeResearchFeatures: true };
  const original = buildDecisionSeries(input, options);
  const changed = input.map((c, i) => i > 700 ? { ...c, close: c.close * 2, high: c.high * 3, volume: 1e8 } : c);
  assert.deepEqual(buildDecisionSeries(changed, options).filter((d) => d.barIndex <= 700), original.filter((d) => d.barIndex <= 700));
  const today = Math.floor(input.at(-1).timestamp / 86400);
  assert.deepEqual(equityFlow(input, "us-stock"), equityFlow(input.map((c) => Math.floor(c.timestamp / 86400) === today ? { ...c, volume: 1e8 } : c), "us-stock"));
  const noFlow = { ...options, researchFlow: () => null };
  assert.deepEqual(buildDecisionSeries(input, noFlow), buildDecisionSeries(input, { ...noFlow, volumeReplacement: 1 }));
});

test("flow validation rejects stale, future, wrong-contract and mismatched-period data", async () => {
  const { flowAtDecision, cryptoFlow } = await load("/src/core/engine/research.ts");
  const at = 1736000000;
  const flow = { source: "binance-usdm", score: 0.5, observedAt: at, availableAt: at + 60, expiresAt: at + 3600 };
  assert.equal(flowAtDecision(flow, at), null);
  assert.equal(flowAtDecision(flow, at + 3601), null);
  assert.equal(flowAtDecision({ ...flow, score: NaN }, at + 100), null);
  const snapshot = { symbol: "BTC-USD", contract: "BTCUSDT", venue: "binance-usdm", startAt: at - 86400, endAt: at, availableAt: at + 60, openInterestStart: 100, openInterestEnd: 110, priceStart: 100, priceEnd: 105, fundingAt: at, fundingIntervalHours: 4, fundingRate: 0.0003, longShortRatio: 1, longShortAt: at };
  assert.equal(cryptoFlow(snapshot, "BTC-USD", "BTCUSDT", at + 100).score, 0); // +OI .4, normalized 8h funding -.4
  assert.equal(cryptoFlow({ ...snapshot, endAt: at + 1 }, "BTC-USD", "BTCUSDT", at + 100), null);
  assert.equal(cryptoFlow(snapshot, "ETH-USD", "ETHUSDT", at + 100), null);
  assert.equal(cryptoFlow(snapshot, "BTC-USD", "BTCUSDT", at + 3601), null);
});

test("archives align 24h OI and same-venue prices, with delayed availability and actual funding interval", () => {
  const at = Date.parse("2026-01-02T00:00:00Z") / 1000;
  const metrics = parseArchiveCsv("create_time,symbol,sum_open_interest,count_long_short_ratio\n2026-01-02 00:00:00,BTCUSDT,110,2\n2026-01-01 00:00:00,BTCUSDT,100,1");
  const prices = [{ open_time: (at - 86400) * 1000, open: 100 }, { open_time: at * 1000, open: 105 }];
  const funding = [{ calc_time: at * 1000, funding_interval_hours: 4, last_funding_rate: 0.0002 }];
  const snapshots = buildCryptoSnapshots("BTC-USD", "BTCUSDT", metrics, prices, funding, at, at + 7200);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].availableAt, at + 3600);
  assert.equal(snapshots[0].endAt - snapshots[0].startAt, 86400);
  assert.equal(snapshots[0].fundingIntervalHours, 4);
  assert.equal(snapshots[0].priceStart, 100);
  assert.throws(() => buildCryptoSnapshots("BTC-USD", "ETHUSDT", metrics, prices, funding, at, at + 3600), /Invalid/);
  assert.throws(() => buildCryptoSnapshots("BTC-USD", "BTCUSDT", [...metrics, metrics[0]], prices, funding, at, at + 3600), /duplicate/);
  assert.throws(() => parseArchiveCsv("a,b\n1,2,3"), /Invalid/);
});

test("research scoring replaces volume before direction and retains the trend gate", async () => {
  const { computeSignal } = await load("/src/core/engine/signals.ts");
  const { buildSignalSeriesFromCandles } = await load("/src/core/market/candles.ts");
  for (const direction of [1, -1]) {
    const bars = candles().map((c, i) => ({ ...c, close: 200 + direction * i * 0.2, high: 202 + direction * i * 0.2, low: 198 + direction * i * 0.2 }));
    const input = { ...buildSignalSeriesFromCandles(bars), assetType: "crypto" };
    const base = computeSignal(input);
    assert.deepEqual(computeSignal(input, { volumeScore: NaN, volumeReplacement: 1 }), base);
    const score = -direction;
    const half = computeSignal(input, { volumeScore: score, volumeReplacement: 0.5 });
    const full = computeSignal(input, { volumeScore: score, volumeReplacement: 1 });
    assert.equal(full.categoryScores.volume, score);
    assert.equal(half.categoryScores.volume, (base.categoryScores.volume + score) / 2);
    assert.notEqual(full.directionScore, base.directionScore);
    const gated = computeSignal({ ...input, higherTimeframeEma200: direction > 0 ? 1e6 : 0.1 }, { volumeScore: direction, volumeReplacement: 1 });
    assert.equal(gated.signal, "neutral");
  }
  const thresholdBars = Array.from({ length: 320 }, (_, i) => {
    const close = 100 + i * 0.06 + Math.sin(i / 6) * 2;
    return { open: close, close, high: close + 1, low: close - 1, volume: 1000 + i * 3, timestamp: 1000 + i * 3600 };
  });
  const input = { ...buildSignalSeriesFromCandles(thresholdBars), assetType: "crypto" };
  assert.equal(computeSignal(input, { volumeScore: -1, volumeReplacement: 1 }).signal, "neutral");
  assert.equal(computeSignal(input, { volumeScore: 1, volumeReplacement: 1 }).signal, "long");
});

test("entry filters handle narrow room, extension, unknown structure and both directions", async () => {
  const { entryDiagnostics, passesEntryExperiment } = await load("/src/core/engine/research.ts");
  const { computeTradingPlan } = await load("/src/core/engine/trading-plan.ts");
  const outlook = { signal: "long", indicators: { atr: 1, ema20: 97, support: 95, resistance: 101, recentSwingLow: 95, recentSwingHigh: 101, adx: 20 } };
  const plan = computeTradingPlan(outlook, 100, "us-stock");
  assert.equal(plan.stopLoss, 94.75);
  assert.ok(entryDiagnostics(outlook, plan).structureRoomR < 0.2);
  assert.equal(passesEntryExperiment("setup-room", outlook, plan), false);
  assert.equal(passesEntryExperiment("extension", outlook, plan), false);
  assert.equal(passesEntryExperiment("flow-filter", outlook, plan, { score: -0.25, source: "equity-ohlcv" }), false);
  assert.equal(passesEntryExperiment("flow-filter", { ...outlook, signal: "short" }, plan, { score: 0.4, source: "binance-usdm" }), false);
  assert.equal(passesEntryExperiment("flow-filter", outlook, plan, null), true);
  assert.equal(passesEntryExperiment("setup-room", { ...outlook, indicators: { ...outlook.indicators, resistance: 90, recentSwingHigh: 90 } }, plan), true);
});

test("scale-out replay equals Journal on same-bar stop ratchet, for long and short", async () => {
  const { replayDecisionSeries } = await load("/src/core/engine/backtest.ts");
  const { evaluateFollow, computePnl } = await load("/src/core/trade/follow-trade-model.ts");
  for (const signal of ["long", "short"]) {
    const reflect = (p) => signal === "long" ? p : 200 - p;
    const bar = { timestamp: 3600, open: 100, high: signal === "long" ? 116 : 101, low: signal === "long" ? 99 : 84, close: reflect(108), volume: 1000 };
    const input = [{ ...bar, timestamp: 0 }, bar, { ...bar, timestamp: 7200 }];
    const outlook = { signal, regime: "trending", tier: "B", indicators: { atr: 4, support: 0, resistance: 0, recentSwingHigh: 0, recentSwingLow: 0, adx: 0 } };
    const decisions = [{ barIndex: 0, timestamp: 0, outlook, previousSignal: "neutral" }];
    const followed = { signal, entryPrice: 100, stopLoss: reflect(94), takeProfits: [109, 115, 121].map(reflect), highestTpReached: 0, engineVersion: "engine-v7" };
    const outcome = evaluateFollow(followed, bar.close, [bar]);
    const result = replayDecisionSeries(input, decisions, { assetType: "crypto", exitMode: "scaleOut" }).trades[0];
    assert.equal(result.exitReason, outcome.exitReason);
    assert.equal(result.exitTimestamp, outcome.closedAt);
    const gross = computePnl({ ...followed, highestTpReached: outcome.highestTpReached }, outcome.closePrice).r;
    assert.ok(Math.abs(result.grossR - gross) < 1e-12);
    assert.ok(Math.abs(gross - 1.8) < 1e-12);
  }
});

test("journal audit uses v7 scale-out, validates rows and reports unavailable diagnostics", async () => {
  const { rowToFollowedTrade } = await load("/src/core/trade/journal-mapper.ts");
  const { computePnl, ENTRY_BAR_TOLERANCE_MS } = await load("/src/core/trade/follow-trade-model.ts");
  const row = { id: "one", symbol: "AAPL", asset_type: "us-stock", signal: "long", entry_price: 100, stop_loss: 94, close_price: 109, take_profits: [109, 115, 121], highest_tp_reached: 2, engine_version: "engine-v7", opened_at: "2026-01-01T01:00:00Z", closed_at: "2026-01-01T02:00:00Z", created_at: "2026-01-01T01:05:00Z", decision_candle_closed_at: "2026-01-01T01:00:00Z", status: "sl" };
  const result = journalTrades([row, { ...row, id: "bad", close_price: null }], { rowToFollowedTrade, computePnl, costs: { default: { fee: 0.0002, slippage: 0.0003 } } });
  assert.equal(result.rejected.length, 1);
  assert.ok(Math.abs(result.trades[0].grossR - 1.8) < 1e-12);
  assert.ok(result.trades[0].r < result.trades[0].grossR);
  assert.equal(result.trades[0].diagnostics.publicationLagSeconds, 300);
  assert.equal(result.trades[0].diagnostics.extensionAtr, null);
  assert.deepEqual(excursions(result.trades[0], []), { mfeRUpperBound: null, maeRUpperBound: null });
  const containingBar = journalTrades([{ ...row, opened_at: "2026-01-01T02:00:05Z" }], { rowToFollowedTrade, computePnl, costs: { default: { fee: 0.0002, slippage: 0.0003 } }, entryBarToleranceMs: ENTRY_BAR_TOLERANCE_MS });
  assert.equal(containingBar.rejected.length, 0);
  assert.equal(containingBar.trades[0].exitTimestamp, containingBar.trades[0].entryTimestamp);
});

test("journal entry reconstruction uses only the recorded decision's history", async () => {
  const { sessionStartIndices, entryDiagnostics } = await load("/src/core/engine/research.ts");
  const { adaptYahooChart } = await load("/src/services/adapters/yahoo-adapter.ts");
  const input = candles(1500);
  const row = { engineVersion: "engine-v7", direction: "long", decisionTimestamp: input[1470].timestamp, entryTimestamp: input[1471].timestamp + 5,
    exitTimestamp: input[1474].timestamp, entryPrice: input[1471].open, initialStop: input[1471].open - 3, diagnostics: {} };
  const raw = { meta: { symbol: "AAPL", exchangeTimezoneName: "UTC" } };
  const one = structuredClone(row), two = structuredClone(row);
  const deps = { sessionStartIndices, entryDiagnostics, adaptYahooChart };
  reconstructJournalEntries([one], raw, input, deps);
  reconstructJournalEntries([two], raw, input.map((c, i) => i > 1474 ? { ...c, close: 1000, high: 1001, volume: 1e9 } : c), deps);
  assert.equal(one.diagnostics.entrySource, "reconstructed-current-history");
  assert.ok(Number.isFinite(one.diagnostics.extensionAtr));
  assert.ok(Number.isFinite(one.diagnostics.mfeRUpperBound));
  assert.deepEqual(one.diagnostics, two.diagnostics);
});
