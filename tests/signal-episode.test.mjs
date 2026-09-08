import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

let server, episode, journal, tracker, alerts, adapter, signals, mapper;
test.before(async () => {
  server = await createServer({
    appType: "custom",
    configFile: "vite.config.ts",
    logLevel: "silent",
    server: { middlewareMode: true, watch: null },
  });
  [episode, journal, tracker, alerts, adapter, signals, mapper] =
    await Promise.all(
      [
        "/src/core/automation/signal-episode.ts",
        "/src/core/automation/auto-journal-core.ts",
        "/src/core/trade/follow-trade-model.ts",
        "/src/core/automation/alerts.ts",
        "/src/services/adapters/yahoo-adapter.ts",
        "/src/core/engine/signals.ts",
        "/src/core/trade/journal-mapper.ts",
      ].map((path) => server.ssrLoadModule(path)),
    );
});
test.after(async () => {
  await server?.close();
});

const NOW = Date.UTC(2026, 8, 8, 1, 0);
const HOUR = 3_600_000;
const initialPlan = {
  entry: 50,
  stopLoss: 20,
  takeProfit1: 100,
  takeProfit2: 200,
  takeProfit3: 300,
  riskRewardRatio: 50 / 30,
};

function rawAsset(signal = "long", overrides = {}) {
  return {
    symbol: "BTC-USD",
    name: "Bitcoin",
    assetType: "crypto",
    timeframe: "swing",
    price: 50,
    volume: 1000,
    changePercent: 0,
    quoteTime: NOW,
    decisionCandleOpenAt: NOW - HOUR,
    decisionCandleClosedAt: NOW,
    executionCandleOpenAt: NOW,
    outlook: {
      ...signals.createUnavailableSignal(),
      signal,
      strength: 71,
      tier: "B",
    },
    tradingPlan: signal === "neutral" ? null : { ...initialPlan },
    ...overrides,
  };
}

function activeState() {
  return journal.runAutoJournal([rawAsset()], [], { now: NOW })
    .signalStateUpdates[0];
}

function asRow(insert) {
  return {
    ...insert,
    id: "trade-1",
    created_at: insert.opened_at,
    updated_at: insert.opened_at,
    reversed: false,
  };
}

test("NBIS/EQPT session-close candidates stay pending with no journal/Discord event", (t) => {
  t.mock.method(Date, "now", () => NOW);
  const sessionEnd = Date.UTC(2026, 8, 4, 20) / 1000;
  for (const [symbol, price] of [
    ["NBIS", 226.39],
    ["EQPT", 19.55],
  ]) {
    const closes = Array.from(
      { length: 130 },
      (_, i) => price * (0.5 + i / 258),
    );
    const timestamps = closes.map(
      (_, i) => sessionEnd - 1800 - (129 - i) * 3600,
    );
    // Yahoo's close-time pseudo bar is not an executable next-session candle.
    timestamps.push(sessionEnd);
    closes.push(price);
    const asset = adapter.adaptYahooChart({
      meta: {
        symbol,
        regularMarketPrice: price,
        regularMarketTime: sessionEnd,
        range: "60d",
        dataGranularity: "1h",
        instrumentType: "EQUITY",
        currentTradingPeriod: { regular: { end: sessionEnd } },
      },
      timestamp: timestamps,
      indicators: {
        quote: [
          {
            open: closes.map((v) => v * 0.999),
            high: closes.map((v) => v * 1.001),
            low: closes.map((v) => v * 0.998),
            close: closes,
            volume: closes.map(() => 1000),
          },
        ],
      },
    });
    assert.equal(asset.outlook.signal, "long");
    assert.equal(asset.tradingPlan, null);
    assert.equal(asset.executionCandleOpenAt, undefined);
    const run = journal.runAutoJournal([asset], [], { now: NOW });
    const shown = episode.applySignalEpisode(asset, run.signalStateUpdates[0]);
    assert.equal(shown.signalStatus, "pending", symbol);
    assert.equal(shown.outlook.signal, "neutral");
    assert.equal(shown.tradingPlan, null);
    assert.equal(run.inserts.length, 0);
    assert.deepEqual(alerts.buildAutoJournalAlerts(run), []);
    assert.equal(
      asset.outlook.signal,
      "long",
      "UI must not rewrite the raw engine input",
    );
  }
});

test("even a fresh candidate with a setup is unpublished until a recorded episode exists", () => {
  const asset = rawAsset();
  for (const state of [undefined, { ...activeState(), active_signal: null }]) {
    const shown = episode.applySignalEpisode(asset, state);
    assert.equal(shown.signalStatus, "pending");
    assert.equal(shown.outlook.signal, "neutral");
    assert.equal(shown.tradingPlan, null);
  }
  assert.equal(
    journal.runAutoJournal([asset], [], { now: NOW }).inserts.length,
    1,
  );
});

