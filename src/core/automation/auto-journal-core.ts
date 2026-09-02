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
  computePnl,
  countTakeProfitsAtPrice,
  type FollowCandle,
  type ExitReason,
} from "@/core/trade/follow-trade-model";
import { enrichAsset } from "@/core/engine/enrichment";
import type { EngineContexts } from "@/core/engine/context-pipeline";
import { normalizeYahooCandles } from "@/core/market/candles";
import {
  followedTradeToInsert,
  rowToFollowedTrade,
} from "@/core/trade/journal-mapper";
import type { JournalTradeRow, JournalTradeInsert } from "@/types/journal";
import type {
  JournalSignalStateRow,
  JournalSignalStateUpsert,
} from "@/types/journal";
import {
  activateSignalEpisode,
  closeSignalEpisode,
  observeSignalEpisode,
  signalEpisodeKey,
} from "@/core/automation/signal-episode";

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
  exit_reason: ExitReason;
  /** Total TP levels the plan had — lets a reversal alert retain its TP progress
   *  vs "no TP", mirroring the trade-detail badge. NOT persisted. */
  tp_total?: number;
  /** TP levels secured by the realized close price. NOT persisted. */
  secured_tp_level?: number;
  /** True only for a SIGNAL-REVERSAL close (legacy audit compatibility). */
  reversed?: boolean;
  /** Realized P&L % at the close price. NOT persisted (DB UPDATE ignores it) —
   *  carried only for the Discord outcome line. */
  pnl_pct: number;
  /** Hold time in ms (entry → close). NOT persisted — carried only for the
   *  Discord DURATION line. */
  duration_ms?: number;
  signal?: "long" | "short";
  grade?: string | null;
}

export interface AutoJournalPlan {
  inserts: JournalTradeInsert[];
  closures: JournalClosure[];
  progressUpdates: JournalProgressUpdate[];
  signalStateUpdates: JournalSignalStateUpsert[];
}

export interface JournalProgressUpdate {
  id: string;
  highest_tp_reached: number;
}

export interface RunAutoJournalOptions {
  /** Wall-clock "now" in ms. Default Date.now(); injectable for tests. */
  now?: number;
  /** Top-down contexts (BTC/IHSG/S&P). When supplied, each emission candidate
   *  gets the same index-aware de-rate shown by the screener. Context changes
   *  strength/tier, never whether an actionable screen signal is journaled. */
  contexts?: EngineContexts;
  /** Persisted one-trade-per-signal-episode state. */
  signalStates?: JournalSignalStateRow[];
}

/** A quote older than this is STALE — a hours-old cached/forward-filled snapshot,
 *  not a live tick. The cron must skip it so it never journals/syncs off stale
 *  prices (wrong direction, wrong entry, or a phantom TP/SL). ~1.5× the 1h candle. */
const QUOTE_MAX_AGE_MS = 90 * 60 * 1000;
const ENTRY_MAX_AGE_MS = 15 * 60 * 1000;

/** Stale-quote guard for ALL asset types (not just crypto): a stale price in any
 *  market can manufacture a phantom TP/SL on sync or a wrong-direction emit. When a
 *  market is legitimately closed (equities overnight, forex weekend) its quote ages
 *  out → we skip it that cycle and the trade stays open, which is the safe failure
 *  direction. No timestamp → fail closed. */
function isStaleQuote(asset: UnifiedAsset, now: number): boolean {
  if (
    typeof asset.quoteTime !== "number" ||
    !Number.isFinite(asset.quoteTime)
  ) {
    return true;
  }
  const age = now - asset.quoteTime;
  return age > QUOTE_MAX_AGE_MS || age < -5 * 60 * 1000;
}

function hasFreshDecision(asset: UnifiedAsset, now: number): boolean {
  const closedAt = asset.decisionCandleClosedAt;
  const executionAt = asset.executionCandleOpenAt;
  if (
    typeof closedAt !== "number" ||
    !Number.isFinite(closedAt) ||
    typeof executionAt !== "number" ||
    !Number.isFinite(executionAt) ||
    executionAt < closedAt ||
    executionAt > now + 5 * 60 * 1000
  ) {
    return false;
  }
  const age = now - closedAt;
  return age >= 0 && age <= ENTRY_MAX_AGE_MS;
}

