/**
 * daily-summary — end-of-day Discord recap of the auto-journal (Supabase Edge
 * Function), a sibling to auto-journal/index.ts.
 *
 * Triggered by pg_cron hourly (at :00). Each tick it reads the SAME singleton
 * journal_settings row and decides whether to send the recap: it fires once per
 * send day, at/after the admin-configured WIB hour (daily_summary_hour). The
 * recap summarizes the WIB calendar day ENDING at the send time — so hour 0
 * (midnight) sends at 00:00 WIB and recaps the FULL previous day, while hour 23
 * recaps today up to 23:00. Changing the hour or pausing is pure data, no cron
 * edit, no redeploy (same spirit as auto-journal's interval gate). The recap
 * covers trades CLOSED today (win-rate, total/avg P&L, best & worst), signals
 * EMITTED today, and still-OPEN positions with live floating P&L.
 *
 * Pure formatting (formatDailySummaryForDiscord) + P&L (computePnl) + the Yahoo
 * adapter are the SAME code the app uses, bundled to ./_engine.mjs by
 * `npm run build:edge`.
 */
import { createClient } from "@supabase/supabase-js";
import {
  adaptYahooChart,
  computePnl,
  formatDailySummaryForDiscord,
} from "./_engine.mjs";

const RANGE = "5d";
const INTERVAL = "1h";
// Indonesia (WIB) is a fixed UTC+7 with no DST — a constant offset is exact.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

// Same Cloudflare proxy / single-source-of-truth path as the auto-journal cron.
const YAHOO =
  Deno.env.get("YAHOO_PROXY_BASE") ??
  "https://rabalaba.pages.dev/api/yahoo/v8/finance/chart";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const FETCH_CONCURRENCY = 8;