test("saved entry/TP/SL survive price changes, raw reversals, and raw no-trade filters", () => {
  const state = activeState();
  const originalState = structuredClone(state);
  for (const signal of ["long", "neutral", "short"]) {
    const asset = rawAsset(signal, {
      price: 80,
      tradingPlan: {
        entry: 80,
        stopLoss: 50,
        takeProfit1: 150,
        takeProfit2: 250,
        takeProfit3: 350,
        riskRewardRatio: 70 / 30,
      },
    });
    asset.outlook.suppressed = signal === "neutral";
    const originalAsset = structuredClone(asset);
    const shown = episode.applySignalEpisode(asset, state);
    assert.equal(shown.signalStatus, "active");
    assert.equal(shown.outlook.signal, "long");
    assert.equal(shown.outlook.suppressed, false);
    assert.equal(shown.price, 80);
    assert.deepEqual(shown.tradingPlan, initialPlan);
    assert.deepEqual(asset, originalAsset);
  }
  assert.deepEqual(state, originalState);
});

test("missing or malformed saved setups fail closed without using the live plan", () => {
  const state = activeState();
  for (const patch of [
    { entry_price: null },
    { entry_price: NaN },
    { entry_price: Infinity },
    { stop_loss: 0 },
    { stop_loss: 80 },
    { risk_reward_ratio: null },
    { risk_reward_ratio: -1 },
    { take_profits: null },
    { take_profits: [] },
    { take_profits: [100] },
    { take_profits: [100, NaN] },
    { take_profits: [100, 90] },
    { take_profits: [40, 200] },
    { take_profits: [100, 200, 300, 400] },
    { active_signal: "invalid" },
  ]) {
    const shown = episode.applySignalEpisode(rawAsset(), {
      ...state,
      ...patch,
    });
    assert.equal(shown.signalStatus, "unavailable", JSON.stringify(patch));
    assert.equal(shown.outlook.signal, "neutral");
    assert.equal(shown.tradingPlan, null);
  }
  assert.equal(
    episode.applySignalEpisode(rawAsset(), {
      ...state,
      take_profits: [100, 200],
    }).signalStatus,
    "active",
  );
});

test("a failed state read cannot publish a cached episode; mismatched keys also fail closed", () => {
  for (const state of [undefined, activeState()]) {
    const shown = episode.applySignalEpisode(rawAsset(), state, false);
    assert.equal(shown.signalStatus, "unavailable");
    assert.equal(shown.outlook.signal, "neutral");
    assert.equal(shown.tradingPlan, null);
  }
  for (const patch of [{ symbol: "EQPT" }, { timeframe: "scalp" }]) {
    assert.equal(
      episode.applySignalEpisode(rawAsset(), { ...activeState(), ...patch })
        .signalStatus,
      "unavailable",
    );
  }
  assert.equal(
    episode.applySignalEpisode(rawAsset(), {
      ...activeState(),
      timeframe: "1mo",
    }).signalStatus,
    "active",
    "legacy swing labels still resolve",
  );
});

