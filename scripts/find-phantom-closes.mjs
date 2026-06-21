/**
 * find-phantom-closes.mjs — READ-ONLY report that separates PHANTOM auto-journal
 * closes (transient bad Yahoo candle faked an SL/TP touch) from LEGITIMATE ones
 * (a real SL hit, a real final-TP win, or a real signal reversal). See the
 * auto-journal phantom-close investigation.
 *
 * Two-stage classification per closed row:
 *
 *   STAGE 1 — replay the REAL 1h candles (via the app's clean CF proxy), only the
 *   bars with `timestamp <= closed_at`, and ask: did the adverse extreme (low for
 *   a long / high for a short) EVER cross the SL before the close?
 *     - status `sl`            + SL never touched          => PHANTOM (unambiguous)
 *     - status `tp{all}` reached (final TP)                => WIN     (legit)
 *     - SL touched before close                            => LEGIT
 *     - status `reversed` (no-TP reversal) + no SL touch   => REVERSAL (legit by
 *                                                             design — reversal is
 *                                                             a valid exit trigger)
 *     - status `tp{n}` (n<all) + SL never touched          => needs STAGE 2
 *
 *   STAGE 2 — a secured-TP close with no SL touch is EITHER a phantom (bad-bar SL
 *   touch that the clean data no longer shows) OR a legit reversal-after-TP. The
 *   only thing that tells them apart is whether the engine SIGNAL had actually
 *   flipped at close time — which isn't stored. So we RE-RUN the same engine
 *   (`adaptYahooChart`) on the candles truncated to `closed_at` and read the
 *   signal:
 *     - signal === opposite side  => REVERSAL  (legit secured win — keep)
 *     - signal same / neutral     => PHANTOM   (no reversal + no SL touch → the
 *                                               close had no valid basis)
 *     - not enough history        => SUSPECT   (can't decide — left for eyeball)
 *
 * It NEVER writes. It prints a verdict table + a `delete from journal_trades
 * where id in (...)` containing ONLY the rows it can prove are PHANTOM. Run that
 * in the Supabase SQL Editor (deletes need the service role — kept human-driven).
 *
 * Run:
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-or-secret-key> node scripts/find-phantom-closes.mjs
 *
 * Env:
 *   SUPABASE_SERVICE_ROLE_KEY  required — read bypasses the premium RLS
 *   SUPABASE_URL               optional — defaults to VITE_SUPABASE_URL in .env
 *   YAHOO_PROXY_BASE           optional — defaults to the app's CF proxy
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createServer } from "vite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROXY =
  process.env.YAHOO_PROXY_BASE ??
  "https://rabalaba.pages.dev/api/yahoo/v8/finance/chart";

function fromDotEnv(key) {
  try {
    const txt = readFileSync(join(ROOT, ".env"), "utf8");
    const line = txt.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() : undefined;
  } catch {
    return undefined;
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? fromDotEnv("VITE_SUPABASE_URL");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing config. Need SUPABASE_SERVICE_ROLE_KEY (env) and SUPABASE_URL (env or .env VITE_SUPABASE_URL).",
  );
  process.exit(1);
}

// Load the REAL engine through Vite SSR so @-aliases + current source resolve
// (mirrors tests/*.test.mjs). Used only to recompute the signal at close time.
const vite = await createServer({
  appType: "custom",
  configFile: "vite.config.ts",
  logLevel: "silent",
  server: { middlewareMode: true },
});
const { adaptYahooChart } = await vite.ssrLoadModule(
  "/src/services/adapters/yahoo-adapter.ts",
);

async function fetchClosedRows() {
  const url = `${SUPABASE_URL}/rest/v1/journal_trades?status=neq.open&select=id,symbol,signal,status,entry_price,stop_loss,take_profits,highest_tp_reached,opened_at,closed_at,close_price&order=closed_at.desc`;
  const res = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase read ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Raw Yahoo chart result (meta + timestamp + indicators) via the clean proxy. */
