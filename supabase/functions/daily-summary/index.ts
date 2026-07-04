/**
 * daily-summary — periodic Discord recaps of the auto-journal (Supabase Edge
 * Function), a sibling to auto-journal/index.ts. One function, THREE recap
 * kinds riding the same hourly pg_cron tick:
 *
 *   daily   — the WIB calendar day ending at the send time (hour 0 = full
 *             previous day, hour 23 = today up to 23:00)
 *   weekly  — the Monday-start WIB week, sent on its last WIB day (with hour 0
 *             that is Monday 00:00, recapping the FULL completed week)
 *   monthly — the WIB calendar month, sent on its last WIB day (hour 0 = the
 *             1st at 00:00, recapping the FULL completed month)
 *
 * Each tick reads the SAME singleton journal_settings row: per-kind enable
 * flags (daily/weekly/monthly_summary_enabled), one shared send hour
 * (daily_summary_hour) and per-kind atomic send-once stamps. Changing any of
 * it is pure data — no cron edit, no redeploy. Window math is the PURE
 * recapWindow (src/core/period-summary, unit-tested); formatting
 * (formatDailySummaryForDiscord) + P&L (computePnl) + the Yahoo adapter are
 * the SAME code the app uses, bundled to ./_engine.mjs by `npm run build:edge`.
 */
import { createClient } from "@supabase/supabase-js";
import {
  adaptYahooChart,
  computePnl,
  formatDailySummaryForDiscord,
  recapWindow,
} from "./_engine.mjs";

const RANGE = "5d";
const INTERVAL = "1h";
// Indonesia (WIB) is a fixed UTC+7 with no DST — a constant offset is exact.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Same Cloudflare proxy / single-source-of-truth path as the auto-journal cron.
const YAHOO =
  Deno.env.get("YAHOO_PROXY_BASE") ??
  "https://rabalaba.pages.dev/api/yahoo/v8/finance/chart";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const FETCH_CONCURRENCY = 8;

type RecapKind = "daily" | "weekly" | "monthly";

const KINDS: RecapKind[] = ["daily", "weekly", "monthly"];

