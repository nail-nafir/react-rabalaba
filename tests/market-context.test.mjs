import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

let server;

async function loadAdapter() {
  if (!server) {
    server = await createServer({
      appType: "custom",
      configFile: "vite.config.ts",
      logLevel: "silent",
      server: { middlewareMode: true, watch: null },
    });
  }
  return server.ssrLoadModule("/src/services/adapters/market-context.ts");
}

test.after(async () => {
  try {
    if (server) await server.close();
  } catch {
    // Vite can reject while its SSR server tears down after all assertions.
  }
});

const DAY_SECONDS = 86_400;
const DAY_MS = DAY_SECONDS * 1000;
const NOW_MS = Date.UTC(2026, 6, 13, 12);
const T0_SECONDS = Date.UTC(2025, 0, 1) / 1000;

function makeAsset({
  symbol,
  name = symbol,
  price = 100,
  changePercent = 1,
  quoteTime = NOW_MS - 60_000,
  quoteIndicators,
}) {
  return {
    symbol,
    name,
    assetType: "us-stock",
    price,
    changePercent,
    volume: 1_000,
    outlook: null,
    tradingPlan: null,
    timeframe: "1mo",
    quoteTime,
    timestamps: [T0_SECONDS],
    quoteIndicators: quoteIndicators ?? {
      open: [99],
      high: [102],
      low: [98],
      close: [price],
      volume: [1_000],
    },
  };
}

function makeResult(candles, metaOverrides = {}) {
  return {
    meta: {
      symbol: "^JKSE",
      regularMarketPrice: candles.at(-1)?.close ?? 0,
      chartPreviousClose: candles.at(-2)?.close ?? 0,
      ...metaOverrides,
    },
    timestamp: candles.map((candle) => candle.timestamp),
    indicators: {
      quote: [
        {
          open: candles.map((candle) => candle.open),
          high: candles.map((candle) => candle.high),
          low: candles.map((candle) => candle.low),
          close: candles.map((candle) => candle.close),
          volume: candles.map(() => 1_000),
        },
      ],
    },
  };
}

function makeCandles(count, values = {}) {
  return Array.from({ length: count }, (_, index) => ({
    open: 100,
    high: 103,
    low: 98,
    close: 101,
    timestamp: T0_SECONDS + index * DAY_SECONDS,
    ...values,
  }));
}

test("BTC.D and quote contexts expose direction and required formatting", async () => {
  const { buildMarketContextByAssetClass } = await loadAdapter();
  const contexts = buildMarketContextByAssetClass(
    [
      makeAsset({ symbol: "^VIX", price: 15.2, changePercent: -2.4 }),
      makeAsset({ symbol: "DX-Y.NYB", price: 104.28, changePercent: 0 }),
      makeAsset({ symbol: "GC=F", price: 2350, changePercent: 1.2 }),
      makeAsset({ symbol: "HG=F", price: 4.2, changePercent: 0.5 }),
    ],
    null,
    {
      btc: 56.1,
      eth: 12.8,
      btcDominanceChangePercent24h: -0.4,
      updatedAt: NOW_MS - 30_000,
    },
    NOW_MS,
  );

  assert.equal(contexts.crypto.symbol, "BTC.D");
  assert.equal(contexts.crypto.name, "BTC Dominance Index");
  assert.equal(contexts.crypto.value, 56.1);
  assert.equal(contexts.crypto.suffix, undefined);
  assert.equal(contexts.crypto.changePercent, -0.4);
  assert.equal(contexts.crypto.direction, "down");
  assert.equal(contexts.crypto.precision, 1);
  assert.equal(contexts.crypto.timestamp, NOW_MS - 30_000);
  assert.equal(contexts["us-stock"].name, "CBOE Volatility Index");
  assert.equal(contexts["us-stock"].direction, "down");
  assert.equal(contexts["us-stock"].precision, 1);
  assert.equal(contexts.forex.direction, "flat");
  assert.equal(contexts.forex.precision, 2);
  assert.equal(contexts.commodity.name, "Copper Gold Ratio");
  assert.equal(contexts.commodity.direction, "down");
  assert.equal(contexts.commodity.precision, 5);
  assert.equal(contexts.commodity.kind, "quote");
  assert.notStrictEqual(
    contexts.forex,
    contexts.commodity,
    "Commodity now uses the Copper/Gold ratio, not DXY",
  );
});