async function fetchChart(symbol: string) {
  const url = `${YAHOO}/${encodeURIComponent(symbol)}?range=${RANGE}&interval=${INTERVAL}&includePrePost=false&_=${Date.now()}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Cache-Control": "no-cache", Pragma: "no-cache" },
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

/** Bounded-concurrency map so we don't fire many fetches at once. */
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface TradeRow {
  id: string;
  symbol: string;
  signal: "long" | "short";
  grade: string | null;
  status: string;
  reversed: boolean | null;
  entry_price: number;
  stop_loss: number;
  take_profits: number[] | null;
  highest_tp_reached: number;
  close_price: number | null;
  opened_at: string;
  closed_at: string | null;
}

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

  // Manual on-demand recap from the admin UI sends { force: true }: bypasses the
  // hour/dedup gate (sends immediately) but still respects the enabled flag.
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

  // ── Settings gate (same singleton row as auto-journal) ──
  const { data: settings } = await db
    .from("journal_settings")
    .select("daily_summary_enabled, daily_summary_hour, daily_summary_last_sent_at")
    .eq("id", true)
    .maybeSingle();
  const s = settings as {
    daily_summary_enabled?: boolean;
    daily_summary_hour?: number;
    daily_summary_last_sent_at?: string | null;
  } | null;

  if (!s?.daily_summary_enabled) {
    return jsonResponse({ ok: true, skipped: "disabled" });
  }

  // WIB day boundary: floor "now" to WIB midnight, expressed back as a UTC instant.
  const nowMs = Date.now();
  const wib = new Date(nowMs + WIB_OFFSET_MS);
  const wibHour = wib.getUTCHours();
  // Dedup key: WIB-midnight of the SEND day (now) — one recap per send day.
  const sendDayMidnightUtcMs =
    Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) -
    WIB_OFFSET_MS;
  // Report window = the WIB CALENDAR DAY that is ending at the send time. Take
  // the day of (now − 10 min) so a 00:00 send recaps the FULL previous day
  // (midnight is the new day's start), while a 23:00 send recaps today. The
  // 10-min back-off absorbs cron/cold-start lag without crossing an hour. Bounds
  // are the report day's own midnights (NOT `now`), so the window is exact
  // regardless of when within the hour the tick actually lands.
  const reportRefMs = nowMs - 10 * 60_000;
  const reportRef = new Date(reportRefMs + WIB_OFFSET_MS);
  const reportMidnightUtcMs =
    Date.UTC(
      reportRef.getUTCFullYear(),
      reportRef.getUTCMonth(),
      reportRef.getUTCDate(),
    ) - WIB_OFFSET_MS;
  const cutoffIso = new Date(reportMidnightUtcMs).toISOString();
  const reportEndIso = new Date(
    reportMidnightUtcMs + 24 * 60 * 60 * 1000,
  ).toISOString();
  const targetHour = s.daily_summary_hour ?? 23;
  const lastSentMs = s.daily_summary_last_sent_at
    ? Date.parse(s.daily_summary_last_sent_at)
    : 0;
  const alreadySentToday = lastSentMs >= sendDayMidnightUtcMs;

  // Automated tick: fire only DURING the configured WIB hour (exact match, one
  // hourly tick), once per send day. Exact (not >=) so targetHour 0 means
  // "midnight" — it fires at the 00:00 tick recapping the previous day, instead
  // of firing immediately whenever enabled. (A missed cron tick at exactly that
  // hour skips the day; pg_cron is reliable enough that this is acceptable.)
  if (!force) {
    if (wibHour !== targetHour) {
      return jsonResponse({ ok: true, skipped: "not-yet", wib_hour: wibHour });
    }
    if (alreadySentToday) {
      return jsonResponse({ ok: true, skipped: "already-sent" });
    }
  }

  // Trades CLOSED and OPENED within the report day's [midnight, midnight) window.
  const cols =
    "id,symbol,signal,grade,status,reversed,entry_price,stop_loss,take_profits,highest_tp_reached,close_price,opened_at,closed_at";
  const { data: closedRows } = await db
    .from("journal_trades")
    .select(cols)
    .neq("status", "open")
    .gte("closed_at", cutoffIso)
    .lt("closed_at", reportEndIso);
  const { data: emittedRows } = await db
    .from("journal_trades")
    .select(cols)
    .gte("opened_at", cutoffIso)
    .lt("opened_at", reportEndIso);
  const { data: openRows } = await db
    .from("journal_trades")
    .select(cols)
    .eq("status", "open");

  const closedT = (closedRows ?? []) as TradeRow[];
  const emittedT = (emittedRows ?? []) as TradeRow[];
  const openT = (openRows ?? []) as TradeRow[];

  // Live prices for open positions → floating P&L. A symbol that fails to fetch
  // simply shows without a %, never failing the recap.
  const priceBySymbol = new Map<string, number>();
  if (openT.length > 0) {
    const symbols = [...new Set(openT.map((r) => r.symbol))];
    const assets = (await mapPool(symbols, FETCH_CONCURRENCY, loadAsset)).filter(
      (a) => a != null,
    );
    for (const a of assets) {
      if (typeof a.price === "number" && Number.isFinite(a.price)) {
        priceBySymbol.set(a.symbol, a.price);
      }
    }
  }

  const realizedPct = (r: TradeRow): number =>
    computePnl(
      { signal: r.signal, entryPrice: r.entry_price, stopLoss: r.stop_loss },
      r.close_price ?? r.entry_price,
    ).pct;

  // Report-day date as dd-MM-yyyy (e.g. 29-06-2026) — the day being summarized,
  // which for a 00:00 send is yesterday.
  const dp = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date(reportRefMs));
  const dpart = (type: string) => dp.find((p) => p.type === type)?.value ?? "";
  const dateLabel = `${dpart("day")}-${dpart("month")}-${dpart("year")}`;

  const summary = formatDailySummaryForDiscord({
    dateLabel,
    closed: closedT.map((r) => ({
      symbol: r.symbol,
      signal: r.signal,
      grade: r.grade,
      status: r.status,
      reversed: r.reversed ?? false,
      tpReached: r.highest_tp_reached,
      tpTotal: r.take_profits?.length,
      pnlPct: realizedPct(r),
      durationMs:
        r.closed_at != null
          ? Date.parse(r.closed_at) - Date.parse(r.opened_at)
          : undefined,
    })),
    emitted: emittedT.map((r) => ({
      symbol: r.symbol,
      signal: r.signal,
      grade: r.grade,
    })),
    open: openT.map((r) => {
      const price = priceBySymbol.get(r.symbol);
      return {
        symbol: r.symbol,
        signal: r.signal,
        grade: r.grade,
        floatingPct:
          price != null
            ? computePnl(
                {
                  signal: r.signal,
                  entryPrice: r.entry_price,
                  stopLoss: r.stop_loss,
                },
                price,
              ).pct
            : undefined,
      };
    }),
  });

  // Empty day → mark done (don't re-check). Otherwise POST, stamp only on success
  // so an unset/failing webhook is retried on the next tick.
  let sent = false;
  if (summary == null) {
    sent = true;
  } else {
    sent = await sendDiscord(summary);
  }
  if (sent) {
    await db
      .from("journal_settings")
      .update({ daily_summary_last_sent_at: new Date().toISOString() })
      .eq("id", true);
  }

  return jsonResponse({
    ok: true,
    forced: force === true,
    sent,
    empty: summary == null,
    closed: closedT.length,
    emitted: emittedT.length,
    open: openT.length,
  });
});

/** POST a plain-content message to the configured Discord webhook (reuses the
 *  SAME DISCORD_WEBHOOK_URL as auto-journal). No webhook → false (recap off). */
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
