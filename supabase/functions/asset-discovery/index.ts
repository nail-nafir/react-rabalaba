/**
 * asset-discovery — autonomous universe curation (Supabase Edge Function).
 *
 * Triggered by pg_cron once a day (see schedule-asset-discovery.sql), or on
 * demand from the admin UI with { force: true }:
 *   1. fetch the trending / high-volume feeds: CoinGecko trending, Binance
 *      futures 24h volume, Yahoo day_gainers + most_actives, and the Yahoo
 *      custom screener for IDX most-actives
 *   2. rank/filter/dedup via the PURE, unit-tested core
 *      (src/core/asset-discovery-core) — crypto bases are resolved to REAL
 *      Yahoo tickers via search + name match (PEPE-USD is PEPEGOLD; the real
 *      Pepe is PEPE24478-USD), then every new candidate must round-trip a
 *      1mo/1h chart with ≥ MIN_CANDLES bars so the signal engine can actually
 *      work it on the very next auto-journal run
 *   3. apply the plan to journal_assets: INSERT new auto assets (active,
 *      source='auto'), refresh/reactivate rediscovered ones, PRUNE stale ones
 *      — admin rows are NEVER touched (every UPDATE carries source='auto')
 *
 * Config is data-driven on the journal_settings singleton (discovery_enabled /
 * discovery_max_per_market / discovery_prune_days) — admin-editable, no
 * redeploy. Writes use the service-role key (bypasses RLS).
 */
import { createClient } from "@supabase/supabase-js";
// Bundled from src/ (pure, unit-tested).
import {
  adaptYahooChart,
  normalizeYahooCandles,
  parseCgTrending,
  parseBinance24h,
  parseYahooScreener,
  parseYahooSearch,
  rankCryptoCandidates,
  rankUsCandidates,
  rankIdCandidates,
  pickYahooCryptoSymbol,
  dedupeCandidates,
  planDiscovery,
  formatDiscoveryForDiscord,
} from "./_engine.mjs";

const RANGE = "1mo";
const INTERVAL = "1h";
// Broader than auto-journal's YAHOO_PROXY_BASE: discovery goes through the
// app's Cloudflare proxies for ALL THREE upstreams (yahoo/coingecko/binance),
// same edge + caching + crumb handling the browser uses. Override for a
// graceful fallback if the proxy is down.
const PROXY_BASE =
  Deno.env.get("DISCOVERY_PROXY_BASE") ?? "https://rabalaba.pages.dev/api";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
/** Engine readiness bar = the swing profile's minCandles: an asset admitted
 *  with fewer 1h bars couldn't produce a signal anyway (fresh listings out). */
const MIN_CANDLES = 120;
/** Hard ceiling on ACTIVE auto rows — bounds the auto-journal fetch load no
 *  matter what the feeds do (each active row = one Yahoo fetch per 30min). */
const MAX_AUTO_ACTIVE = Number(Deno.env.get("DISCOVERY_MAX_AUTO_ACTIVE") ?? 60);
/** CoinGecko price vs resolved Yahoo chart price may differ this much before
 *  we call it a wrong-coin resolution and skip (belt-and-braces after the
 *  search name match). */
const PRICE_DIVERGENCE_MAX = 0.3;
/** How many rows to pull from each screener feed. */
const FEED_COUNT = 25;

/** The verified Yahoo custom-screener request for IDX most-actives (the
 *  predefined screeners ignore region; trending/ID is empty). Needs the
 *  cookie+crumb the CF yahoo proxy attaches to /finance/screener paths. */
const IDX_SCREENER_BODY = {
  size: FEED_COUNT,
  offset: 0,
  sortField: "dayvolume",
  sortType: "DESC",
  quoteType: "EQUITY",
  query: { operator: "and", operands: [{ operator: "eq", operands: ["region", "id"] }] },
  userId: "",
  userIdType: "guid",
};

type DiscoveryMarket = "crypto" | "us-stock" | "id-stock";

