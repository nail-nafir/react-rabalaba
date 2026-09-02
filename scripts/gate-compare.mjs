/**
 * Engine-v6 research gate. Read-only: one 730d/1h fetch per symbol, a rolling
 * 60-day signal window, chronological development folds, then a locked final
 * holdout. No candidate changes production config.
 *
 * Usage: npm run gate:compare [assetsPerClass]
 */
import { createServer } from "vite";

const requestedPerClass = Number(process.argv[2]);
const PER_CLASS = requestedPerClass > 0 ? requestedPerClass : Infinity;
const RANGE = "730d";
const INTERVAL = "1h";
const LOOKBACK_SECONDS = 60 * 24 * 60 * 60;
const FETCH_TIMEOUT_MS = 20_000;
const COUNTER_TREND_RESEARCH_MIN = 60;
const DEVELOPMENT_FOLDS = [
  [0.4, 0.55],
  [0.55, 0.7],
  [0.7, 0.85],
];
const HOLDOUT = [0.85, 1];
const PROXY =
  process.env.YAHOO_PROXY_BASE ??
  "https://rabalaba.pages.dev/api/yahoo/v8/finance/chart";
const chartCache = new Map();

async function fetchChart(symbol) {
  if (!chartCache.has(symbol)) {
    chartCache.set(
      symbol,
      (async () => {
        const url = `${PROXY}/${encodeURIComponent(symbol)}?range=${RANGE}&interval=${INTERVAL}&includePrePost=false`;
        const res = await fetch(url, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) return null;
        const json = await res.json().catch(() => null);
        const result = json?.chart?.result?.[0];
        return result?.timestamp && result?.indicators?.quote?.[0]
          ? result
          : null;
      })(),
    );
  }
  return chartCache.get(symbol);
}

function aggregate(input) {
  const trades = [...input].sort((a, b) => a.exitTimestamp - b.exitTimestamp);
  let wins = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalR = 0;
  let equity = 0;
  let peak = 0;
  let maxDrawdownR = 0;
  for (const trade of trades) {
    if (trade.r > 0) {
      wins++;
      grossProfit += trade.r;
    } else {
      grossLoss += Math.abs(trade.r);
    }
    totalR += trade.r;
    equity += trade.r;
    peak = Math.max(peak, equity);
    maxDrawdownR = Math.max(maxDrawdownR, peak - equity);
  }
  return {
    trades: trades.length,
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    profitFactor:
      grossLoss > 0
        ? grossProfit / grossLoss
        : grossProfit > 0
          ? Infinity
          : 0,
    expectancy: trades.length > 0 ? totalR / trades.length : 0,
    maxDrawdownR,
  };
}

function row(label, metrics) {
  const pf =
    metrics.profitFactor === Infinity ? "∞" : metrics.profitFactor.toFixed(2);
  return `${label.padEnd(16)} trades ${String(metrics.trades).padStart(5)}  win ${metrics.winRate.toFixed(1).padStart(5)}%  PF ${pf.padStart(5)}  exp ${metrics.expectancy.toFixed(3).padStart(7)}R  DD ${metrics.maxDrawdownR.toFixed(2).padStart(7)}R`;
}

function passesMetrics(candidate, baseline) {
  return (
    candidate.profitFactor >= 1.1 &&
    candidate.expectancy >= 0.05 &&
    candidate.winRate >= baseline.winRate + 2 &&
    candidate.maxDrawdownR <= baseline.maxDrawdownR &&
    candidate.trades >= baseline.trades * 0.5
  );
}

function oneWeekSeries(candles) {
  const week = 7 * 24 * 60 * 60;
  let reference = 0;
  return candles.map((candle, index) => {
    const cutoff = candle.timestamp - week;
    while (
      reference + 1 < index &&
      candles[reference + 1].timestamp <= cutoff
    ) {
      reference++;
    }
    const old = candles[reference]?.close;
    return {
      timestamp: candle.timestamp,
      level: candle.close,
      oneWeekChangePercent:
        old > 0 ? ((candle.close - old) / old) * 100 : undefined,
    };
  });
}

