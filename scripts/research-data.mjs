import { readFile, writeFile, mkdir, open, unlink, rename } from "node:fs/promises";
import { parseEnv } from "node:util";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { cohortReport } from "./research-metrics.mjs";

export const ASSET_CLASSES = ["crypto", "us-stock", "id-stock", "commodity", "forex"];
export const digest = (value) => createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest("hex");
export const json = (value) => JSON.stringify(value, (_, v) => v === Infinity ? "Infinity" : v === -Infinity ? "-Infinity" : v, 2) + "\n";
export async function readJson(path) { return JSON.parse(await readFile(path, "utf8")); }
export async function writeJson(path, value, exclusive = false) {
  await writeFile(path, json(value), { flag: exclusive ? "wx" : "w", mode: 0o600 });
}

async function getJson(url, headers) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Read failed: HTTP ${response.status} (${new URL(url).host})`);
  return response.json();
}

export async function readJournal(file) {
  if (file) {
    const rows = await readJson(file);
    if (!Array.isArray(rows)) throw new Error("Journal JSON must be an array of journal_trades rows");
    return { source: "export", rows, assets: [] };
  }
  let local = {};
  try { local = parseEnv(await readFile("supabase/functions/.env", "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const url = process.env.SUPABASE_URL ?? local.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? local.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { source: "unavailable", reason: "No configured read access or --journal export", rows: [], assets: [] };
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const rows = [];
  // Stable ID pagination, with an upper bound so newly created records cannot extend the scan.
  const fetchedAt = new Date().toISOString();
  let after = "";
  for (;;) {
    const query = new URLSearchParams({ select: "*", status: "neq.open", created_at: `lte.${fetchedAt}`, order: "id.asc", limit: "1000" });
    if (after) query.set("id", `gt.${after}`);
    const batch = await getJson(`${url}/rest/v1/journal_trades?${query}`, headers);
    if (!Array.isArray(batch)) throw new Error("Invalid journal response");
    rows.push(...batch);
    if (batch.length < 1000) break;
    if (!batch.at(-1)?.id || batch.at(-1).id === after) throw new Error("Journal pagination did not advance");
    after = batch.at(-1).id;
  }
  const assets = await getJson(`${url}/rest/v1/journal_assets?select=symbol,asset_type&active=eq.true&order=symbol.asc&limit=1000`, headers);
  return { source: "supabase-read-only", fetchedAt, rows, assets };
}

const rowSchema = z.object({
  id: z.string().min(1), symbol: z.string().min(1), asset_type: z.enum(ASSET_CLASSES), signal: z.enum(["long", "short"]),
  entry_price: z.number().positive(), stop_loss: z.number().positive(), close_price: z.number().positive(),
  take_profits: z.array(z.number().positive()), highest_tp_reached: z.number().int().nonnegative(),
  opened_at: z.iso.datetime({ offset: true }), closed_at: z.iso.datetime({ offset: true }),
  created_at: z.iso.datetime({ offset: true }), status: z.string(),
}).passthrough();

export function journalTrades(rows, { rowToFollowedTrade, computePnl, costs, entryBarToleranceMs = 0 }) {
  const trades = [], rejected = [];
  const seen = new Set();
  for (const raw of rows) {
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) { rejected.push({ id: raw?.id, reason: "Missing or invalid journal fields" }); continue; }
    const row = parsed.data;
    const risk = Math.abs(row.entry_price - row.stop_loss);
    const openedAt = Date.parse(row.opened_at), closedAt = Date.parse(row.closed_at);
    // Journal closes identify the containing candle; a tolerated entry may be seconds after its open.
    if (seen.has(row.id) || row.status === "open" || risk <= 0 || closedAt + entryBarToleranceMs < openedAt) {
      rejected.push({ id: row.id, reason: "Duplicate, unfinished, invalid risk or timestamps" }); continue;
    }
    seen.add(row.id);
    const trade = rowToFollowedTrade(row);
    const grossR = computePnl(trade, row.close_price).r;
    const direction = row.signal === "long" ? 1 : -1;
    const blendedExit = row.entry_price + direction * grossR * risk;
    const cost = row.asset_type === "crypto" ? costs.crypto : costs.default;
    const r = grossR - (row.entry_price + blendedExit) * (cost.fee + cost.slippage) / risk;
    const decisionClosedAt = Date.parse(row.decision_candle_closed_at) / 1000;
    const lag = Date.parse(row.created_at) / 1000 - decisionClosedAt;
    trades.push({
      id: row.id, symbol: row.symbol, assetType: row.asset_type, direction: row.signal,
      engineVersion: row.engine_version ?? "unavailable", regime: row.regime ?? "unavailable", tier: row.grade ?? "unavailable",
      exitReason: row.exit_reason ?? "unavailable", entryPrice: row.entry_price, exitPrice: blendedExit, initialStop: row.stop_loss,
      decisionTimestamp: Date.parse(row.decision_candle_open_at) / 1000 || null,
      decisionClosedAt: Number.isFinite(decisionClosedAt) ? decisionClosedAt : null,
      entryTimestamp: openedAt / 1000, exitTimestamp: Math.max(closedAt, openedAt) / 1000,
      recordedExitTimestamp: closedAt / 1000,
      grossR, r,
      diagnostics: { publicationLagSeconds: Number.isFinite(lag) && lag >= 0 ? lag : null, extensionAtr: null, structureRoomR: null, mfeRUpperBound: null, maeRUpperBound: null },
    });
  }
  return { trades, rejected };
}

export async function fetchChart(symbol, directory, range = "730d") {
  const file = join(directory, `${encodeURIComponent(symbol)}-${range}.json`);
  try { return await readJson(file); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const proxy = process.env.YAHOO_PROXY_BASE ?? "https://rabalaba.pages.dev/api/yahoo/v8/finance/chart";
  const body = await getJson(`${proxy}/${encodeURIComponent(symbol)}?range=${range}&interval=1h&includePrePost=false`);
  const raw = body?.chart?.result?.[0];
  if (!raw?.timestamp?.length || !raw?.indicators?.quote?.[0]) throw new Error(`No valid Yahoo chart for ${symbol}`);
  if (raw.meta?.symbol?.toUpperCase() !== symbol.toUpperCase()) throw new Error(`Yahoo symbol mismatch for ${symbol}`);
  await mkdir(directory, { recursive: true });
  await writeJson(file, raw, true);
  return raw;
}

export function excursions(trade, candles) {
  const risk = trade.research?.initialRisk ?? Math.abs(trade.entryPrice - trade.initialStop);
  const bars = candles.filter((c) => c.timestamp + 3600 > trade.entryTimestamp && c.timestamp <= trade.exitTimestamp);
  if (!(risk > 0) || !bars.length || bars[0].timestamp > trade.entryTimestamp || bars.at(-1).timestamp + 3600 < trade.exitTimestamp) {
    return { mfeRUpperBound: null, maeRUpperBound: null };
  }
  const high = Math.max(...bars.map((c) => c.high)), low = Math.min(...bars.map((c) => c.low));
  // Exit-bar ordering is unknown: these are bar-envelope bounds, not exact excursions.
  return trade.direction === "long"
    ? { mfeRUpperBound: Math.max(0, high - trade.entryPrice) / risk, maeRUpperBound: Math.max(0, trade.entryPrice - low) / risk }
    : { mfeRUpperBound: Math.max(0, trade.entryPrice - low) / risk, maeRUpperBound: Math.max(0, high - trade.entryPrice) / risk };
}

export function reconstructJournalEntries(trades, raw, candles, { sessionStartIndices, adaptYahooChart, entryDiagnostics }) {
  const starts = sessionStartIndices(candles, raw.meta.exchangeTimezoneName ?? "UTC");
  const indices = new Map(candles.map((c, i) => [c.timestamp, i]));
  for (const trade of trades) {
    trade.diagnostics = { ...trade.diagnostics, ...excursions(trade, candles) };
    const index = indices.get(trade.decisionTimestamp);
    if (index == null || trade.engineVersion !== "engine-v7") continue;
    const session = starts.findLastIndex((start) => start <= index);
    if (session < 59) continue;
    const window = candles.slice(starts[session - 59], index + 1);
    const last = window.at(-1);
    const chart = {
      meta: { ...raw.meta, range: "60d", dataGranularity: "1h", regularMarketPrice: last.close, regularMarketTime: last.timestamp + 3600, currentTradingPeriod: undefined },
      timestamp: window.map((c) => c.timestamp),
      indicators: { quote: [Object.fromEntries(["open", "high", "low", "close", "volume"].map((key) => [key, window.map((c) => c[key])]))] },
    };
    const outlook = adaptYahooChart(chart)?.outlook;
    if (outlook?.dataQuality.ready) Object.assign(trade.diagnostics,
      entryDiagnostics({ ...outlook, signal: trade.direction }, { entry: trade.entryPrice, stopLoss: trade.initialStop }),
      { entrySource: "reconstructed-current-history" });
  }
}

export function journalAuditReport(journal, actual) {
  const versions = Object.fromEntries([...new Set(actual.trades.map((t) => t.engineVersion))].map((version) => [version, cohortReport(actual.trades.filter((t) => t.engineVersion === version))]));
  const current = actual.trades.filter((t) => t.engineVersion === "engine-v7");
  const diagnostics = Object.fromEntries(["publicationLagSeconds", "extensionAtr", "structureRoomR", "mfeRUpperBound", "maeRUpperBound"].map((key) => {
    const values = current.map((t) => t.diagnostics[key]).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    return [key, { available: values.length, unavailable: current.length - values.length, median: values[Math.floor(values.length / 2)] ?? null, p90: values[Math.floor(values.length * 0.9)] ?? null }];
  }));
  const buckets = {
    roomBelow1R: current.filter((t) => t.diagnostics.structureRoomR != null && t.diagnostics.structureRoomR < 1),
    roomAtLeast1R: current.filter((t) => t.diagnostics.structureRoomR >= 1),
    extensionAbove2ATR: current.filter((t) => t.diagnostics.extensionAtr > 2),
    extensionAtMost2ATR: current.filter((t) => t.diagnostics.extensionAtr != null && t.diagnostics.extensionAtr <= 2),
    publishedAfter15Minutes: current.filter((t) => t.diagnostics.publicationLagSeconds > 900),
  };
  return {
    source: journal.source, reason: journal.reason, fetchedAt: journal.fetchedAt,
    ...actual, report: cohortReport(actual.trades), versions, diagnostics,
    currentEngineEntryBuckets: Object.fromEntries(Object.entries(buckets).map(([name, rows]) => [name, cohortReport(rows)])),
  };
}

/** A consumed holdout cannot be used to select another candidate, even in a new output folder. */
export async function claimHoldout(ledgerPath, selection) {
  const lock = await open(`${ledgerPath}.lock`, "wx", 0o600);
  try {
  let ledger = [];
  try { ledger = await readJson(ledgerPath); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (ledger.some((run) => selection.start < run.end && selection.end > run.start)) {
    throw new Error("This holdout overlaps an already opened holdout; reserve new future data");
  }
  await writeJson(`${ledgerPath}.next`, [...ledger, selection], true);
  await rename(`${ledgerPath}.next`, ledgerPath);
  } finally {
    await lock.close();
    await unlink(`${ledgerPath}.lock`);
  }
}
