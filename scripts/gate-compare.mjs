/** Read-only v7 research: development selects one candidate before opening holdout. */
import { createServer } from "vite";
import { parseArgs } from "node:util";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aggregate, windowTrades, compare, selectCandidate, cohortReport } from "./research-metrics.mjs";
import { ASSET_CLASSES, readJournal, journalTrades, journalAuditReport, readJson, writeJson, fetchChart, excursions, reconstructJournalEntries, digest, claimHoldout } from "./research-data.mjs";

const CANDIDATES = ["setup-room", "extension", "flow-filter", "flow-score-50", "flow-score-100"];
const DAY = 86400;

export function dateBounds(from, to) {
  const parse = (date) => {
    const timestamp = Date.parse(`${date}T00:00:00Z`) / 1000;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp) || new Date(timestamp * 1000).toISOString().slice(0, 10) !== date) throw new Error("Dates must be valid YYYY-MM-DD (UTC)");
    return timestamp;
  };
  const start = parse(from), end = parse(to);
  if (end <= start || end > Date.now() / 1000) throw new Error("Choose a completed historical date range");
  const holdoutStart = start + Math.floor((end - start) / DAY * 0.75) * DAY;
  const development = Array.from({ length: 3 }, (_, i) => [
    start + Math.floor((holdoutStart - start) / DAY * i / 3) * DAY,
    start + Math.floor((holdoutStart - start) / DAY * (i + 1) / 3) * DAY,
  ]);
  return { start, end, holdoutStart, development };
}

async function sourceHash() {
  const files = [];
  for (const dir of ["src/core", "src/constants", "src/types", "scripts"]) {
    for (const file of await readdir(dir, { recursive: true })) {
      if (/\.(ts|mjs)$/.test(file)) files.push(join(dir, file));
    }
  }
  return digest(await Promise.all(files.sort().map(async (file) => `${file}\n${await readFile(file, "utf8")}`)));
}