function latestAt(series, timestamp) {
  let low = 0;
  let high = series.length - 1;
  let found;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (series[mid].timestamp <= timestamp) {
      found = series[mid];
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

function emptyBuckets(names) {
  return Object.fromEntries(names.map((name) => [name, []]));
}

async function main() {
  const server = await createServer({
    appType: "custom",
    configFile: "vite.config.ts",
    logLevel: "silent",
    server: { middlewareMode: true, watch: null },
  });

  try {
    const load = (path) => server.ssrLoadModule(path);
    const { buildDecisionSeries, replayDecisionSeries } = await load(
      "/src/core/engine/backtest.ts",
    );
    const { fightsBenchmark } = await load(
      "/src/core/engine/benchmark-derate.ts",
    );
    const { deriveCryptoRiskState } = await load(
      "/src/core/engine/crypto-context.ts",
    );
    const { deriveIdxRiskState } = await load(
      "/src/core/engine/idx-context.ts",
    );
    const { deriveUsRiskState } = await load(
      "/src/core/engine/us-context.ts",
    );
    const { normalizeYahooCandles } = await load(
      "/src/core/market/candles.ts",
    );
    const { CRYPTO_CONTEXT, IDX_CONTEXT, US_CONTEXT } = await load(
      "/src/constants/signals.ts",
    );
    const {
      DEFAULT_CRYPTO_TICKERS,
      DEFAULT_US_STOCK_TICKERS,
      DEFAULT_ID_STOCK_TICKERS,
    } = await load("/src/constants/assets.ts");

    const normalize = (raw) =>
      normalizeYahooCandles(raw.indicators.quote[0], raw.timestamp, {
        requirePhysical: true,
        requireTimestamps: true,
      });
    const loadCandles = async (symbol) => {
      const raw = await fetchChart(symbol);
      return raw ? normalize(raw) : [];
    };

    const contextSymbols = {
      btc: "BTC-USD",
      ihsg: "^JKSE",
      usdIdr: "USDIDR=X",
      spx: "^GSPC",
      vix: "^VIX",
      dxy: "DX-Y.NYB",
    };
    const contextCandles = Object.fromEntries(
      await Promise.all(
        Object.entries(contextSymbols).map(async ([key, symbol]) => [
          key,
          await loadCandles(symbol),
        ]),
      ),
    );
    for (const [key, candles] of Object.entries(contextCandles)) {
      if (candles.length === 0) throw new Error(`context fetch failed: ${key}`);
    }

    const decisionOptions = {
      timeframe: "swing",
      lookbackSeconds: LOOKBACK_SECONDS,
    };
    const btcDecisions = buildDecisionSeries(contextCandles.btc, {
      ...decisionOptions,
      assetType: "crypto",
    });
    const ihsgDecisions = buildDecisionSeries(contextCandles.ihsg, {
      ...decisionOptions,
      assetType: "id-stock",
    });
    const spxDecisions = buildDecisionSeries(contextCandles.spx, {
      ...decisionOptions,
      assetType: "us-stock",
    });
    const usdIdr = oneWeekSeries(contextCandles.usdIdr);
    const vix = oneWeekSeries(contextCandles.vix);
    const dxy = oneWeekSeries(contextCandles.dxy);
    const riskSeries = {
      crypto: btcDecisions.map((decision) => ({
        timestamp: decision.timestamp,
        riskState: deriveCryptoRiskState(decision.outlook.directionScore),
      })),
      "id-stock": ihsgDecisions.map((decision) => ({
        timestamp: decision.timestamp,
        riskState: deriveIdxRiskState(
          decision.outlook.directionScore,
          latestAt(usdIdr, decision.timestamp)?.oneWeekChangePercent,
        ),
      })),
      "us-stock": spxDecisions.map((decision) => {
        const vixPoint = latestAt(vix, decision.timestamp);
        const dxyPoint = latestAt(dxy, decision.timestamp);
        return {
          timestamp: decision.timestamp,
          riskState: deriveUsRiskState(decision.outlook.directionScore, {
            vixLevel: vixPoint?.level,
            vix1wChangePercent: vixPoint?.oneWeekChangePercent,
            dxy1wChangePercent: dxyPoint?.oneWeekChangePercent,
          }),
        };
      }),
    };
    process.stdout.write("· BTC/IHSG/USDIDR/SPX/VIX/DXY context ready\n");

    const derate = {
      crypto: CRYPTO_CONTEXT.COUNTER_MARKET_DERATE,
      "id-stock": IDX_CONTEXT.COUNTER_MARKET_DERATE,
      "us-stock": US_CONTEXT.COUNTER_MARKET_DERATE,
    };
    const contextAllowed = (assetClass, decision, symbol) => {
      if (assetClass === "crypto" && /^BTC[-/]?USD/i.test(symbol)) return true;
      const risk = latestAt(riskSeries[assetClass], decision.timestamp)?.riskState;
      if (!risk || !fightsBenchmark(decision.outlook.signal, risk)) return true;
      return (
        Math.round(decision.outlook.strength * derate[assetClass]) >=
        COUNTER_TREND_RESEARCH_MIN
      );
    };
    const mtfAllowed = (decision) => {
      const data = decision.research;
      if (!data?.ema2001h || !data.ema50Daily) return false;
      const emas = [data.ema2001h, data.ema50Daily];
      if (data.ema2004h) emas.push(data.ema2004h);
      return decision.outlook.signal === "long"
        ? emas.every((ema) => data.close >= ema)
        : emas.every((ema) => data.close <= ema);
    };
    const twoClosed = (decision) =>
      decision.outlook.signal !== "neutral" &&
      decision.previousSignal === decision.outlook.signal;

    const candidates = {
      baseline: { exitMode: "progressive", filter: () => true },
      context: { exitMode: "progressive", filter: contextAllowed },
      mtf: {
        exitMode: "progressive",
        filter: (_assetClass, decision) => mtfAllowed(decision),
      },
      "two-closed": {
        exitMode: "progressive",
        filter: (_assetClass, decision) => twoClosed(decision),
      },
      "scale-out": { exitMode: "scaleOut", filter: () => true },
      secured: { exitMode: "secured", filter: () => true },
      "tp1-1r": { exitMode: "tp1-1r", filter: () => true },
    };
    const names = Object.keys(candidates);
    const universe = [
      ...DEFAULT_CRYPTO_TICKERS.slice(0, PER_CLASS).map((symbol) => [
        "crypto",
        symbol,
      ]),
      ...DEFAULT_US_STOCK_TICKERS.slice(0, PER_CLASS).map((symbol) => [
        "us-stock",
        symbol,
      ]),
      ...DEFAULT_ID_STOCK_TICKERS.slice(0, PER_CLASS).map((symbol) => [
        "id-stock",
        symbol,
      ]),
    ];
    const windows = [
      ...DEVELOPMENT_FOLDS.map((bounds, index) => ({
        name: `dev-${index + 1}`,
        bounds,
        locked: false,
      })),
      { name: "holdout", bounds: HOLDOUT, locked: true },
    ];
    const results = Object.fromEntries(
      windows.map((window) => [
        window.name,
        {
          all: emptyBuckets(names),
          byClass: {
            crypto: emptyBuckets(names),
            "us-stock": emptyBuckets(names),
            "id-stock": emptyBuckets(names),
          },
        },
      ]),
    );

    for (const [assetClass, symbol] of universe) {
      const candles = await loadCandles(symbol);
      if (candles.length < 300) {
        process.stdout.write(`  skip ${symbol} (${candles.length} bars)\n`);
        continue;
      }
      const decisions = buildDecisionSeries(candles, {
        ...decisionOptions,
        assetType: assetClass,
        includeResearchFeatures: true,
      });
      const replayByName = Object.fromEntries(
        Object.entries(candidates).map(([name, candidate]) => [
          name,
          replayDecisionSeries(candles, decisions, {
            assetType: assetClass,
            exitMode: candidate.exitMode,
            entryFilter: ({ decision }) =>
              candidate.filter(assetClass, decision, symbol),
          }).trades,
        ]),
      );
      for (const window of windows) {
        const [startFraction, endFraction] = window.bounds;
        const start = candles[Math.floor(candles.length * startFraction)].timestamp;
        const end =
          endFraction >= 1
            ? Infinity
            : candles[Math.floor(candles.length * endFraction)].timestamp;
        for (const name of names) {
          const trades = replayByName[name].filter(
            (trade) =>
              trade.decisionTimestamp >= start && trade.decisionTimestamp < end,
          );
          results[window.name].all[name].push(...trades);
          results[window.name].byClass[assetClass][name].push(...trades);
        }
      }
      process.stdout.write(
        `  ${symbol.padEnd(14)} ${String(candles.length).padStart(5)} bars / ${String(decisions.length).padStart(5)} decisions\n`,
      );
    }

    const qualified = Object.fromEntries(
      names.filter((name) => name !== "baseline").map((name) => [name, true]),
    );
    for (const window of windows.filter((item) => !item.locked)) {
      const bucket = results[window.name];
      const baseline = aggregate(bucket.all.baseline);
      console.log(`\n=== ${window.name} (${RANGE}/${INTERVAL}, rolling 60d) ===`);
      console.log(row("baseline", baseline));
      for (const name of Object.keys(qualified)) {
        const metrics = aggregate(bucket.all[name]);
        const classesNonNegative = Object.values(bucket.byClass).every(
          (classBucket) => aggregate(classBucket[name]).expectancy >= 0,
        );
        const passed = passesMetrics(metrics, baseline) && classesNonNegative;
        qualified[name] &&= passed;
        console.log(`${row(name, metrics)}  ${passed ? "PASS" : "FAIL"}`);
      }
    }

    const holdout = results.holdout;
    const holdoutBaseline = aggregate(holdout.all.baseline);
    console.log("\n=== locked final holdout ===");
    console.log(row("baseline", holdoutBaseline));
    const finalists = [];
    for (const name of Object.keys(qualified)) {
      const metrics = aggregate(holdout.all[name]);
      const classesNonNegative = Object.values(holdout.byClass).every(
        (classBucket) => aggregate(classBucket[name]).expectancy >= 0,
      );
      const passed =
        qualified[name] &&
        passesMetrics(metrics, holdoutBaseline) &&
        classesNonNegative;
      if (passed) finalists.push(name);
      console.log(
        `${row(name, metrics)}  ${qualified[name] ? (passed ? "PASS" : "FAIL") : "NOT QUALIFIED"}`,
      );
    }
    for (const [assetClass, bucket] of Object.entries(holdout.byClass)) {
      console.log(`\n[${assetClass} holdout]`);
      console.log(row("baseline", aggregate(bucket.baseline)));
      for (const name of Object.keys(qualified)) {
        console.log(row(name, aggregate(bucket[name])));
      }
    }
    console.log(
      finalists.length > 0
        ? `\nengine-v6 candidates: ${finalists.join(", ")}`
        : "\nengine-v6 candidates: none; remain on engine-v5",
    );
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
