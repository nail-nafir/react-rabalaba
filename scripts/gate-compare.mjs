/**
 * gate-compare — quantify the context emission-gate's effect on the engine.
 *
 * Walk-forward backtests every universe asset TWICE on daily candles:
 *   baseline  — raw per-asset signal (today's journal, pre-gate)
 *   gated     — same, but a counter-trend entry (one that fights its OWN index's
 *               risk state) is BLOCKED unless its post-de-rate strength still
 *               clears JOURNAL_EMISSION.COUNTER_TREND_MIN_STRENGTH
 * then prints aggregate win% / profit-factor / expectancy / trade-count so you
 * can see whether index-gating helps BEFORE deploying.
 *
 * Benchmark risk state is score-only here (tiebreaks USDIDR/VIX/DXY omitted
 * — they only matter when the index is indecisive), so this is a close, slightly
 * conservative model of the live gate. Daily candles from Yahoo (no key).
 *
 * Usage:  npm run gate:compare [perClassCount] [historyBars]
 *   e.g.  npm run gate:compare 8 300
 */
import { createServer } from "vite";

const PER_CLASS = Number(process.argv[2]) || 6;
const HISTORY_BARS = Number(process.argv[3]) || 260;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const BENCHMARK = {
  crypto: { symbol: "BTC-USD", assetType: "crypto" },
  "id-stock": { symbol: "^JKSE", assetType: "id-stock" },
  "us-stock": { symbol: "^GSPC", assetType: "us-stock" },
};