test("journal, terminal, and Discord share one snapshot; exit blocks repeats until neutral", () => {
  const emitted = journal.runAutoJournal([rawAsset()], [], { now: NOW });
  const row = asRow(emitted.inserts[0]);
  const followed = mapper.rowToFollowedTrade(row);
  const shown = episode.applySignalEpisode(
    rawAsset("long", { price: 80 }),
    emitted.signalStateUpdates[0],
  );
  const alert = alerts.buildAutoJournalAlerts(emitted)[0];
  assert.equal(alert.kind, "new_long");
  assert.equal(alert.entry, followed.entryPrice);
  assert.equal(alert.entry, shown.tradingPlan.entry);
  assert.equal(alert.stopLoss, shown.tradingPlan.stopLoss);
  assert.deepEqual(alert.takeProfits, followed.takeProfits);
  assert.deepEqual(alert.takeProfits, [
    shown.tradingPlan.takeProfit1,
    shown.tradingPlan.takeProfit2,
    shown.tradingPlan.takeProfit3,
  ]);

  const asset = rawAsset("long", {
    price: 290,
    quoteTime: NOW + HOUR,
    decisionCandleOpenAt: NOW,
    decisionCandleClosedAt: NOW + HOUR,
    executionCandleOpenAt: NOW + HOUR,
    timestamps: [NOW / 1000],
    quoteIndicators: {
      open: [50],
      high: [300],
      low: [40],
      close: [290],
      volume: [1000],
    },
  });
  const closed = journal.runAutoJournal([asset], [row], {
    now: NOW + HOUR,
    signalStates: emitted.signalStateUpdates,
  });
  assert.equal(closed.closures[0].exit_reason, "final_take_profit");
  assert.equal(closed.closures[0].close_price, 300);
  assert.equal(closed.inserts.length, 0);
  assert.equal(
    episode.applySignalEpisode(asset, closed.signalStateUpdates[0])
      .signalStatus,
    "blocked",
  );
  assert.equal(
    journal.runAutoJournal([asset], [], {
      now: NOW + HOUR,
      signalStates: closed.signalStateUpdates,
    }).inserts.length,
    0,
  );

  const neutral = rawAsset("neutral", { quoteTime: NOW + 2 * HOUR });
  const rearmed = journal.runAutoJournal([neutral], [], {
    now: NOW + 2 * HOUR,
    signalStates: closed.signalStateUpdates,
  });
  assert.equal(
    episode.applySignalEpisode(neutral, rearmed.signalStateUpdates[0])
      .signalStatus,
    "neutral",
  );
  const next = rawAsset("long", {
    quoteTime: NOW + 3 * HOUR,
    decisionCandleOpenAt: NOW + 2 * HOUR,
    decisionCandleClosedAt: NOW + 3 * HOUR,
    executionCandleOpenAt: NOW + 3 * HOUR,
  });
  const reopened = journal.runAutoJournal([next], [], {
    now: NOW + 3 * HOUR,
    signalStates: rearmed.signalStateUpdates,
  });
  assert.equal(reopened.inserts.length, 1);
  assert.equal(
    episode.applySignalEpisode(next, reopened.signalStateUpdates[0])
      .signalStatus,
    "active",
  );
});

test("reversal publishes the new short only with its new recorded snapshot", () => {
  const emitted = journal.runAutoJournal([rawAsset()], [], { now: NOW });
  const shortPlan = {
    entry: 80,
    stopLoss: 90,
    takeProfit1: 70,
    takeProfit2: 60,
    takeProfit3: 50,
    riskRewardRatio: 1,
  };
  const asset = rawAsset("short", {
    price: 80,
    tradingPlan: shortPlan,
    quoteTime: NOW + HOUR,
    decisionCandleOpenAt: NOW,
    decisionCandleClosedAt: NOW + HOUR,
    executionCandleOpenAt: NOW + HOUR,
    timestamps: [NOW / 1000],
    quoteIndicators: {
      open: [50],
      high: [82],
      low: [40],
      close: [80],
      volume: [1000],
    },
  });
  assert.equal(
    episode.applySignalEpisode(asset, emitted.signalStateUpdates[0]).outlook
      .signal,
    "long",
  );
  const flipped = journal.runAutoJournal([asset], [asRow(emitted.inserts[0])], {
    now: NOW + HOUR,
    signalStates: emitted.signalStateUpdates,
  });
  assert.equal(flipped.closures[0].exit_reason, "reversal");
  assert.equal(flipped.inserts[0].signal, "short");
  const shown = episode.applySignalEpisode(
    asset,
    flipped.signalStateUpdates[0],
  );
  assert.equal(shown.signalStatus, "active");
  assert.equal(shown.outlook.signal, "short");
  assert.deepEqual(shown.tradingPlan, shortPlan);
  assert.deepEqual(
    alerts.buildAutoJournalAlerts(flipped).map((a) => a.kind),
    ["new_short", "reversed"],
  );
});

test("the documented 50/100/200/300 example uses progressive stops without changing the original SL", () => {
  const trade = mapper.rowToFollowedTrade(
    asRow(journal.runAutoJournal([rawAsset()], [], { now: NOW }).inserts[0]),
  );
  const candle = (open, high, low, close, timestamp) => ({
    open,
    high,
    low,
    close,
    timestamp,
    isClosed: true,
  });
  const tp1 = candle(50, 100, 40, 90, NOW);
  const tp2 = candle(90, 200, 70, 180, NOW + HOUR);
  for (const [candles, price, reason] of [
    [[tp1, candle(90, 95, 45, 60, NOW + HOUR)], 50, "breakeven_stop"],
    [
      [tp1, tp2, candle(180, 190, 95, 110, NOW + 2 * HOUR)],
      100,
      "progressive_stop",
    ],
    [
      [tp1, tp2, candle(180, 300, 150, 290, NOW + 2 * HOUR)],
      300,
      "final_take_profit",
    ],
  ]) {
    const result = tracker.evaluateFollow(trade, candles.at(-1).close, candles);
    assert.equal(result.closePrice, price);
    assert.equal(result.exitReason, reason);
    assert.equal(trade.stopLoss, 20);
  }
});