test("BTC.D keeps its value without a delta and fails closed without global data", async () => {
  const { buildMarketContextByAssetClass } = await loadAdapter();
  const withoutDelta = buildMarketContextByAssetClass(
    [],
    null,
    { btc: 56.1, eth: 12.8, updatedAt: NOW_MS - 30_000 },
    NOW_MS,
  );
  assert.equal(withoutDelta.crypto.symbol, "BTC.D");
  assert.equal(withoutDelta.crypto.value, 56.1);
  assert.equal(withoutDelta.crypto.suffix, undefined);
  assert.equal(withoutDelta.crypto.changePercent, undefined);
  assert.equal(withoutDelta.crypto.direction, undefined);

  const withoutGlobal = buildMarketContextByAssetClass(
    [],
    null,
    null,
    NOW_MS,
  );
  assert.equal(withoutGlobal.crypto, null);
});

test("incomplete and stale quote snapshots are rejected", async () => {
  const { adaptQuoteMarketContext } = await loadAdapter();

  assert.equal(
    adaptQuoteMarketContext(makeAsset({ symbol: "^VIX", price: Number.NaN }), {
      precision: 1,
      nowMs: NOW_MS,
    }),
    null,
  );
  assert.equal(
    adaptQuoteMarketContext(
      makeAsset({ symbol: "^VIX", quoteTime: NOW_MS - 8 * DAY_MS }),
      { precision: 1, nowMs: NOW_MS },
    ),
    null,
  );
});

test("Garman-Klass matches the 30-day annualized formula", async () => {
  const { calculateGarmanKlassVolatility } = await loadAdapter();
  const candles = makeCandles(30);
  const actual = calculateGarmanKlassVolatility(makeResult(candles));
  const dailyVariance =
    0.5 * Math.log(103 / 98) ** 2 -
    (2 * Math.log(2) - 1) * Math.log(101 / 100) ** 2;
  const expected = 100 * Math.sqrt(252 * dailyVariance);

  assert.ok(actual != null);
  assert.ok(Math.abs(actual - expected) < 1e-12);
});

test("Garman-Klass returns zero for a flat market", async () => {
  const { calculateGarmanKlassVolatility } = await loadAdapter();
  const flat = makeCandles(30, { open: 100, high: 100, low: 100, close: 100 });
  assert.equal(calculateGarmanKlassVolatility(makeResult(flat)), 0);
});

test("Garman-Klass uses the latest 30 valid physical candles", async () => {
  const { calculateGarmanKlassVolatility } = await loadAdapter();
  const noisyOldCandles = makeCandles(5, {
    open: 100,
    high: 130,
    low: 80,
    close: 120,
  });
  const flatLatestCandles = makeCandles(30, {
    open: 100,
    high: 100,
    low: 100,
    close: 100,
  }).map((candle, index) => ({
    ...candle,
    timestamp: T0_SECONDS + (index + 5) * DAY_SECONDS,
  }));
  assert.equal(
    calculateGarmanKlassVolatility(
      makeResult([...noisyOldCandles, ...flatLatestCandles]),
    ),
    0,
  );

  const invalid = {
    open: 105,
    high: 103,
    low: 98,
    close: 101,
    timestamp: T0_SECONDS,
  };
  const validFlat = flatLatestCandles.map((candle, index) => ({
    ...candle,
    timestamp: T0_SECONDS + (index + 1) * DAY_SECONDS,
  }));
  assert.equal(
    calculateGarmanKlassVolatility(makeResult([invalid, ...validFlat])),
    0,
    "physically impossible OHLC is dropped before the trailing window",
  );
});

test("Garman-Klass returns null with fewer than 30 valid candles", async () => {
  const { calculateGarmanKlassVolatility } = await loadAdapter();
  assert.equal(
    calculateGarmanKlassVolatility(makeResult(makeCandles(29))),
    null,
  );
});

test("IHSG context excludes the in-progress regular-session candle", async () => {
  const { adaptIhsgVolatilityMarketContext } = await loadAdapter();
  const completed = makeCandles(30, {
    open: 100,
    high: 100,
    low: 100,
    close: 100,
  });
  const currentTimestamp = T0_SECONDS + 30 * DAY_SECONDS;
  const liveCandle = {
    open: 100,
    high: 140,
    low: 70,
    close: 130,
    timestamp: currentTimestamp,
  };
  const result = makeResult([...completed, liveCandle], {
    regularMarketTime: currentTimestamp + 60 * 60,
    currentTradingPeriod: {
      pre: {
        timezone: "WIB",
        start: currentTimestamp - 60 * 60,
        end: currentTimestamp,
        gmtoffset: 25_200,
      },
      regular: {
        timezone: "WIB",
        start: currentTimestamp,
        end: currentTimestamp + 7 * 60 * 60,
        gmtoffset: 25_200,
      },
      post: {
        timezone: "WIB",
        start: currentTimestamp + 7 * 60 * 60,
        end: currentTimestamp + 8 * 60 * 60,
        gmtoffset: 25_200,
      },
    },
  });

  const context = adaptIhsgVolatilityMarketContext(
    result,
    (currentTimestamp + 60 * 60) * 1000,
  );
  assert.ok(context);
  assert.equal(context.kind, "realized-volatility");
  assert.equal(context.name, "IHSG Volatility Index");
  assert.equal(context.sourceSymbol, "^JKSE");
  assert.equal(context.lookbackDays, 30);
  assert.equal(context.precision, 1);
  assert.equal(context.value, 0);
  assert.equal(context.timestamp, completed.at(-1).timestamp * 1000);
});

