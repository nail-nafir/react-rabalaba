/**
 * Evidence gate for journal-entry filters on the production swing contract.
 *
 * Fetches 60d/1h candles through the same Cloudflare Yahoo proxy as browser and
 * cron. The first 50% is history, the next 25% validates candidates, and the
 * final 25% is a separately reported holdout. This script never writes config.
 *
 * Acceptance (balanced): win rate +2pp, expectancy/PF not lower, drawdown not
 * worse, and at least 50% of baseline trades retained.
 *
 * Usage: npm run gate:compare [assetsPerClass]
 */
import { createServer } from "vite";

const PER_CLASS = Number(process.argv[2]) || 6;
const RANGE = "60d";
const INTERVAL = "1h";
const VALIDATION_START = 0.5;
const HOLDOUT_START = 0.75;
const FETCH_TIMEOUT_MS = 15_000;
// Research-only threshold. Production journals every fresh actionable signal
// shown by the screener; this script only measures hypothetical entry filters.
const COUNTER_TREND_RESEARCH_MIN = 60;
const PROXY =
  process.env.YAHOO_PROXY_BASE ??
  "https://rabalaba.pages.dev/api/yahoo/v8/finance/chart";

const BENCHMARK = {
  crypto: { symbol: "BTC-USD", assetType: "crypto" },
  "id-stock": { symbol: "^JKSE", assetType: "id-stock" },
  "us-stock": { symbol: "^GSPC", assetType: "us-stock" },
};

async function fetchChart(symbol) {
  const url = `${PROXY}/${encodeURIComponent(symbol)}?range=${RANGE}&interval=${INTERVAL}&includePrePost=false`;
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  const result = json?.chart?.result?.[0];
  return result?.timestamp && result?.indicators?.quote?.[0] ? result : null;
}

function aggregate(input) {
  const trades = [...input].sort((a, b) => a.exitTimestamp - b.exitTimestamp);
  if (trades.length === 0) {
    return {
      trades: 0,
      winRate: 0,
      profitFactor: 0,
      expectancy: 0,
      maxDrawdownR: 0,
    };
  }
  let wins = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let sum = 0;
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
    sum += trade.r;
    equity += trade.r;
    peak = Math.max(peak, equity);
    maxDrawdownR = Math.max(maxDrawdownR, peak - equity);
  }
  return {
    trades: trades.length,
    winRate: (wins / trades.length) * 100,
    profitFactor:
      grossLoss > 0
        ? grossProfit / grossLoss
        : grossProfit > 0
          ? Infinity
          : 0,
    expectancy: sum / trades.length,
    maxDrawdownR,
  };
}

function row(label, metrics) {
  const pf =
    metrics.profitFactor === Infinity ? "∞" : metrics.profitFactor.toFixed(2);
  return `${label.padEnd(18)} trades ${String(metrics.trades).padStart(4)}  win ${metrics.winRate.toFixed(1).padStart(5)}%  PF ${pf.padStart(5)}  exp ${metrics.expectancy.toFixed(3).padStart(7)}R  DD ${metrics.maxDrawdownR.toFixed(2).padStart(6)}R`;
}