/** journal_settings column names per recap kind. */
const KIND_COLUMNS: Record<RecapKind, { enabled: string; stamp: string }> = {
  daily: {
    enabled: "daily_summary_enabled",
    stamp: "daily_summary_last_sent_at",
  },
  weekly: {
    enabled: "weekly_summary_enabled",
    stamp: "weekly_summary_last_sent_at",
  },
  monthly: {
    enabled: "monthly_summary_enabled",
    stamp: "monthly_summary_last_sent_at",
  },
};

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
  } catch {
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

/** WIB date as dd-MM-yyyy (e.g. 29-06-2026). */
function wibDayLabel(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")}`;
}

/** Header qualifier + period label per kind — the formatter renders it as
 *  "🗓️ REKAP {label}", so daily stays the bare date (unchanged look) while
 *  weekly/monthly read "REKAP MINGGUAN {start} s/d {end}" / "REKAP BULANAN JUNI 2026". */
function recapLabel(
  kind: RecapKind,
  refMs: number,
  startMs: number,
  endMs: number,
): string {
  if (kind === "daily") return wibDayLabel(refMs);
  if (kind === "weekly") {
    return `MINGGUAN ${wibDayLabel(startMs)} s/d ${wibDayLabel(endMs - DAY_MS)}`;
  }
  const month = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    month: "long",
    year: "numeric",
  }).format(new Date(startMs));
  return `BULANAN ${month.toUpperCase()}`;
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

  // Manual on-demand recap sends { force: true, kind?: "daily"|"weekly"|"monthly" }:
  // bypasses the hour/dedup gate (sends that kind immediately, covering the
  // period IN PROGRESS) but still respects that kind's enabled flag.
  const body = (await req.json().catch(() => ({}))) as {
    force?: boolean;
    kind?: string;
  };
  const force = body.force === true;
  const forceKind: RecapKind =
    body.kind === "weekly" || body.kind === "monthly" ? body.kind : "daily";
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
    .select("*")
    .eq("id", true)
    .maybeSingle();
  const s = (settings ?? {}) as Record<string, unknown>;
  const isEnabled = (kind: RecapKind) => s[KIND_COLUMNS[kind].enabled] === true;
  const prevStamp = (kind: RecapKind) =>
    (s[KIND_COLUMNS[kind].stamp] as string | null | undefined) ?? null;

  if (force ? !isEnabled(forceKind) : !KINDS.some(isEnabled)) {
    return jsonResponse({ ok: true, skipped: "disabled" });
  }

  // WIB clock refs — identical to the original daily math. The report window
  // is anchored to (now − 10 min) so an hour-0 send resolves to the period
  // that JUST ended; the 10-min back-off absorbs cron/cold-start lag.
  const nowMs = Date.now();
  const wib = new Date(nowMs + WIB_OFFSET_MS);
  const wibHour = wib.getUTCHours();
  const sendDayMidnightIso = new Date(
    Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) -
      WIB_OFFSET_MS,
  ).toISOString();
  const reportRefMs = nowMs - 10 * 60_000;
  const targetHour = (s.daily_summary_hour as number | undefined) ?? 23;

  // ── Which recap kinds fire on THIS tick ──
  // Automated tick: only DURING the configured WIB hour (exact match, one
  // hourly tick), each kind only on its period's last WIB day, each claimed
  // atomically on its OWN stamp so a duplicate tick can never double-send and
  // one kind's claim never blocks another's.
  interface DueRecap {
    kind: RecapKind;
    startMs: number;
    endMs: number;
  }
  const due: DueRecap[] = [];
  if (force) {
    const w = recapWindow(forceKind, reportRefMs);
    due.push({ kind: forceKind, startMs: w.startMs, endMs: w.endMs });
  } else {
    if (wibHour !== targetHour) {
      return jsonResponse({ ok: true, skipped: "not-yet", wib_hour: wibHour });
    }
    for (const kind of KINDS) {
      if (!isEnabled(kind)) continue;
      const w = recapWindow(kind, reportRefMs);
      if (!w.isSendDay) continue;
      // Atomic send-once claim (same pattern as before, per-kind column): the
      // conditional UPDATE flips the stamp past the send-day boundary and
      // returns the row only to the FIRST caller. Runs BEFORE the slow Yahoo
      // fetch + Discord POST; a failed send releases it below.
      const stampCol = KIND_COLUMNS[kind].stamp;
      const { data: claimed } = await db
        .from("journal_settings")
        .update({ [stampCol]: new Date().toISOString() })
        .eq("id", true)
        .or(`${stampCol}.is.null,${stampCol}.lt.${sendDayMidnightIso}`)
        .select("id");
      if (claimed && claimed.length > 0) {
        due.push({ kind, startMs: w.startMs, endMs: w.endMs });
      }
    }
    if (due.length === 0) {
      return jsonResponse({ ok: true, skipped: "already-sent" });
    }
  }

  // ── Shared state: open positions + live prices, fetched ONCE per tick ──
  const cols =
    "id,symbol,signal,grade,status,reversed,entry_price,stop_loss,take_profits,highest_tp_reached,close_price,opened_at,closed_at";
  const { data: openRows } = await db
    .from("journal_trades")
    .select(cols)
    .eq("status", "open");
  const openT = (openRows ?? []) as TradeRow[];

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

  const openInput = openT.map((r) => {
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
  });

  // ── Build + send each due recap (sequential; one failure never blocks the rest) ──
  const results: Record<string, unknown>[] = [];
  for (const item of due) {
    const startIso = new Date(item.startMs).toISOString();
    const endIso = new Date(item.endMs).toISOString();
    const { data: closedRows } = await db
      .from("journal_trades")
      .select(cols)
      .neq("status", "open")
      .gte("closed_at", startIso)
      .lt("closed_at", endIso);
    const { data: emittedRows } = await db
      .from("journal_trades")
      .select(cols)
      .gte("opened_at", startIso)
      .lt("opened_at", endIso);
    const closedT = (closedRows ?? []) as TradeRow[];
    const emittedT = (emittedRows ?? []) as TradeRow[];

    const summary = formatDailySummaryForDiscord({
      dateLabel: recapLabel(item.kind, reportRefMs, item.startMs, item.endMs),
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
      open: openInput,
    });

    // Empty period → nothing to POST (the claim already marked it done).
    const sent = summary == null ? true : await sendDiscord(summary);
    const stampCol = KIND_COLUMNS[item.kind].stamp;
    if (force) {
      // The force path skips the claim above (admin "send now"), so stamp on
      // success here to keep the automated tick's dedup honest.
      if (sent) {
        await db
          .from("journal_settings")
          .update({ [stampCol]: new Date().toISOString() })
          .eq("id", true);
      }
    } else if (!sent) {
      // Non-force: the claim already stamped now(). A failed webhook releases
      // it (restore the previous stamp) so the next hourly tick retries.
      await db
        .from("journal_settings")
        .update({ [stampCol]: prevStamp(item.kind) })
        .eq("id", true);
    }

    results.push({
      kind: item.kind,
      sent,
      empty: summary == null,
      closed: closedT.length,
      emitted: emittedT.length,
      open: openT.length,
    });
  }

  return jsonResponse({ ok: true, forced: force, results });
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