test("IHSG context keeps the final candle once the regular session has closed", async () => {
  const { adaptIhsgVolatilityMarketContext } = await loadAdapter();
  const completed = makeCandles(30, {
    open: 100,
    high: 100,
    low: 100,
    close: 100,
  });
  const currentTimestamp = T0_SECONDS + 30 * DAY_SECONDS;
  const finalCandle = {
    open: 100,
    high: 140,
    low: 70,
    close: 130,
    timestamp: currentTimestamp,
  };
  const regularEnd = currentTimestamp + 7 * 60 * 60;
  const result = makeResult([...completed, finalCandle], {
    regularMarketTime: regularEnd - 60,
    currentTradingPeriod: {
      pre: {
        timezone: "WIB",
        start: currentTimestamp - 60 * 60,
        end: currentTimestamp,
        gmtoffset: 25_200,
      },
      regular: {
        timezone: "WIB",
        start: currentTimestamp,
        end: regularEnd,
        gmtoffset: 25_200,
      },
      post: {
        timezone: "WIB",
        start: regularEnd,
        end: regularEnd + 60 * 60,
        gmtoffset: 25_200,
      },
    },
  });

  const context = adaptIhsgVolatilityMarketContext(
    result,
    (regularEnd + 1) * 1000,
  );

  assert.ok(context);
  assert.ok(context.value > 0);
  assert.equal(context.timestamp, finalCandle.timestamp * 1000);
});

function makeVolatileCandles(count, range, startIndex = 0) {
  return Array.from({ length: count }, (_, index) => ({
    open: 100,
    high: range.high,
    low: range.low,
    close: 101,
    timestamp: T0_SECONDS + (startIndex + index) * DAY_SECONDS,
  }));
}

test("IHSG volatility change is positive when the latest window is more volatile", async () => {
  const { adaptIhsgVolatilityMarketContext } = await loadAdapter();
  const calm = makeVolatileCandles(30, { low: 99, high: 101 });
  const volatile = makeVolatileCandles(5, { low: 70, high: 140 }, 30);
  const context = adaptIhsgVolatilityMarketContext(
    makeResult([...calm, ...volatile]),
  );

  assert.ok(context);
  assert.ok(context.value > 0);
  assert.ok(context.changePercent > 0);
  assert.equal(context.direction, "up");
  assert.equal(context.changeOffsetDays, 5);
});

test("IHSG volatility change is negative when the latest window is calmer", async () => {
  const { adaptIhsgVolatilityMarketContext } = await loadAdapter();
  const volatile = makeVolatileCandles(30, { low: 70, high: 140 });
  const calm = makeVolatileCandles(5, { low: 99, high: 101 }, 30);
  const context = adaptIhsgVolatilityMarketContext(
    makeResult([...volatile, ...calm]),
  );

  assert.ok(context);
  assert.ok(context.value >= 0);
  assert.ok(context.changePercent < 0);
  assert.equal(context.direction, "down");
});

test("IHSG volatility omits change when fewer than 35 candles are available", async () => {
  const { adaptIhsgVolatilityMarketContext } = await loadAdapter();
  const context = adaptIhsgVolatilityMarketContext(makeResult(makeCandles(34)));

  assert.ok(context);
  assert.equal(context.changePercent, undefined);
  assert.equal(context.direction, undefined);
  assert.equal(context.changeOffsetDays, undefined);
});

test("IHSG volatility omits change when the prior window is zero", async () => {
  const { adaptIhsgVolatilityMarketContext } = await loadAdapter();
  const flat = makeCandles(35, { open: 100, high: 100, low: 100, close: 100 });
  const context = adaptIhsgVolatilityMarketContext(makeResult(flat));

  assert.ok(context);
  assert.equal(context.value, 0);
  assert.equal(context.changePercent, undefined);
  assert.equal(context.direction, undefined);
});

test("IHSG volatility change is flat when both windows match", async () => {
  const { adaptIhsgVolatilityMarketContext } = await loadAdapter();
  const context = adaptIhsgVolatilityMarketContext(makeResult(makeCandles(35)));

  assert.ok(context);
  assert.equal(context.changePercent, 0);
  assert.equal(context.direction, "flat");
  assert.equal(context.changeOffsetDays, 5);
});
