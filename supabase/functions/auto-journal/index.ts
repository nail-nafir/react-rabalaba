/**
 * auto-journal — autonomous server-side trade journal (Supabase Edge Function).
 *
 * Triggered by pg_cron (~every 30 min), independent of any browser session:
 *   1. fetch the swing window (1mo of 1h candles) for the full universe — the
 *      SAME timeframe the app shows by default, so the journal mirrors it
 *   2. runAutoJournal() — PURE, unit-tested core (src/core/auto-journal-core):
 *      emit new long/short-with-plan signals + close open trades that hit TP/SL
 *   3. apply the resulting INSERTs / UPDATEs to journal_trades
 *
 * Engine/tracker/decision-core are the SAME pure code the app uses, bundled to
 * ./_engine.mjs by `npm run build:edge`. Writes use the service-role key
 * (bypasses RLS); Supabase auto-injects SUPABASE_URL / SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
// Bundled from src/ (pure, unit-tested).
import {
  EDGE_UNIVERSE,
  DEFAULT_COMMODITY_TICKERS,
  DEFAULT_FOREX_TICKERS,
  ALL_BENCHMARK_SYMBOLS,
  adaptYahooChart,
  buildEngineContexts,
  runAutoJournal,
  buildAutoJournalAlerts,
  formatAlertsForDiscord,
} from "./_engine.mjs";

const RANGE = "1mo";
const INTERVAL = "1h";
// Route through the app's OWN Cloudflare proxy (functions/api/yahoo) by default —
// the SAME edge/IP the browser uses, so cron and app see byte-identical data
// (single source of truth). The old direct `query1` path hit Yahoo from the
// Supabase-datacenter IP and occasionally got a corrupt candle bar, which faked
// an SL/TP touch and phantom-closed open trades. Override `YAHOO_PROXY_BASE`
// (e.g. back to the direct query1 URL) for a graceful fallback if the proxy is
// down — journaling keeps running instead of halting.
const YAHOO =
  Deno.env.get("YAHOO_PROXY_BASE") ??
  "https://rabalaba.pages.dev/api/yahoo/v8/finance/chart";
// Yahoo wants a real UA but no browser Origin/Referer (mirrors functions/api/yahoo).
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const FETCH_CONCURRENCY = 8;

async function fetchChart(symbol: string) {
  // Cache-bust + no-cache so Yahoo's CDN can't hand the cron a STALE snapshot.
  // A hours-old regularMarketPrice journals a trade off dead data (wrong
  // direction AND wrong entry); a unique query param defeats edge caching by URL.
  const url = `${YAHOO}/${encodeURIComponent(symbol)}?range=${RANGE}&interval=${INTERVAL}&includePrePost=false&_=${Date.now()}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.chart?.result?.[0] ?? null;
}

/** Fetch + adapt one symbol → UnifiedAsset. Per-symbol errors never fail the run. */
async function loadAsset(symbol: string) {
  try {
    const chart = await fetchChart(symbol);
    return chart ? adaptYahooChart(chart) : null;
  } catch (_err) {
    return null;
  }
}

/** Bounded-concurrency map so we don't fire ~114 fetches at once. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
}

/** Is the asset's market open right now? Crypto is 24/7; equities use their
 *  exchange's local session (DST-correct via Intl timeZone); forex & commodity
 *  are ~24/5 so we just skip weekends. Only consulted when market_hours_only. */
function isMarketOpen(assetType: string | null): boolean {
  if (!assetType || assetType === "crypto") return true;
  if (assetType === "us-stock")
    return isOpenInTz("America/New_York", 9 * 60 + 30, 16 * 60);
  if (assetType === "id-stock")
    return isOpenInTz("Asia/Jakarta", 9 * 60, 15 * 60);
  // forex & commodity: ~24/5 → conservative weekend skip (UTC).
  const utcDay = new Date().getUTCDay();
  return utcDay !== 0 && utcDay !== 6;
}

/** Weekday session check (open..close minutes-of-day) in an exchange timezone.
 *  Uses Intl so DST is handled automatically. */
