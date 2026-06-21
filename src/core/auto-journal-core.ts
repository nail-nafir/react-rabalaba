/**
 * Pure decision core for the auto-journal cron. Given freshly-fetched assets
 * and the currently-open journal rows, it decides what to INSERT (new
 * emissions) and what to CLOSE (open trades that hit TP/SL) — NO fetch, NO DB,
 * so it is fully unit-testable. The Deno edge function just wires fetch + DB
 * I/O around this, and the Vite app shares the very same engine underneath.
 */
import type { UnifiedAsset } from "@/types/asset";
import {
  buildFollowedTrade,
  applyPriceSync,
  type FollowCandle,
} from "@/features/follow-trade/lib/follow-trade-model";
import { normalizeYahooCandles } from "@/services/adapters/yahoo-candles";
import {
  followedTradeToInsert,
  rowToFollowedTrade,
} from "@/services/supabase/journal-mapper";
import type {
  JournalTradeRow,
  JournalTradeInsert,
} from "@/services/supabase/database.types";

/** A terminal-level hit → fields to UPDATE on the existing open row. */
export interface JournalClosure {
  id: string;
  /** Ticker of the closed trade — carried for alerts/logging (the DB UPDATE
   *  keys off `id` and ignores this). */
  symbol: string;
  status: string;
  close_price: number | null;
  closed_at: string;
  highest_tp_reached: number;
}

export interface AutoJournalPlan {
  inserts: JournalTradeInsert[];
  closures: JournalClosure[];
}

/** Minimal shape of a recently-closed row needed for the re-entry cooldown. */
export interface RecentClose {
  symbol: string;
  signal: string;
  closed_at: string | null;
}

export interface RunAutoJournalOptions {
  /** Wall-clock "now" in ms. Default Date.now(); injectable for tests. */
  now?: number;
  /** Recently-closed trades, used to enforce the re-entry cooldown. */
  recentClosed?: RecentClose[];
}

/** A quote older than this is STALE — a hours-old cached/forward-filled snapshot,
 *  not a live tick. The cron must skip it so it never journals/syncs off stale
 *  prices (wrong direction, wrong entry, or a phantom TP/SL). ~1.5× the 1h candle. */
const QUOTE_MAX_AGE_MS = 90 * 60 * 1000;
/** After a trade closes, don't re-take the SAME symbol+direction within this
 *  window — the thesis just played out; wait for a genuinely new setup. A flip
 *  to the OPPOSITE side is still allowed immediately (different direction key). */
const REENTRY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** Stale-quote guard for ALL asset types (not just crypto): a stale price in any
 *  market can manufacture a phantom TP/SL on sync or a wrong-direction emit. When a
 *  market is legitimately closed (equities overnight, forex weekend) its quote ages
 *  out → we skip it that cycle and the trade stays open, which is the safe failure
 *  direction. No timestamp → can't judge → treat as fresh so assets without a
 *  quoteTime still flow through. */
function isStaleQuote(asset: UnifiedAsset, now: number): boolean {
  if (typeof asset.quoteTime !== "number") return false; // no timestamp → can't judge
  return now - asset.quoteTime > QUOTE_MAX_AGE_MS;
}