interface RawCandidateLite {
  market: DiscoveryMarket;
  query: string;
  name: string | null;
  reason: string;
  sourcePriceUsd?: number;
}

interface ValidatedLite {
  symbol: string;
  name: string | null;
  assetType: DiscoveryMarket;
  reason: string;
}

/** GET/POST JSON with a real UA; any failure → null (a dead feed marks its
 *  market as failed instead of throwing the whole run). */
async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "User-Agent": UA, ...(init?.headers ?? {}) },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchChart(symbol: string) {
  // Cache-bust + no-cache, mirroring auto-journal: a stale cached chart could
  // admit an asset off dead data.
  const url = `${PROXY_BASE}/yahoo/v8/finance/chart/${encodeURIComponent(symbol)}?range=${RANGE}&interval=${INTERVAL}&includePrePost=false&_=${Date.now()}`;
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

/** The quality bar every NEW candidate must clear before entering the
 *  universe: chart resolves, asset_type matches the market it was discovered
 *  for (auto-rejects commodity/forex and any mis-typed resolution), enough
 *  1h history for the engine, and a sane price. */
async function validateChart(symbol: string, market: DiscoveryMarket) {
  try {
    const chart = await fetchChart(symbol);
    const asset = chart ? adaptYahooChart(chart) : null;
    if (!asset) return null;
    if (asset.assetType !== market) return null;
    const candles = asset.quoteIndicators
      ? normalizeYahooCandles(asset.quoteIndicators, asset.timestamps)
      : [];
    if (candles.length < MIN_CANDLES) return null;
    if (!Number.isFinite(asset.price) || asset.price <= 0) return null;
    return asset;
  } catch {
    return null;
  }
}

/** Walk one market's candidates in rank order, validating until the cap is
 *  filled. Sequential WITHIN a market (rank order + early stop keeps the
 *  fetch budget tight); the three markets run in parallel. */
async function validateMarket(
  candidates: RawCandidateLite[],
  market: DiscoveryMarket,
  cap: number,
): Promise<{ validated: ValidatedLite[]; failed: number }> {
  const validated: ValidatedLite[] = [];
  let failed = 0;
  for (const c of candidates) {
    if (validated.length >= cap) break;
    let symbol = c.query;
    let name = c.name;
    if (market === "crypto") {
      // Resolve the bare base to a REAL Yahoo ticker (the PEPE defense).
      const search = parseYahooSearch(
        await fetchJson(
          `${PROXY_BASE}/yahoo/v1/finance/search?q=${encodeURIComponent(c.query)}&quotesCount=8&newsCount=0`,
        ),
      );
      const resolved = search
        ? pickYahooCryptoSymbol(c.query, c.name, search)
        : null;
      if (!resolved) {
        failed++;
        continue;
      }
      symbol = resolved;
    }
    const asset = await validateChart(symbol, market);
    if (!asset) {
      failed++;
      continue;
    }
    if (
      market === "crypto" &&
      c.sourcePriceUsd != null &&
      c.sourcePriceUsd > 0 &&
      Math.abs(asset.price - c.sourcePriceUsd) / c.sourcePriceUsd >
        PRICE_DIVERGENCE_MAX
    ) {
      // Price nowhere near the source's → we resolved a DIFFERENT coin.
      failed++;
      continue;
    }
    if (typeof asset.name === "string" && asset.name.length > 0) {
      name = asset.name;
    }
    validated.push({ symbol: asset.symbol ?? symbol, name, assetType: market, reason: c.reason });
  }
  return { validated, failed };
}

/** CORS for browser invokes (admin "Discover Now"); pg_cron ignores these. */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return jsonResponse({ error: "Missing SUPABASE_URL / SERVICE_ROLE_KEY" }, 500);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  // Manual on-demand run from the admin UI sends { force: true }: it bypasses
  // the once-per-day gate but still respects the pause flag. Admin-gated here
  // because a run fetches external feeds and may broadcast to Discord.
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

  // ── Settings gate (journal_settings singleton — admin-editable) ──
  // discovery_enabled defaults FALSE: deploying + scheduling this function
  // does nothing until the admin flips the toggle. Pause is honored even for
  // a manual force run (the UI disables the button too). Missing row/columns
  // (pre-migration) read as disabled — safe rollout order either way.
  const { data: settings } = await db
    .from("journal_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  const s = settings as {
    discovery_enabled?: boolean;
    discovery_max_per_market?: number;
    discovery_prune_days?: number;
  } | null;
  if (!s?.discovery_enabled) {
    return jsonResponse({ ok: true, skipped: "disabled" });
  }
  const maxPerMarket = s.discovery_max_per_market ?? 5;
  const pruneDays = s.discovery_prune_days ?? 14;

  // Automated tick: atomic once-per-WIB-day claim (same pattern as
  // daily-summary). The conditional UPDATE flips the stamp past today's WIB
  // midnight and returns the row only to the FIRST caller — a duplicate cron
  // tick or retried net.http_post re-evaluates the WHERE and bails.
  if (!force) {
    const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // WIB = UTC+7, no DST
    const wib = new Date(Date.now() + WIB_OFFSET_MS);
    const dayMidnightIso = new Date(
      Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) -
        WIB_OFFSET_MS,
    ).toISOString();
    const { data: claimed } = await db
      .from("journal_settings")
      .update({ discovery_last_run_at: new Date().toISOString() })
      .eq("id", true)
      .or(
        `discovery_last_run_at.is.null,discovery_last_run_at.lt.${dayMidnightIso}`,
      )
      .select("id");
    if (!claimed || claimed.length === 0) {
      return jsonResponse({ ok: true, skipped: "already-ran" });
    }
  }

  // ── Fetch the source feeds (each independently fault-tolerant) ──
  const [cgTrending, binance24h, dayGainers, mostActives, idxActives] =
    await Promise.all([
      fetchJson(`${PROXY_BASE}/coingecko/api/v3/search/trending`).then(
        parseCgTrending,
      ),
      fetchJson(`${PROXY_BASE}/binance/fapi/v1/ticker/24hr`).then(
        parseBinance24h,
      ),
      fetchJson(
        `${PROXY_BASE}/yahoo/v1/finance/screener/predefined/saved?scrIds=day_gainers&count=${FEED_COUNT}`,
      ).then(parseYahooScreener),
      fetchJson(
        `${PROXY_BASE}/yahoo/v1/finance/screener/predefined/saved?scrIds=most_actives&count=${FEED_COUNT}`,
      ).then(parseYahooScreener),
      fetchJson(`${PROXY_BASE}/yahoo/v1/finance/screener?lang=en-US&region=ID`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(IDX_SCREENER_BODY),
      }).then(parseYahooScreener),
    ]);

  // A market whose feeds ALL failed is excluded from pruning this run — a
  // dead feed must not slowly drain that market's book.
  const marketFailed: Record<DiscoveryMarket, boolean> = {
    crypto: cgTrending == null && binance24h == null,
    "us-stock": dayGainers == null && mostActives == null,
    "id-stock": idxActives == null,
  };
  const prunableMarkets = (
    Object.keys(marketFailed) as DiscoveryMarket[]
  ).filter((m) => !marketFailed[m]);
  const skippedMarkets = (
    Object.keys(marketFailed) as DiscoveryMarket[]
  ).filter((m) => marketFailed[m]);

  // ── Current universe + open trades (prune protection) ──
  const { data: assetRows, error: assetsErr } = await db
    .from("journal_assets")
    .select("symbol, source, active, asset_type, last_discovered_at");
  if (assetsErr || assetRows == null) {
    return jsonResponse(
      { error: assetsErr?.message ?? "journal_assets unreadable" },
      500,
    );
  }
  const existing = assetRows as {
    symbol: string;
    source: string;
    active: boolean;
    asset_type: string | null;
    last_discovered_at: string | null;
  }[];
  const { data: openRows } = await db
    .from("journal_trades")
    .select("symbol")
    .eq("status", "open");
  const openTradeSymbols = [
    ...new Set(((openRows ?? []) as { symbol: string }[]).map((r) => r.symbol)),
  ];

  // ── Rank (pure) → dedup vs universe (pure) → resolve + validate (I/O) ──
  // rank* gets a generous shortlist (4× cap) so dedup attrition doesn't
  // starve validation; dedupeCandidates then caps toValidate at 2× cap.
  const shortlist = maxPerMarket * 4;
  const raw: RawCandidateLite[] = [
    ...rankCryptoCandidates({ cgTrending, binance24h, shortlist }),
    ...rankUsCandidates({ dayGainers, mostActives, shortlist }),
    ...rankIdCandidates({ mostActives: idxActives, shortlist }),
  ];
  const { toValidate, refresh, reactivate } = dedupeCandidates({
    raw,
    existing,
    maxPerMarket,
  });

  const markets: DiscoveryMarket[] = ["crypto", "us-stock", "id-stock"];
  const results = await Promise.all(
    markets.map((m) =>
      validateMarket(
        toValidate.filter((c: RawCandidateLite) => c.market === m),
        m,
        maxPerMarket,
      ),
    ),
  );
  const validated = results.flatMap((r) => r.validated);
  const validatedFailed = results.reduce((sum, r) => sum + r.failed, 0);

  // ── Final plan (pure) + DB writes (guards re-asserted in every WHERE) ──
  const nowIso = new Date().toISOString();
  const plan = planDiscovery({
    validated,
    refresh,
    reactivate,
    existing,
    openTradeSymbols,
    nowIso,
    pruneDays,
    maxPerMarket,
    maxAutoActive: MAX_AUTO_ACTIVE,
    prunableMarkets,
  });

  let writeError: string | null = null;
  const noteError = (message: string | undefined) => {
    if (message && !writeError) writeError = message;
  };

  let added = 0;
  if (plan.inserts.length > 0) {
    // upsert-ignore: race-safe against a concurrent admin add of the same
    // symbol — the existing (admin) row wins and stays untouched.
    const { error } = await db
      .from("journal_assets")
      .upsert(plan.inserts, { onConflict: "symbol", ignoreDuplicates: true });
    if (error) noteError(error.message);
    else added = plan.inserts.length;
  }
  if (plan.reactivate.length > 0) {
    const { error } = await db
      .from("journal_assets")
      .update({ active: true, last_discovered_at: nowIso })
      .in("symbol", plan.reactivate)
      .eq("source", "auto");
    if (error) noteError(error.message);
  }
  if (plan.refresh.length > 0) {
    const { error } = await db
      .from("journal_assets")
      .update({ last_discovered_at: nowIso })
      .in("symbol", plan.refresh)
      .eq("source", "auto");
    if (error) noteError(error.message);
  }
  if (plan.prune.length > 0) {
    const { error } = await db
      .from("journal_assets")
      .update({ active: false })
      .in("symbol", plan.prune)
      .eq("source", "auto")
      .eq("active", true);
    if (error) noteError(error.message);
  }

  // Broadcast to Discord — best effort, never fails the run.
  try {
    const message = formatDiscoveryForDiscord(plan);
    if (message) await sendDiscord(message);
  } catch {
    // swallow — alerts are non-critical
  }

  // Force runs stamp on completion (automated runs claimed the stamp up top).
  if (force) {
    await db
      .from("journal_settings")
      .update({ discovery_last_run_at: new Date().toISOString() })
      .eq("id", true);
  }

  const activeAutoBefore = existing.filter(
    (a) => a.source === "auto" && a.active,
  ).length;
  return jsonResponse({
    ok: writeError == null,
    forced: force === true,
    added,
    reactivated: plan.reactivate.length,
    refreshed: plan.refresh.length,
    pruned: plan.prune.length,
    validated_failed: validatedFailed,
    skipped_markets: skippedMarkets,
    auto_active_total:
      activeAutoBefore + added + plan.reactivate.length - plan.prune.length,
    ...(writeError ? { writeError } : {}),
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
  } catch {
    return false;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