function accepted(candidate, baseline) {
  return (
    candidate.winRate >= baseline.winRate + 2 &&
    candidate.expectancy >= baseline.expectancy &&
    candidate.profitFactor >= baseline.profitFactor &&
    candidate.maxDrawdownR <= baseline.maxDrawdownR &&
    candidate.trades >= baseline.trades * 0.5
  );
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
    const { runBacktest } = await load("/src/core/engine/backtest.ts");
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
    const { computeSignal } = await load("/src/core/engine/signals.ts");
    const {
      normalizeYahooCandles,
      buildSignalSeriesFromCandles,
      deriveCandleTrendState,
      resampleCandles,
    } = await load("/src/core/market/candles.ts");
    const { CRYPTO_CONTEXT, IDX_CONTEXT, US_CONTEXT } = await load(
      "/src/constants/signals.ts",
    );
    const { HIGHER_TIMEFRAME_FACTOR, TIMEFRAME_PRESETS } = await load(
      "/src/constants/timeframes.ts",
    );
    const {
      DEFAULT_CRYPTO_TICKERS,
      DEFAULT_US_STOCK_TICKERS,
      DEFAULT_ID_STOCK_TICKERS,
    } = await load("/src/constants/assets.ts");

    const derate = {
      crypto: CRYPTO_CONTEXT.COUNTER_MARKET_DERATE,
      "id-stock": IDX_CONTEXT.COUNTER_MARKET_DERATE,
      "us-stock": US_CONTEXT.COUNTER_MARKET_DERATE,
    };
    const riskStateOf = {
      crypto: deriveCryptoRiskState,
      "id-stock": deriveIdxRiskState,
      "us-stock": deriveUsRiskState,
    };
    const minCounterTrend = COUNTER_TREND_RESEARCH_MIN;
    const warmup = TIMEFRAME_PRESETS.swing.signalProfile.minCandles;

    const benchmarkSeries = {};
    for (const [assetClass, benchmark] of Object.entries(BENCHMARK)) {
      const raw = await fetchChart(benchmark.symbol);
      if (!raw) throw new Error(`benchmark fetch failed: ${benchmark.symbol}`);
      const candles = normalizeYahooCandles(
        raw.indicators.quote[0],
        raw.timestamp,
        { requirePhysical: true },
      );
      benchmarkSeries[assetClass] = [];
      for (let i = warmup; i < candles.length; i++) {
        const decision = candles.slice(0, i + 1);
        const higherTimeframe = deriveCandleTrendState(
          resampleCandles(decision, HIGHER_TIMEFRAME_FACTOR.swing, {
            includeTrailingPartial: false,
          }),
        );
        const outlook = computeSignal({
          ...buildSignalSeriesFromCandles(decision),
          assetType: benchmark.assetType,
          timeframe: "swing",
          higherTimeframeTrend: higherTimeframe.trend,
          higherTimeframeReady: higherTimeframe.ready,
        });
        benchmarkSeries[assetClass].push({
          timestamp: candles[i].timestamp,
          riskState: riskStateOf[assetClass](outlook.directionScore),
        });
      }
      process.stdout.write(`· benchmark ${benchmark.symbol} ready\n`);
    }

    const riskAt = (assetClass, timestamp) => {
      const series = benchmarkSeries[assetClass] ?? [];
      let riskState = "neutral";
      for (const point of series) {
        if (point.timestamp > timestamp) break;
        riskState = point.riskState;
      }
      return riskState;
    };
    const contextAllowed = (assetClass, outlook, timestamp) => {
      const riskState = riskAt(assetClass, timestamp);
      if (!fightsBenchmark(outlook.signal, riskState)) return true;
      return (
        Math.round(outlook.strength * derate[assetClass]) >= minCounterTrend
      );
    };
    const htfAligned = (outlook) =>
      outlook.higherTimeframeReady &&
      ((outlook.signal === "long" &&
        outlook.higherTimeframeTrend === "bullish") ||
        (outlook.signal === "short" &&
          outlook.higherTimeframeTrend === "bearish"));

    const candidates = {
      context: (assetClass, outlook, timestamp) =>
        contextAllowed(assetClass, outlook, timestamp),
      "context+htf": (assetClass, outlook, timestamp) =>
        contextAllowed(assetClass, outlook, timestamp) && htfAligned(outlook),
      "context+trend": (assetClass, outlook, timestamp) =>
        contextAllowed(assetClass, outlook, timestamp) &&
        outlook.regime === "trending",
      "context+htf+B": (assetClass, outlook, timestamp) =>
        contextAllowed(assetClass, outlook, timestamp) &&
        htfAligned(outlook) &&
        outlook.strength >= 60,
    };

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
    const emptyResults = () => ({
      baseline: [],
      ...Object.fromEntries(Object.keys(candidates).map((name) => [name, []])),
    });
    const all = { validation: emptyResults(), holdout: emptyResults() };
    const perClass = {};

    for (const [assetClass, symbol] of universe) {
      const raw = await fetchChart(symbol);
      if (!raw) {
        process.stdout.write(`  skip ${symbol} (fetch failed)\n`);
        continue;
      }
      const candles = normalizeYahooCandles(
        raw.indicators.quote[0],
        raw.timestamp,
        { requirePhysical: true },
      );
      if (candles.length < warmup + 20) {
        process.stdout.write(`  skip ${symbol} (${candles.length} bars)\n`);
        continue;
      }
      const validationStart =
        candles[Math.floor(candles.length * VALIDATION_START)].timestamp;
      const holdoutStart =
        candles[Math.floor(candles.length * HOLDOUT_START)].timestamp;
      const classResults = (perClass[assetClass] ??= {
        validation: emptyResults(),
        holdout: emptyResults(),
      });

      for (const [window, start, end] of [
        ["validation", validationStart, holdoutStart],
        ["holdout", holdoutStart, Infinity],
      ]) {
        const inWindow = (timestamp) => timestamp >= start && timestamp < end;
        const baseline = runBacktest(candles, {
          assetType: assetClass,
          timeframe: "swing",
          entryFilter: ({ timestamp }) => inWindow(timestamp),
        });
        all[window].baseline.push(...baseline.trades);
        classResults[window].baseline.push(...baseline.trades);

        for (const [name, filter] of Object.entries(candidates)) {
          const result = runBacktest(candles, {
            assetType: assetClass,
            timeframe: "swing",
            entryFilter: ({ outlook, timestamp }) =>
              inWindow(timestamp) && filter(assetClass, outlook, timestamp),
          });
          all[window][name].push(...result.trades);
          classResults[window][name].push(...result.trades);
        }
      }
      process.stdout.write(
        `  ${symbol.padEnd(12)} ${String(candles.length).padStart(4)} bars\n`,
      );
    }

    const validationBaseline = aggregate(all.validation.baseline);
    const holdoutBaseline = aggregate(all.holdout.baseline);
    console.log(`\n=== Validation (${PER_CLASS}/class, ${RANGE}/${INTERVAL}) ===`);
    console.log(row("baseline", validationBaseline));
    const qualified = {};
    for (const name of Object.keys(candidates)) {
      const metrics = aggregate(all.validation[name]);
      qualified[name] = accepted(metrics, validationBaseline);
      console.log(`${row(name, metrics)}  ${qualified[name] ? "PASS" : "FAIL"}`);
    }
    console.log("\n=== Holdout (final 25%) ===");
    console.log(row("baseline", holdoutBaseline));
    for (const name of Object.keys(candidates)) {
      const metrics = aggregate(all.holdout[name]);
      const passed = qualified[name] && accepted(metrics, holdoutBaseline);
      console.log(`${row(name, metrics)}  ${passed ? "PASS" : "FAIL"}`);
    }
    for (const [assetClass, results] of Object.entries(perClass)) {
      console.log(`\n[${assetClass} holdout]`);
      console.log(row("baseline", aggregate(results.holdout.baseline)));
      for (const name of Object.keys(candidates)) {
        console.log(row(name, aggregate(results.holdout[name])));
      }
    }
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