export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    out: { type: "string", default: "research.local/run" }, from: { type: "string" }, to: { type: "string" },
    "per-class": { type: "string" }, journal: { type: "string" }, flow: { type: "string" },
    "journal-cache": { type: "string" }, "development-only": { type: "boolean", default: false },
    "journal-only": { type: "boolean", default: false },
  } });
  const perClass = Number(values["per-class"] ?? positionals[0] ?? Infinity);
  if (!(perClass > 0) || (perClass !== Infinity && !Number.isInteger(perClass))) throw new Error("per-class must be a positive integer");
  const out = resolve(values.out);
  await mkdir(out, { recursive: true });
  // A directory is an immutable study, not a place to overwrite an inspected holdout.
  const to = values.to ?? new Date().toISOString().slice(0, 10);
  const from = values.from ?? new Date(Date.parse(to) - 360 * DAY * 1000).toISOString().slice(0, 10);
  const bounds = dateBounds(from, to);
  const protocol = {
    engine: "engine-v7", from, to, ...bounds, perClass: Number.isFinite(perClass) ? perClass : "all",
    candidates: CANDIDATES, baseline: { exitMode: "scaleOut", signalEpisodes: true, window: "60 observed exchange dates (crypto: UTC dates)" },
    thresholds: { winRateDeltaPP: 2, expectancyDeltaR: 0.05, minProfitFactor: 1.1, minRetention: 0.5 },
    sourceHash: await sourceHash(), createdAt: new Date().toISOString(),
    mode: values["journal-only"] ? "journal-audit" : "historical-experiments",
  };
  await writeJson(join(out, "protocol.json"), protocol, true);
  const server = await createServer({ appType: "custom", configFile: "vite.config.ts", logLevel: "silent", server: { middlewareMode: true, watch: null } });
  try {
    const load = (file) => server.ssrLoadModule(file);
    const [{ buildDecisionSeries, replayDecisionSeries }, { normalizeYahooCandles, closedCandlesForSignal },
      { passesEntryExperiment, cryptoFlow, entryDiagnostics, sessionStartIndices }, { rowToFollowedTrade }, { computePnl, ENTRY_BAR_TOLERANCE_MS },
      { BACKTEST_COSTS, ENGINE_VERSION }, assets, { yahooToBinancePerp }, { adaptYahooChart }] = await Promise.all([
      load("/src/core/engine/backtest.ts"), load("/src/core/market/candles.ts"), load("/src/core/engine/research.ts"),
      load("/src/core/trade/journal-mapper.ts"), load("/src/core/trade/follow-trade-model.ts"), load("/src/constants/signals.ts"),
      load("/src/constants/assets.ts"), load("/src/services/api/binance.ts"), load("/src/services/adapters/yahoo-adapter.ts"),
    ]);
    if (ENGINE_VERSION !== protocol.engine) throw new Error("Research baseline must be reviewed for the current engine version");
    let journal;
    try { journal = values["journal-cache"] ? await readJson(values["journal-cache"]) : await readJournal(values.journal); }
    catch (error) { journal = { source: "unavailable", reason: error.message, rows: [], assets: [] }; }
    const actual = journalTrades(journal.rows, { rowToFollowedTrade, computePnl, costs: BACKTEST_COSTS, entryBarToleranceMs: ENTRY_BAR_TOLERANCE_MS });
    await writeJson(join(out, "journal-source.json"), journal, true);
    if (values["journal-only"]) {
      const errors = [];
      const symbols = [...new Set(actual.trades.filter((t) => t.engineVersion === ENGINE_VERSION).map((t) => t.symbol))].sort();
      for (const [index, symbol] of symbols.entries()) {
        console.log(`[${index + 1}/${symbols.length}] journal ${symbol}`);
        try {
          let raw;
          try { raw = await fetchChart(symbol, join(out, "charts")); }
          catch (error) {
            errors.push({ symbol, error: error.message, fallback: "60d; incomplete entry history stays unavailable" });
            raw = await fetchChart(symbol, join(out, "charts"), "60d");
          }
          const candles = normalizeYahooCandles(raw.indicators.quote[0], raw.timestamp, { requirePhysical: true, requireTimestamps: true });
          reconstructJournalEntries(actual.trades.filter((t) => t.symbol === symbol), raw, candles, { sessionStartIndices, adaptYahooChart, entryDiagnostics });
        } catch (error) { errors.push({ symbol, error: error.message }); }
      }
      const report = journalAuditReport(journal, actual);
      await writeJson(join(out, "journal-audit.json"), { ...report, errors }, true);
      console.log(JSON.stringify({ versions: report.versions, diagnostics: report.diagnostics, dataFailures: errors.length }, null, 2));
      return { out, mode: "journal-audit" };
    }
    const universe = [];
    const defaults = { crypto: assets.DEFAULT_CRYPTO_TICKERS, "us-stock": assets.DEFAULT_US_STOCK_TICKERS, "id-stock": assets.DEFAULT_ID_STOCK_TICKERS, commodity: assets.DEFAULT_COMMODITY_TICKERS, forex: assets.DEFAULT_FOREX_TICKERS };
    for (const assetType of ASSET_CLASSES) {
      const configured = (journal.assets ?? []).filter((a) => a.asset_type === assetType).map((a) => a.symbol);
      const symbols = configured.length ? [...defaults[assetType].filter((s) => configured.includes(s)), ...configured] : defaults[assetType];
      for (const symbol of [...new Set(symbols)].slice(0, perClass)) universe.push({ symbol, assetType });
    }
    await writeJson(join(out, "universe.json"), universe, true);
    const snapshots = values.flow ? await readJson(values.flow) : [];
    if (!Array.isArray(snapshots)) throw new Error("Flow JSON must contain an array of timestamped snapshots");
    const history = [], coverage = [], errors = [];
    const all = Object.fromEntries(["baseline", ...CANDIDATES].map((name) => [name, []]));
    let selectedCoverageComplete = true;

    const flowProvider = (symbol) => {
      const samples = snapshots.filter((s) => s.symbol === symbol).sort((a, b) => a.availableAt - b.availableAt);
      const contract = yahooToBinancePerp(symbol);
      return (at) => {
        let low = 0, high = samples.length;
        while (low < high) { const middle = (low + high) >>> 1; if (samples[middle].availableAt <= at) low = middle + 1; else high = middle; }
        return low && contract ? cryptoFlow(samples[low - 1], symbol, contract, at) : null;
      };
    };
    const optionsFor = ({ symbol, assetType, sessionTimeZone = "UTC" }, replacement) => ({
      assetType, timeframe: "swing", includeResearchFeatures: true, lookbackSessions: 60, sessionTimeZone,
      ...(assetType === "crypto" ? { researchFlow: flowProvider(symbol) } : {}),
      ...(replacement ? { volumeReplacement: replacement } : {}),
    });
    const replay = (item, candles, decisions, name) => replayDecisionSeries(candles, decisions, {
      assetType: item.assetType, exitMode: "scaleOut", signalEpisodes: true,
      ...(CANDIDATES.slice(0, 3).includes(name) ? {
        entryFilter: ({ outlook, plan, decision }) => passesEntryExperiment(name, outlook, plan, decision.research?.flow),
      } : {}),
    }).trades.map((trade) => ({
      ...trade, ...item, engineVersion: ENGINE_VERSION, decisionClosedAt: trade.decisionTimestamp + 3600,
      diagnostics: { ...trade.research, ...excursions(trade, candles), publicationLagSeconds: null },
    }));

    for (const [index, item] of universe.entries()) {
      console.log(`[${index + 1}/${universe.length}] ${item.symbol}`);
      try {
        const raw = await fetchChart(item.symbol, join(out, "charts"));
        item.sessionTimeZone = raw.meta.exchangeTimezoneName ?? "UTC";
        const allCandles = normalizeYahooCandles(raw.indicators.quote[0], raw.timestamp, { requirePhysical: true, requireTimestamps: true });
        const candles = closedCandlesForSignal(allCandles, { interval: "1h", nowSeconds: bounds.end });
        const developmentCandles = candles.filter((c) => c.timestamp + 3600 <= bounds.holdoutStart);
        const baseline = buildDecisionSeries(developmentCandles, optionsFor(item));
        const hasFlow = baseline.some((d) => d.research.flow);
        const scored50 = hasFlow ? buildDecisionSeries(developmentCandles, optionsFor(item, 0.5)) : baseline;
        const scored100 = hasFlow ? buildDecisionSeries(developmentCandles, optionsFor(item, 1)) : baseline;
        const inDevelopment = baseline.filter((d) => d.research.decisionClosedAt >= bounds.start);
        const completeHistory = baseline.some((d) => d.research.decisionClosedAt <= bounds.start && d.research.candleCount >= 120);
        if (!completeHistory) selectedCoverageComplete = false;
        const flowDecisions = inDevelopment.filter((d) => d.research.flow).length;
        const row = { ...item, candles: candles.length, completeHistory, decisions: inDevelopment.length, flowDecisions, dataHash: digest(raw) };
        coverage.push(row);
        for (const name of Object.keys(all)) {
          const decisions = name === "flow-score-50" ? scored50 : name === "flow-score-100" ? scored100 : baseline;
          all[name].push(...replay(item, developmentCandles, decisions, name));
        }
        history.push({ ...item, candles });
        reconstructJournalEntries(actual.trades.filter((t) => t.symbol === item.symbol), raw, allCandles, { sessionStartIndices, adaptYahooChart, entryDiagnostics });
        // Check the shared adapter using the exact source payload; no fetched quote enters research decisions.
        const recent = await fetchChart(item.symbol, join(out, "charts"), "60d");
        const recentCandles = closedCandlesForSignal(normalizeYahooCandles(recent.indicators.quote[0], recent.timestamp, { requirePhysical: true }), { interval: "1h", regularSessionEnd: recent.meta.currentTradingPeriod?.regular?.end });
        const sentinel = { ...recentCandles.at(-1), timestamp: recentCandles.at(-1).timestamp + 3600 };
        const last = buildDecisionSeries([...recentCandles, sentinel], { assetType: item.assetType }).at(-1);
        row.adapterParity = JSON.stringify(last?.outlook) === JSON.stringify(adaptYahooChart(recent)?.outlook);
        if (!row.adapterParity) selectedCoverageComplete = false;
      } catch (error) { errors.push({ ...item, error: error.message }); selectedCoverageComplete = false; }
    }
    const slices = (trades) => bounds.development.flatMap(([start, end]) => windowTrades(trades, start, end));
    const baseline = slices(all.baseline);
    const development = {};
    for (const name of CANDIDATES) {
      const candidate = slices(all[name]);
      const result = compare(candidate, baseline, bounds.start, bounds.holdoutStart, ASSET_CLASSES);
      result.folds = bounds.development.map(([start, end]) => ({ start, end, baseline: aggregate(windowTrades(all.baseline, start, end)), candidate: aggregate(windowTrades(all[name], start, end)) }));
      result.gross = aggregate(candidate, { gross: true });
      result.cohorts = cohortReport(candidate).cohorts;
      const stable = result.folds.every((fold) => fold.candidate.trades && fold.candidate.winRate >= fold.baseline.winRate && fold.candidate.expectancy >= fold.baseline.expectancy);
      const missingFlow = name.startsWith("flow") && coverage.some((row) => ["crypto", "us-stock", "id-stock"].includes(row.assetType) && row.flowDecisions === 0);
      if (!selectedCoverageComplete || missingFlow) { result.status = "unproven"; result.dataLimitation = missingFlow ? "Required asset flow history unavailable" : "Incomplete price history or adapter parity"; }
      else if (!stable && result.status === "passed") result.status = "failed";
      development[name] = result;
    }
    const selected = selectCandidate(development);
    const selection = { candidate: selected, sourceHash: protocol.sourceHash, dataHash: digest(coverage), start: bounds.holdoutStart, end: bounds.end, chosenBeforeHoldout: true };
    await writeJson(join(out, "development.json"), { baseline: cohortReport(baseline), candidates: development, coverage, errors }, true);
    await writeJson(join(out, "selection.json"), selection, true);
    let holdout = { status: "unopened", reason: selected ? "Development-only run" : "No proven development candidate" };
    if (selected && !values["development-only"]) {
      await mkdir("research.local", { recursive: true });
      await claimHoldout(resolve("research.local/holdouts.json"), selection);
      const held = { baseline: [], candidate: [] };
      for (const item of history) {
        const base = buildDecisionSeries(item.candles, optionsFor(item));
        const replacement = selected === "flow-score-50" ? 0.5 : selected === "flow-score-100" ? 1 : null;
        const variant = replacement ? buildDecisionSeries(item.candles, optionsFor(item, replacement)) : base;
        held.baseline.push(...windowTrades(replay(item, item.candles, base, "baseline"), bounds.holdoutStart, bounds.end));
        held.candidate.push(...windowTrades(replay(item, item.candles, variant, selected), bounds.holdoutStart, bounds.end));
      }
      holdout = compare(held.candidate, held.baseline, bounds.holdoutStart, bounds.end, ASSET_CLASSES);
      await writeJson(join(out, "holdout-trades.json"), held, true);
    }
    const actualReport = journalAuditReport(journal, actual);
    await writeJson(join(out, "journal-audit.json"), actualReport, true);
    await writeJson(join(out, "development-trades.json"), all, true);
    await writeJson(join(out, "holdout.json"), holdout, true);
    const candidateConfig = { productionEnabled: false, candidate: selected, stage: holdout.status === "passed" ? "forward-comparison-required" : "unproven", engineVersion: ENGINE_VERSION, protocolHash: digest(protocol) };
    await writeJson(join(out, "candidate.json"), candidateConfig, true);
    const summary = [
      "# Engine research report", "", `Baseline: ${ENGINE_VERSION}, scale-out 50/30/20, signal episodes. Window: ${from} to ${to} (UTC).`,
      `Journal: ${journal.source}; ${actual.trades.length} valid completed trades, ${actual.rejected.length} rejected.`,
      `Universe: ${universe.length} symbols across all five classes; ${errors.length} data failures.`, "",
      "| Candidate | Status | Net WR | Net R/trade | 2x cost R/trade |", "|---|---|---:|---:|---:|",
      `| baseline | reference | ${aggregate(baseline).winRate.toFixed(2)}% | ${aggregate(baseline).expectancy.toFixed(3)} | ${aggregate(baseline, { costMultiplier: 2 }).expectancy.toFixed(3)} |`,
      ...Object.entries(development).map(([name, result]) => `| ${name} | ${result.status} | ${result.normal.candidate.winRate.toFixed(2)}% | ${result.normal.candidate.expectancy.toFixed(3)} | ${result.stressed.candidate.expectancy.toFixed(3)} |`), "",
      `Selected: ${selected ?? "none"}. Holdout: ${holdout.status}. Production stays unchanged.`, "",
      "Limits: current-universe survivorship; historical Yahoo revisions; OHLC cannot recover intrabar ordering; excursions are upper bounds; equal-risk basket DD is not account DD. Estimated costs exclude borrow, taxes and funding. Session windows approximate historical Yahoo payloads. Cron feed delay, schedule and reversals are not exactly reproduced by next-open execution. Missing original entry snapshots/flow remain unavailable. No forward result exists yet.",
      "", "See journal-audit.json for actual results by engine version, class, direction, regime, grade and exit reason; development.json for paired weekly bootstrap, folds, coverage and normal/double-cost comparisons.", "",
    ].join("\n");
    await writeFile(join(out, "report.md"), summary);
    console.log(summary);
    return { out, selected, holdout: holdout.status };
  } finally { await server.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