async function fetchDaily(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=2y&interval=1d&includePrePost=false`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  const r = json?.chart?.result?.[0];
  if (!r?.timestamp || !r?.indicators?.quote?.[0]) return null;
  return { quote: r.indicators.quote[0], timestamps: r.timestamp };
}

function aggregate(trades) {
  if (trades.length === 0)
    return { trades: 0, winRate: 0, profitFactor: 0, expectancy: 0 };
  let wins = 0;
  let gp = 0;
  let gl = 0;
  let sum = 0;
  for (const t of trades) {
    if (t.r > 0) {
      wins++;
      gp += t.r;
    } else gl += Math.abs(t.r);
    sum += t.r;
  }
  return {
    trades: trades.length,
    winRate: (wins / trades.length) * 100,
    profitFactor: gl > 0 ? gp / gl : gp > 0 ? Infinity : 0,
    expectancy: sum / trades.length,
  };
}

function row(label, m) {
  const pf = m.profitFactor === Infinity ? "∞" : m.profitFactor.toFixed(2);
  return `${label.padEnd(12)} trades ${String(m.trades).padStart(4)}  win ${m.winRate
    .toFixed(1)
    .padStart(5)}%  PF ${pf.padStart(5)}  exp ${m.expectancy
    .toFixed(3)
    .padStart(7)}R`;
}

async function main() {
  const server = await createServer({
    appType: "custom",
    configFile: "vite.config.ts",
    logLevel: "silent",
    server: { middlewareMode: true, watch: null },
  });
  const load = (p) => server.ssrLoadModule(p);

  const { runBacktest } = await load("/src/features/engine/backtest.ts");
  const { fightsBenchmark } = await load(
    "/src/features/engine/benchmark-derate.ts",
  );
  const { deriveCryptoRiskState } = await load(
    "/src/features/engine/crypto-context.ts",
  );
  const { deriveIdxRiskState } = await load(
    "/src/features/engine/idx-context.ts",
  );
  const { deriveUsRiskState } = await load(
    "/src/features/engine/us-context.ts",
  );
  const { computeSignal } = await load("/src/features/engine/signals.ts");
  const { normalizeYahooCandles, buildSignalSeriesFromCandles } = await load(
    "/src/services/adapters/yahoo-candles.ts",
  );
  const { CRYPTO_CONTEXT, IDX_CONTEXT, US_CONTEXT, JOURNAL_EMISSION } =
    await load("/src/constants/signals.ts");
  const {
    DEFAULT_CRYPTO_TICKERS,
    DEFAULT_US_STOCK_TICKERS,
    DEFAULT_ID_STOCK_TICKERS,
  } = await load("/src/constants/assets.ts");

  const DERATE = {
    crypto: CRYPTO_CONTEXT.COUNTER_MARKET_DERATE,
    "id-stock": IDX_CONTEXT.COUNTER_MARKET_DERATE,
    "us-stock": US_CONTEXT.COUNTER_MARKET_DERATE,
  };
  const riskStateOf = {
    crypto: (s) => deriveCryptoRiskState(s),
    "id-stock": (s) => deriveIdxRiskState(s),
    "us-stock": (s) => deriveUsRiskState(s),
  };
  const MIN = JOURNAL_EMISSION.COUNTER_TREND_MIN_STRENGTH;

  const tail = (a) => (a.length > HISTORY_BARS ? a.slice(-HISTORY_BARS) : a);

  // Build each benchmark's risk-state-by-timestamp series (score-only).
  const benchSeries = {};
  for (const [cls, b] of Object.entries(BENCHMARK)) {
    const raw = await fetchDaily(b.symbol);
    if (!raw) {
      console.warn(`! benchmark ${b.symbol} fetch failed — ${cls} ungated`);
      continue;
    }
    const candles = tail(normalizeYahooCandles(raw.quote, raw.timestamps));
    const series = [];
    for (let j = 30; j < candles.length; j++) {
      const sig = computeSignal({
        ...buildSignalSeriesFromCandles(candles.slice(0, j + 1)),
        assetType: b.assetType,
        timeframe: "position",
      });
      series.push({
        t: candles[j].timestamp,
        riskState: riskStateOf[cls](sig.directionScore),
      });
    }
    benchSeries[cls] = series;
    process.stdout.write(`· benchmark ${b.symbol} (${cls}) ready\n`);
  }

  const riskAt = (cls, ts) => {
    const s = benchSeries[cls];
    if (!s || s.length === 0) return "neutral";
    let rs = "neutral";
    for (const e of s) {
      if (e.t <= ts) rs = e.riskState;
      else break;
    }
    return rs;
  };

  const universe = [
    ...DEFAULT_CRYPTO_TICKERS.slice(0, PER_CLASS).map((s) => ["crypto", s]),
    ...DEFAULT_US_STOCK_TICKERS.slice(0, PER_CLASS).map((s) => ["us-stock", s]),
    ...DEFAULT_ID_STOCK_TICKERS.slice(0, PER_CLASS).map((s) => ["id-stock", s]),
  ];

  const baseAll = [];
  const gateAll = [];
  const perClass = {};

  for (const [cls, symbol] of universe) {
    const raw = await fetchDaily(symbol);
    if (!raw) {
      console.warn(`  skip ${symbol} (fetch failed)`);
      continue;
    }
    const candles = tail(normalizeYahooCandles(raw.quote, raw.timestamps));
    if (candles.length < 60) {
      console.warn(`  skip ${symbol} (only ${candles.length} bars)`);
      continue;
    }

    const base = runBacktest(candles, { assetType: cls, timeframe: "position" });
    const factor = DERATE[cls];
    const gated = runBacktest(candles, {
      assetType: cls,
      timeframe: "position",
      entryFilter: ({ outlook, timestamp }) => {
        const rs = riskAt(cls, timestamp);
        if (!fightsBenchmark(outlook.signal, rs)) return true; // aligned → allow
        return Math.round(outlook.strength * factor) >= MIN; // counter-trend bar
      },
    });

    baseAll.push(...base.trades);
    gateAll.push(...gated.trades);
    (perClass[cls] ??= { base: [], gate: [] }).base.push(...base.trades);
    perClass[cls].gate.push(...gated.trades);
    process.stdout.write(
      `  ${symbol.padEnd(12)} base ${String(base.trades.length).padStart(
        3,
      )} → gated ${String(gated.trades.length).padStart(3)}\n`,
    );
  }

  console.log(
    `\n=== Gate compare (${PER_CLASS}/class, ${HISTORY_BARS} daily bars, min counter-trend strength ${MIN}) ===`,
  );
  for (const cls of Object.keys(perClass)) {
    console.log(`\n[${cls}]`);
    console.log(row("baseline", aggregate(perClass[cls].base)));
    console.log(row("gated", aggregate(perClass[cls].gate)));
  }
  console.log("\n[OVERALL]");
  console.log(row("baseline", aggregate(baseAll)));
  console.log(row("gated", aggregate(gateAll)));

  await server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