async function fetchChart(symbol) {
  const url = `${PROXY}/${encodeURIComponent(symbol)}?range=1mo&interval=1h&includePrePost=false&_=${Date.now()}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", "Cache-Control": "no-cache" },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.chart?.result?.[0] ?? null;
}

/** Slice a chart result down to the bars at/under cutoffMs (the cron's view at
 *  close time). regularMarketPrice/Time are reset to that last bar so the engine
 *  reads it as the as-of-close snapshot. */
function truncateChart(raw, cutoffMs) {
  const ts = raw.timestamp ?? [];
  const q = raw.indicators?.quote?.[0] ?? {};
  const keep = [];
  for (let i = 0; i < ts.length; i++) if (ts[i] * 1000 <= cutoffMs) keep.push(i);
  if (keep.length < 30) return null; // too little history to trust the signal
  const pick = (arr) => keep.map((i) => arr?.[i]);
  const lastClose = q.close?.[keep[keep.length - 1]];
  return {
    ...raw,
    timestamp: keep.map((i) => ts[i]),
    indicators: {
      quote: [
        {
          open: pick(q.open),
          high: pick(q.high),
          low: pick(q.low),
          close: pick(q.close),
          volume: pick(q.volume),
        },
      ],
    },
    meta: {
      ...raw.meta,
      regularMarketPrice: lastClose ?? raw.meta?.regularMarketPrice,
      regularMarketTime: Math.floor(cutoffMs / 1000),
    },
  };
}

const opposite = (s) => (s === "long" ? "short" : s === "short" ? "long" : null);

/** Returns the engine signal ("long"/"short"/"neutral") as of closed_at, or null. */
function signalAtClose(raw, closedAt) {
  const t = truncateChart(raw, closedAt);
  if (!t) return null;
  try {
    return adaptYahooChart(t)?.outlook?.signal ?? null;
  } catch {
    return null;
  }
}

function classify(row, raw) {
  const isLong = row.signal === "long";
  const sl = Number(row.stop_loss);
  const tps = (row.take_profits ?? []).map(Number);
  const openedAt = Date.parse(row.opened_at);
  const closedAt = Date.parse(row.closed_at);
  const finalIdx = tps.length;

  if (!raw?.timestamp?.length)
    return { verdict: "UNKNOWN", note: "no candle data", ext: null, slHit: null, sig: null };

  const q = raw.indicators?.quote?.[0] ?? {};
  const bars = raw.timestamp
    .map((t, i) => ({ t: t * 1000, high: q.high?.[i], low: q.low?.[i] }))
    .filter((c) => Number.isFinite(c.high) && Number.isFinite(c.low));

  const window = bars.filter((c) => c.t >= openedAt && c.t <= closedAt);
  if (window.length === 0)
    return { verdict: "UNKNOWN", note: "history too short for window", ext: null, slHit: null, sig: null };
  if (bars[0].t > openedAt + 60 * 60 * 1000)
    return { verdict: "UNKNOWN", note: "candles start after entry (gap unobserved)", ext: null, slHit: null, sig: null };

  let ext = isLong ? Infinity : -Infinity;
  let tpReached = 0;
  for (const c of window) {
    const adverse = isLong ? c.low : c.high;
    const favor = isLong ? c.high : c.low;
    ext = isLong ? Math.min(ext, adverse) : Math.max(ext, adverse);
    let n = 0;
    for (let i = 0; i < tps.length; i++) {
      if (isLong ? favor >= tps[i] : favor <= tps[i]) n = i + 1;
      else break;
    }
    if (n > tpReached) tpReached = n;
  }
  const slHit = isLong ? ext <= sl : ext >= sl;

  if (row.status === `tp${finalIdx}` && finalIdx > 0 && tpReached >= finalIdx)
    return { verdict: "WIN", note: "final TP reached", ext, slHit, sig: null };
  if (slHit)
    return { verdict: "LEGIT", note: "SL touched before close", ext, slHit, sig: null };
  if (row.status === "sl")
    return { verdict: "PHANTOM", note: "status sl but SL never touched", ext, slHit, sig: null };
  // 'reversed' (current) or legacy 'manual' (pre-migration rows): a no-TP reversal.
  if (row.status === "reversed" || row.status === "manual")
    return { verdict: "REVERSAL", note: "reversal close, no TP (legit by design)", ext, slHit, sig: null };

  // Secured-TP close, SL never touched → decide by the signal at close time.
  const sig = signalAtClose(raw, closedAt);
  if (sig == null)
    return { verdict: "SUSPECT", note: "tp close, no SL touch, signal undecidable", ext, slHit, sig };
  if (sig === opposite(row.signal))
    return { verdict: "REVERSAL", note: `secured-TP on real reversal (signal=${sig})`, ext, slHit, sig };
  return { verdict: "PHANTOM", note: `tp close, no SL touch, no reversal (signal=${sig})`, ext, slHit, sig };
}

const f = (n) => (n == null ? "—" : Number(n).toPrecision(6));

const rows = await fetchClosedRows();
console.log(`Scanning ${rows.length} closed trades via ${PROXY}\n`);

const results = [];
for (const row of rows) {
  const raw = await fetchChart(row.symbol);
  const c = classify(row, raw);
  results.push({ row, ...c });
  console.log(
    `[${c.verdict.padEnd(8)}] ${row.symbol.padEnd(16)} ${row.signal.padEnd(5)} ${String(row.status).padEnd(6)} ` +
      `SL=${f(row.stop_loss)} ext=${f(c.ext)} slHit=${c.slHit} sig=${c.sig ?? "—"} — ${c.note}`,
  );
}

await vite.close();

const count = (v) => results.filter((r) => r.verdict === v).length;
console.log(
  `\n${count("PHANTOM")} PHANTOM, ${count("REVERSAL")} REVERSAL, ${count("WIN")} WIN, ` +
    `${count("LEGIT")} LEGIT, ${count("SUSPECT")} SUSPECT(undecided), ${count("UNKNOWN")} UNKNOWN`,
);

const phantoms = results.filter((r) => r.verdict === "PHANTOM");
if (phantoms.length) {
  console.log(
    "\n-- PROVEN PHANTOM (no SL touch + no reversal). Safe to delete in Supabase SQL Editor:",
  );
  // Comma BEFORE the `--` comment (a trailing comma would be swallowed by the
  // line comment and break the IN-list), none on the last row.
  console.log(
    `delete from journal_trades where id in (\n${phantoms
      .map(
        (r, i) =>
          `  '${r.row.id}'${i < phantoms.length - 1 ? "," : " "} -- ${r.row.symbol} ${r.row.status}`,
      )
      .join("\n")}\n);`,
  );
} else {
  console.log("\nNo proven phantom closes. ✅");
}

// Backfill the `reversed` flag (migration 20260621000001) on rows closed BEFORE
// the column existed, so the journal shows "TP{n}/{total} · Reversed" for them.
const reversals = results.filter((r) => r.verdict === "REVERSAL");
if (reversals.length) {
  console.log(
    `\n-- BACKFILL ${reversals.length} reversal closes (run AFTER migration 20260621000001):`,
  );
  console.log(
    `update journal_trades set reversed = true where id in (\n${reversals
      .map(
        (r, i) =>
          `  '${r.row.id}'${i < reversals.length - 1 ? "," : " "} -- ${r.row.symbol} ${r.row.status}`,
      )
      .join("\n")}\n);`,
  );
}

const undecided = results.filter((r) => r.verdict === "SUSPECT");
if (undecided.length) {
  console.log(
    `\n-- ${undecided.length} SUSPECT (couldn't recompute signal — eyeball before any delete):`,
  );
  for (const r of undecided)
    console.log(`   ${r.row.symbol} ${r.row.status}  id=${r.row.id}`);
}
