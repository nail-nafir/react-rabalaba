/** Free official Binance archives. No exchange credentials or production writes. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify, parseArgs } from "node:util";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { writeJson, digest } from "./research-data.mjs";

const unzip = promisify(execFile);
const DAY = 86400;

export function parseArchiveCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift()?.split(",");
  if (!headers?.length || new Set(headers).size !== headers.length) throw new Error("Invalid archive header");
  return lines.map((line) => {
    const fields = line.split(",");
    // Official metric/kline fields are unquoted scalars; reject unexpected CSV dialects.
    if (fields.length !== headers.length || line.includes('"')) throw new Error("Invalid archive CSV row");
    return Object.fromEntries(headers.map((key, i) => [key, fields[i]]));
  });
}

export function buildCryptoSnapshots(symbol, contract, metrics, prices, funding, from, to) {
  const oi = new Map(), px = new Map();
  for (const row of metrics) {
    const at = Date.parse(row.create_time.replace(" ", "T") + "Z") / 1000;
    if (row.symbol !== contract || !Number.isFinite(at) || !(Number(row.sum_open_interest) > 0) || oi.has(at)) throw new Error("Invalid or duplicate OI observation");
    oi.set(at, row);
  }
  for (const row of prices) {
    const at = Number(row.open_time) / 1000;
    if (!Number.isInteger(at) || !(Number(row.open) > 0) || px.has(at)) throw new Error("Invalid or duplicate price observation");
    px.set(at, Number(row.open));
  }
  const rates = funding.map((row) => ({ at: Math.floor(Number(row.calc_time) / 1000), interval: Number(row.funding_interval_hours), rate: Number(row.last_funding_rate) })).sort((a, b) => a.at - b.at);
  if (rates.some((r, i) => ![r.at, r.interval, r.rate].every(Number.isFinite) || r.interval <= 0 || r.interval > 24 || (i > 0 && r.at === rates[i - 1].at))) throw new Error("Invalid funding observations");
  const snapshots = [];
  let rateIndex = -1;
  for (let at = Math.ceil(from / 3600) * 3600; at < to; at += 3600) {
    const previous = oi.get(at - DAY), current = oi.get(at);
    if (!previous || !current || !px.has(at - DAY) || !px.has(at)) continue;
    while (rateIndex + 1 < rates.length && rates[rateIndex + 1].at <= at) rateIndex++;
    const rate = rates[rateIndex];
    const ratio = Number(current.count_long_short_ratio);
    snapshots.push({
      symbol, contract, venue: "binance-usdm", startAt: at - DAY, endAt: at,
      // Model a full hour of publication delay; original REST arrival times were not archived.
      availableAt: at + 3600,
      openInterestStart: Number(previous.sum_open_interest), openInterestEnd: Number(current.sum_open_interest),
      priceStart: px.get(at - DAY), priceEnd: px.get(at),
      ...(ratio > 0 && Number.isFinite(ratio) ? { longShortRatio: ratio, longShortAt: at } : {}),
      ...(rate && at - rate.at <= rate.interval * 3600 ? { fundingRate: rate.rate, fundingAt: rate.at, fundingIntervalHours: rate.interval } : {}),
    });
  }
  return snapshots;
}

async function archiveCsv(path, cache) {
  const file = join(cache, path.replaceAll("/", "_"));
  const url = `https://data.binance.vision/data/futures/um/${path}`;
  let bytes;
  try { bytes = await readFile(file); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Archive HTTP ${response.status}: ${path}`);
    bytes = Buffer.from(await response.arrayBuffer());
    const checksum = await fetch(`${url}.CHECKSUM`, { signal: AbortSignal.timeout(20000) });
    if (!checksum.ok || (await checksum.text()).trim().split(/\s+/)[0] !== digest(bytes)) throw new Error(`Archive checksum failed: ${path}`);
    await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
  }
  const { stdout } = await unzip("unzip", ["-p", file], { maxBuffer: 8 * 1024 * 1024 });
  return parseArchiveCsv(stdout);
}

export async function collect(args = process.argv.slice(2)) {
  const { values } = parseArgs({ args, options: {
    symbols: { type: "string", default: "BTC-USD,ETH-USD,BNB-USD,SOL-USD,XRP-USD" },
    from: { type: "string" }, to: { type: "string" },
    out: { type: "string", default: "research.local/crypto-flow.json" },
    cache: { type: "string", default: "research.local/binance" },
  } });
  const from = Date.parse(`${values.from}T00:00:00Z`) / 1000, to = Date.parse(`${values.to}T00:00:00Z`) / 1000;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to > Date.now() / 1000) throw new Error("Supply valid past --from/--to UTC dates");
  const cache = resolve(values.cache);
  await mkdir(cache, { recursive: true });
  const vite = await createServer({ appType: "custom", configFile: "vite.config.ts", logLevel: "silent", server: { middlewareMode: true, watch: null } });
  const coverage = [], output = [];
  try {
    const { yahooToBinancePerp } = await vite.ssrLoadModule("/src/services/api/binance.ts");
    for (const symbol of values.symbols.split(",")) {
      const contract = yahooToBinancePerp(symbol);
      if (!contract) throw new Error(`Unmapped crypto symbol: ${symbol}`);
      const metrics = [], prices = [], funding = [], errors = [];
      const days = [], months = new Set();
      for (let at = from - DAY; at < to; at += DAY) {
        const date = new Date(at * 1000).toISOString().slice(0, 10);
        days.push([date, at]); months.add(date.slice(0, 7));
      }
      const tasks = days.map(([date, at]) => async () => {
        const rows = await archiveCsv(`daily/metrics/${contract}/${contract}-metrics-${date}.zip`, cache);
        if (rows.some((row) => { const t = Date.parse(row.create_time?.replace(" ", "T") + "Z") / 1000; return !(t >= at && t < at + DAY); })) throw new Error(`Metrics timestamps outside ${date}`);
        metrics.push(...rows);
      });
      for (const month of months) {
        tasks.push(async () => prices.push(...await archiveCsv(`monthly/klines/${contract}/1h/${contract}-1h-${month}.zip`, cache)));
        tasks.push(async () => funding.push(...await archiveCsv(`monthly/fundingRate/${contract}/${contract}-fundingRate-${month}.zip`, cache)));
      }
      let next = 0, finished = 0;
      await Promise.all(Array.from({ length: 4 }, async () => {
        while (next < tasks.length) {
          const task = tasks[next++];
          try { await task(); } catch (error) { errors.push(error.message); }
          finished++;
          if (finished % 60 === 0) console.log(`${symbol}: ${finished}/${tasks.length} archive files checked`);
        }
      }));
      const snapshots = buildCryptoSnapshots(symbol, contract, metrics, prices, funding, from, to);
      output.push(...snapshots);
      coverage.push({ symbol, contract, snapshots: snapshots.length, expectedHours: (to - from) / 3600, errors });
      console.log(`${symbol}: ${snapshots.length} aligned snapshots; ${errors.length} unavailable files`);
    }
    await writeJson(values.out, output, true);
    await writeJson(`${values.out}.coverage.json`, { from, to, coverage, dataHash: digest(output), publicationPolicy: "REST observation time + 1h; historical arrival time unavailable. Archive release time is not the observation time. Must verify in forward recording before production." }, true);
    return coverage;
  } finally { await vite.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  collect().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