export function runAutoJournal(
  assets: UnifiedAsset[],
  openRows: JournalTradeRow[],
  options: RunAutoJournalOptions = {},
): AutoJournalPlan {
  const now = options.now ?? Date.now();
  const assetBySymbol = new Map(assets.map((a) => [a.symbol, a]));
  const stateByKey = new Map(
    (options.signalStates ?? []).map((state) => [
      signalEpisodeKey(state.symbol, state.timeframe),
      state as JournalSignalStateUpsert,
    ]),
  );

  // Open journal rows are the recoverable source of truth if a previous state
  // upsert failed after the trade insert.
  for (const row of openRows) {
    const key = signalEpisodeKey(row.symbol, row.timeframe);
    const state = stateByKey.get(key);
    stateByKey.set(key, {
      symbol: row.symbol,
      timeframe: row.timeframe,
      active_signal: row.signal,
      blocked_signal: state?.blocked_signal ?? null,
      last_raw_signal: state?.last_raw_signal ?? row.signal,
      decision_candle_open_at:
        state?.decision_candle_open_at ?? row.decision_candle_open_at ?? null,
      decision_candle_closed_at:
        state?.decision_candle_closed_at ??
        row.decision_candle_closed_at ??
        null,
      entry_price: row.entry_price,
      stop_loss: row.stop_loss,
      take_profits: row.take_profits,
      risk_reward_ratio: row.risk_reward_ratio,
      updated_at: new Date(now).toISOString(),
    });
  }

  // Heal the inverse partial-write case: the episode upsert succeeded but its
  // trade insert did not. Keep the old direction blocked until raw goes neutral.
  const openRowKeys = new Set(
    openRows.map((row) => signalEpisodeKey(row.symbol, row.timeframe)),
  );
  for (const [key, state] of stateByKey) {
    if (state.active_signal && !openRowKeys.has(key)) {
      stateByKey.set(key, closeSignalEpisode(state, state.active_signal));
    }
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
      ? normalizeYahooCandles(asset.quoteIndicators, asset.timestamps, {
          requireTimestamps: true,
          requirePhysical: true,
        })
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
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      timestamp: c.timestamp * 1000,
      isClosed:
        typeof asset.decisionCandleOpenAt === "number" &&
        c.timestamp * 1000 <= asset.decisionCandleOpenAt,
    }));
  }

  // Close 1 — price hit TP/SL (the hard, realized exit).
  const { stillOpen, justClosed, progressed } = applyPriceSync(
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
      : new Date(now).toISOString(),
    highest_tp_reached: t.highestTpReached,
    exit_reason:
      t.exitReason ??
      (t.status === "sl" ? "initial_stop" : "final_take_profit"),
    tp_total: t.takeProfits.length,
    secured_tp_level: countTakeProfitsAtPrice(t, t.closePrice),
    pnl_pct: computePnl(t, t.closePrice ?? t.entryPrice).pct,
    duration_ms: Math.max(0, (t.closedAt ?? now) - t.followedAt),
    signal: t.signal,
    grade: t.grade ?? null,
  }));
  const progressUpdates: JournalProgressUpdate[] = progressed.map((trade) => ({
    id: trade.id,
    highest_tp_reached: trade.highestTpReached,
  }));

  // Close 2 — signal REVERSAL (long↔short). Neutral does not close: conviction
  // faded, but the thesis has not flipped.
  for (const t of stillOpen) {
    const asset = assetBySymbol.get(t.symbol);
    // Never reverse-close off a stale signal.
    if (!asset || isStaleQuote(asset, now)) continue;
    const signal = asset.outlook?.signal;
    const isReversal =
      (t.signal === "long" && signal === "short") ||
      (t.signal === "short" && signal === "long");
    if (!isReversal) continue;
    const reachedTp = t.highestTpReached;
    // Partial targets are progress only. A true opposite signal still exits the
    // open position at the corroborated current close.
    const close_price = prices[t.symbol];
    if (typeof close_price !== "number" || !Number.isFinite(close_price)) {
      continue;
    }
    closures.push({
      id: t.id,
      symbol: t.symbol,
      // Exit cause and TP journey are independent: status records reversal,
      // while highest_tp_reached preserves how far price travelled first.
      status: "reversed",
      exit_reason: "reversal",
      close_price,
      closed_at: new Date(now).toISOString(),
      highest_tp_reached: reachedTp,
      tp_total: t.takeProfits.length,
      secured_tp_level: countTakeProfitsAtPrice(t, close_price),
      reversed: true,
      pnl_pct: computePnl(t, close_price).pct,
      duration_ms: Math.max(0, now - t.followedAt),
      signal: t.signal,
      grade: t.grade ?? null,
    });
  }

  for (const closure of closures) {
    const key = signalEpisodeKey(
      closure.symbol,
      openRows.find((row) => row.id === closure.id)?.timeframe,
    );
    const state = stateByKey.get(key);
    if (state && closure.signal) {
      stateByKey.set(key, closeSignalEpisode(state, closure.signal));
    }
  }

  // Observe raw signals after closes: neutral re-arms the old direction;
  // same-direction raw signals remain blocked; opposites start a new episode.
  for (const asset of assets) {
    const key = signalEpisodeKey(asset.symbol, asset.timeframe);
    stateByKey.set(key, observeSignalEpisode(stateByKey.get(key), asset, now));
  }

  // EMIT after closure planning. A same-direction close stays blocked until a
  // neutral raw signal re-arms it; an opposite signal may start immediately.
  const closingIds = new Set(closures.map((c) => c.id));
  const openKeys = new Set(
    openRows
      .filter((row) => !closingIds.has(row.id))
      .map((row) =>
        signalEpisodeKey(row.symbol, row.timeframe),
      ),
  );
  const inserts: JournalTradeInsert[] = [];
  for (const asset of assets) {
    const key = signalEpisodeKey(asset.symbol, asset.timeframe);
    const state = stateByKey.get(key);
    const rawSignal = asset.outlook?.signal;
    if (
      openKeys.has(key) ||
      state?.active_signal != null ||
      state?.blocked_signal === rawSignal ||
      isStaleQuote(asset, now) ||
      !hasFreshDecision(asset, now)
    ) {
      continue;
    }

    // Keep the journal's recorded strength/tier identical to the screener's
    // top-down de-rate, but do not hide a signal the screener exposes.
    const enriched = options.contexts
      ? enrichAsset(asset, options.contexts, { applyOptionalOverlays: false })
      : asset;
    const trade = buildFollowedTrade(enriched, now);
    if (!trade) continue;
    inserts.push(followedTradeToInsert(trade));
    openKeys.add(key);
    stateByKey.set(key, activateSignalEpisode(state!, trade.signal));
  }

  return {
    inserts,
    closures,
    progressUpdates,
    signalStateUpdates: [...stateByKey.values()],
  };
}