function isOpenInTz(tz: string, openMin: number, closeMin: number): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday");
  if (weekday === "Sat" || weekday === "Sun") return false;
  const mins = Number(get("hour")) * 60 + Number(get("minute"));
  return mins >= openMin && mins < closeMin;
}

/** CORS for browser invokes (admin "Scan Sekarang"); pg_cron ignores these. */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Browser preflight (admin manual scan). pg_cron sends POST and skips this.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return jsonResponse({ error: "Missing SUPABASE_URL / SERVICE_ROLE_KEY" }, 500);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  // Manual on-demand run from the admin UI sends { force: true }: it bypasses the
  // DUE gate (runs regardless of interval) but still respects pause. Admin-gated
  // here because a full scan is expensive and may broadcast to Discord.
  const { force } = (await req.json().catch(() => ({}))) as { force?: boolean };
  if (force) {
    const userClient = createClient(
      url,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
        auth: { persistSession: false },
      },
    );
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const { data: profile } = await db
      .from("profiles")
      .select("is_admin")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!(profile as { is_admin?: boolean } | null)?.is_admin) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
  }

  // ── Schedule gate (journal_settings — admin-editable, data-driven) ──
  // The cron ticks at a fixed BASE cadence (*/15); we decide HERE whether this
  // tick should actually run, honoring the admin's pause flag + interval. So
  // changing the cadence or pausing is pure data — no cron edit, no redeploy.
  // (null settings = pre-migration → behave as before: always run.)
  const { data: settings } = await db
    .from("journal_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (settings) {
    // Pause is honored even for a manual force run (admin must enable first).
    if (!settings.enabled) {
      return jsonResponse({ ok: true, skipped: "disabled" });
    }
    // The interval/due-gate only applies to automated ticks; a manual force run
    // scans immediately regardless of when the last run was.
    if (!force) {
      const lastRun = settings.last_run_at
        ? Date.parse(settings.last_run_at)
        : 0;
      const dueMs = settings.interval_minutes * 60_000;
      // 60s grace so a tick landing slightly early still counts as due.
      if (Date.now() - lastRun < dueMs - 60_000) {
        const nextInMin = Math.ceil((dueMs - (Date.now() - lastRun)) / 60_000);
        return jsonResponse({
          ok: true,
          skipped: "not-due",
          next_in_min: nextInMin,
        });
      }
    }
  }
  const marketHoursOnly = settings?.market_hours_only ?? false;

  // Currently-open trades — both the dedup set and the sync targets.
  const { data: openRows, error: openErr } = await db
    .from("journal_trades")
    .select("*")
    .eq("status", "open");
  if (openErr) return jsonResponse({ error: openErr.message }, 500);

  // Recently-closed trades — feed the re-entry cooldown so a just-stopped
  // symbol+direction isn't re-taken immediately. Window must cover the core's
  // REENTRY_COOLDOWN_MS (6h, see auto-journal-core).
  const cooldownCutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: recentClosed } = await db
    .from("journal_trades")
    .select("symbol,signal,closed_at")
    .neq("status", "open")
    .gte("closed_at", cooldownCutoff);

  // Universe is DATA-DRIVEN for crypto/US/ID stocks: the active rows in
  // journal_assets (managed via the in-app admin UI) — adding/removing a symbol
  // needs NO redeploy. Commodity & forex are CONSTANT-driven (not the DB
  // universe) and appended below, deduped. null data = table unreadable/missing
  // (e.g. before the read policy is applied) → bundled EDGE_UNIVERSE fallback
  // (which already includes commodity/forex). An empty [] = admin paused every
  // stock/crypto → still journals commodity/forex (the constant base), nothing more.
  const { data: assetRows } = await db
    .from("journal_assets")
    .select("symbol, asset_type")
    .eq("active", true);
  let universeRows: { symbol: string; asset_type: string | null }[];
  if (assetRows == null) {
    universeRows = EDGE_UNIVERSE.map((symbol) => ({ symbol, asset_type: null }));
  } else {
    const constantRows = [
      ...DEFAULT_COMMODITY_TICKERS.map((symbol) => ({
        symbol,
        asset_type: "commodity",
      })),
      ...DEFAULT_FOREX_TICKERS.map((symbol) => ({ symbol, asset_type: "forex" })),
    ];
    const seen = new Set<string>();
    universeRows = [
      ...(assetRows as { symbol: string; asset_type: string | null }[]),
      ...constantRows,
    ].filter((r) => {
      if (seen.has(r.symbol)) return false;
      seen.add(r.symbol);
      return true;
    });
  }
  // When market_hours_only, drop symbols whose exchange is currently closed —
  // also dodges journaling equities off a stale weekend/overnight last price.
  if (marketHoursOnly) {
    universeRows = universeRows.filter((r) => isMarketOpen(r.asset_type));
  }
  const universe: string[] = universeRows.map((r) => r.symbol);
  const universeSet = new Set(universe);

  // Context/benchmark symbols (BTC / IHSG+USDIDR / S&P+VIX+DXY) drive the
  // top-down de-rate so each asset is judged against its OWN index. Some are
  // already journaled (BTC, USDIDR); the rest (^JKSE, ^GSPC, ^VIX, DX-Y.NYB) are
  // CONTEXT-ONLY — fetched for the regime read but never journaled themselves.
  const contextOnly = ALL_BENCHMARK_SYMBOLS.filter(
    (s: string) => !universeSet.has(s),
  );

  // Fetch + adapt the universe + context-only symbols (batched, fault-tolerant).
  const fetched = (
    await mapPool([...universe, ...contextOnly], FETCH_CONCURRENCY, loadAsset)
  ).filter((a) => a != null);
  const assetBySymbol = new Map(fetched.map((a) => [a.symbol, a]));

  // Only the journaled universe is eligible for emit/sync; context-only
  // benchmarks are excluded so an index can never become a journaled trade.
  const assets = fetched.filter((a) => universeSet.has(a.symbol));

  // Top-down contexts, computed once (same derive* the app uses).
  const contexts = buildEngineContexts(assetBySymbol);

  // Pure decision core (unit-tested): what to INSERT and what to CLOSE.
  const { inserts, closures } = runAutoJournal(assets, openRows ?? [], {
    recentClosed: recentClosed ?? [],
    contexts,
  });

  // Apply EMITs. 23505 = an overlapping run already inserted → non-fatal.
  let emitted = 0;
  let emitError: string | null = null;
  if (inserts.length > 0) {
    const { error } = await db.from("journal_trades").insert(inserts);
    if (error && error.code !== "23505") emitError = error.message;
    else emitted = inserts.length;
  }

  // Apply CLOSEs.
  let closed = 0;
  for (const c of closures) {
    const { error } = await db
      .from("journal_trades")
      .update({
        status: c.status,
        close_price: c.close_price,
        closed_at: c.closed_at,
        highest_tp_reached: c.highest_tp_reached,
        reversed: c.reversed ?? false,
      })
      .eq("id", c.id);
    if (!error) closed++;
  }

  // Broadcast alerts to Discord (GoTrade-style: new signal / TP / SL). Best
  // effort — a webhook failure must NEVER fail the journal run, and an unset
  // DISCORD_WEBHOOK_URL simply means alerts are off (no-op).
  let alerted = 0;
  try {
    const alerts = buildAutoJournalAlerts({ inserts, closures });
    const message = formatAlertsForDiscord(alerts);
    if (message && (await sendDiscord(message))) alerted = alerts.length;
  } catch (_err) {
    // swallow — alerts are non-critical
  }

  // Stamp the run so the interval clock advances (only reached when due + ran).
  await db
    .from("journal_settings")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", true);

  return jsonResponse({
    ok: emitError == null,
    forced: force === true,
    universe: universe.length,
    fetched: assets.length,
    open_before: (openRows ?? []).length,
    emitted,
    closed,
    alerted,
    ...(emitError ? { emitError } : {}),
  });
});

/** POST a plain-content message to the configured Discord webhook. Returns true
 *  on success. No webhook configured → returns false (alerts simply off). */
async function sendDiscord(content: string): Promise<boolean> {
  const webhook = Deno.env.get("DISCORD_WEBHOOK_URL");
  if (!webhook) return false;
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
    return res.ok;
  } catch (_err) {
    return false;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