export function runAutoJournal(
  assets: UnifiedAsset[],
  openRows: JournalTradeRow[],
  options: RunAutoJournalOptions = {},
): AutoJournalPlan {
  const now = options.now ?? Date.now();
  const openSymbols = new Set(openRows.map((r) => r.symbol));
  const assetBySymbol = new Map(assets.map((a) => [a.symbol, a]));

  // Re-entry cooldown: latest close time per `${symbol}|${signal}`.
  const lastCloseByKey = new Map<string, number>();
  for (const c of options.recentClosed ?? []) {
    if (!c.closed_at) continue;
    const closedAt = Date.parse(c.closed_at);
    if (!Number.isFinite(closedAt)) continue;
    const key = `${c.symbol}|${c.signal}`;
    lastCloseByKey.set(key, Math.max(lastCloseByKey.get(key) ?? 0, closedAt));
  }
  const inCooldown = (symbol: string, signal: string) => {
    const last = lastCloseByKey.get(`${symbol}|${signal}`);
    return last != null && now - last < REENTRY_COOLDOWN_MS;
  };

  // EMIT: a fresh long/short with a plan, and no open trade for the symbol yet.
  // Guarded: skip STALE snapshots (the wrong-direction bug) and symbols still in
  // their post-close re-entry cooldown (the duplicate-loser churn).
  const inserts: JournalTradeInsert[] = [];
  for (const asset of assets) {
    if (openSymbols.has(asset.symbol)) continue;
    if (isStaleQuote(asset, now)) continue;
    const trade = buildFollowedTrade(asset);
    if (!trade) continue;
    if (inCooldown(trade.symbol, trade.signal)) continue;
    inserts.push(followedTradeToInsert(trade));
  }

  // SYNC: replay candles since entry for each open trade; close on TP/SL.
  const openTrades = openRows.map(rowToFollowedTrade);
  const prices: Record<string, number> = {};
  const candlesBySymbol: Record<string, FollowCandle[]> = {};
  for (const t of openTrades) {
    const asset = assetBySymbol.get(t.symbol);
    // Stale snapshot → don't sync (its price/candles are hours old); the trade
    // stays open untouched until a fresh quote arrives.
    if (!asset || isStaleQuote(asset, now)) continue;
    const candles = asset.quoteIndicators
      ? normalizeYahooCandles(asset.quoteIndicators, asset.timestamps)
      : [];
    const since = candles.filter((c) => c.timestamp * 1000 >= t.followedAt);
    // Evaluate ONLY off the timestamped candle record, NEVER the raw spot price:
    // Yahoo's regularMarketPrice (esp. forex) is flaky/forward-filled and a single
    // bad print can manufacture a phantom TP/SL. No candle since entry → skip this
    // cycle (stay open) rather than trust the spot. The live tick fed to
    // applyPriceSync is the latest candle's close, corroborated by that bar's
    // own high/low (which the replay already processed).
    if (since.length === 0) continue;
    prices[t.symbol] = since[since.length - 1].close;
    candlesBySymbol[t.symbol] = since.map<FollowCandle>((c) => ({
      high: c.high,
      low: c.low,
      timestamp: c.timestamp * 1000,
    }));
  }

  // Close 1 — price hit TP/SL (the hard, realized exit).
  const { stillOpen, justClosed } = applyPriceSync(
    openTrades,
    prices,
    candlesBySymbol,
  );
  const closures: JournalClosure[] = justClosed.map((t) => ({
    id: t.id,
    symbol: t.symbol,
    status: t.status,
    close_price: t.closePrice ?? null,
    closed_at: t.closedAt
      ? new Date(t.closedAt).toISOString()
      : new Date().toISOString(),
    highest_tp_reached: t.highestTpReached,
  }));

  // Close 2 — signal REVERSAL (long↔short). The thesis is now actively wrong,
  // so exit. But if a TP milestone was already touched, SECURE it (close as that
  // TP at its price, mirroring the SL-after-TP rule in evaluateFollow) — the
  // "manual"/Reversed status is ONLY for a flip that never reached any TP.
  // Neutral does NOT close: conviction merely faded, not reversed.
  for (const t of stillOpen) {
    const asset = assetBySymbol.get(t.symbol);
    // Never reverse-close off a stale signal.
    if (!asset || isStaleQuote(asset, now)) continue;
    const signal = asset.outlook?.signal;
    const reversed =
      (t.signal === "long" && signal === "short") ||
      (t.signal === "short" && signal === "long");
    if (!reversed) continue;
    const securedTp = t.highestTpReached;
    closures.push(
      securedTp >= 1
        ? {
            id: t.id,
            symbol: t.symbol,
            status: `tp${securedTp}`,
            close_price:
              t.takeProfits[securedTp - 1] ?? prices[t.symbol] ?? null,
            closed_at: new Date().toISOString(),
            highest_tp_reached: securedTp,
          }
        : {
            id: t.id,
            symbol: t.symbol,
            // Reversal with no TP touched → the only true "Reversed" close.
            status: "manual",
            close_price: prices[t.symbol] ?? null,
            closed_at: new Date().toISOString(),
            highest_tp_reached: t.highestTpReached,
          },
    );
  }

  return { inserts, closures };
}
