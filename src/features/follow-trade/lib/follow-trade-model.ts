import type { AssetType, UnifiedAsset } from "@/types/asset";
import { TRADEABLE_ASSET_TYPES } from "@/constants/taxonomy/asset";
import { SIGNAL_TIERS, type SignalTier } from "@/constants/taxonomy/tier";
import {
  FOLLOW_SIGNALS,
  LIFECYCLE_STATUSES,
  type FollowSignal,
  type FollowStatus,
  type LifecycleStatus,
} from "@/constants/taxonomy/status";

// Re-export the followed-trade status taxonomy so existing imports of these
// names from this module (UI + engine) keep resolving unchanged.
export {
  FOLLOW_SIGNALS,
  LIFECYCLE_STATUSES,
  type FollowSignal,
  type FollowStatus,
  type LifecycleStatus,
};

export interface FollowedTrade {
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  signal: FollowSignal;
  timeframe: string;
  /** Reference price at the moment of following (market follow). */
  entryPrice: number;
  stopLoss: number;
  /** [tp1, tp2, tp3?] — only finite levels from the plan. */
  takeProfits: number[];
  riskRewardRatio: number;
  strengthAtEntry: number;
  grade?: SignalTier;
  followedAt: number;
  /** Monotonic milestone progress: 0 = none, 1..3 = highest TP touched. */
  highestTpReached: number;
  status: FollowStatus;
  /** Closed by a SIGNAL REVERSAL rather than a price TP/SL hit. A reversal can
   *  secure a TP (status tp{n}) or none (status manual); this flag is what lets
   *  the UI mark a reversal-after-TP apart from a stop-after-TP. */
  reversed?: boolean;
  closePrice?: number;
  closedAt?: number;
}

/** Direction-aware floating/realized P&L. risk = |entry - stopLoss|. */
export function computePnl(
  trade: Pick<FollowedTrade, "signal" | "entryPrice" | "stopLoss">,
  price: number,
): { pct: number; r: number } {
  const { signal, entryPrice, stopLoss } = trade;
  const risk = Math.abs(entryPrice - stopLoss);
  const move = signal === "long" ? price - entryPrice : entryPrice - price;
  return {
    pct: entryPrice > 0 ? (move / entryPrice) * 100 : 0,
    r: risk > 0 ? move / risk : 0,
  };
}

export interface FollowEvaluation {
  status: FollowStatus;
  highestTpReached: number;
  closePrice?: number;
  closed: boolean;
  /** When the closing level was actually hit (ms). Derived from candle history
   *  so a level touched in the past is stamped with its REAL time, not "now".
   *  Undefined when closed off a live snapshot (caller falls back to Date.now). */
  closedAt?: number;
}

/** Minimal candle for follow evaluation. `timestamp` in ms, ascending order. */
export interface FollowCandle {
  high: number;
  low: number;
  timestamp: number;
}

/**
 * Evaluate a trade against the candle history since it was followed (+ the live
 * price), REPLAYED IN ORDER so the outcome respects sequence:
 * - within each bar a touched target is "taken" first — a TP counts as secured
 *   profit even if the stop is hit in the same bar (follower's assumption);
 * - the trade closes on the FIRST terminal event — final TP, or SL (a loss ONLY
 *   if no TP was ever touched, else a secured close at the highest TP so far);
 * - otherwise it stays open with the milestone the candles actually show.
 *
 * Why ordered: aggregate highs/lows can't tell whether the stop or a target came
 * first, which produces phantom "secured TP" closes. When candles are supplied
 * they are the authoritative ordered record since follow, so the milestone is
 * replayed from scratch and `closedAt` is the real hit time; without candles it
 * degrades to a single live-price check that preserves the stored milestone.
 */
export function evaluateFollow(
  trade: FollowedTrade,
  price: number,
  candles?: FollowCandle[],
): FollowEvaluation {
  const { signal, stopLoss, takeProfits } = trade;
  const isLong = signal === "long";
  const finalIndex = takeProfits.length;
  const hasCandles = !!candles && candles.length > 0;

  const stopHitBy = (probe: number) =>
    isLong ? probe <= stopLoss : probe >= stopLoss;
  const tpCountBy = (probe: number) => {
    let n = 0;
    for (let i = 0; i < takeProfits.length; i++) {
      if (isLong ? probe >= takeProfits[i] : probe <= takeProfits[i]) n = i + 1;
      else break;
    }
    return n;
  };

  // With candles, replay from scratch (they're the ordered truth). Live-only,
  // keep the stored monotonic milestone.
  let highestTpReached = hasCandles ? 0 : trade.highestTpReached;

  // Steps in chronological order: each candle (favorable extreme for TP, adverse
  // for SL), then the latest live tick (no timestamp -> caller stamps "now").
  const steps: { tpProbe: number; slProbe: number; at?: number }[] = [];
  if (hasCandles) {
    for (const c of candles!) {
      steps.push({
        tpProbe: isLong ? c.high : c.low,
        slProbe: isLong ? c.low : c.high,
        at: c.timestamp,
      });
    }
  }
  steps.push({ tpProbe: price, slProbe: price });

  for (const step of steps) {
    // Targets first: a touched TP is "taken", so it secures profit even if the
    // stop is hit in the same bar; touching the final TP is a full win.
    const reachedNow = tpCountBy(step.tpProbe);
    if (reachedNow > highestTpReached) highestTpReached = reachedNow;
    if (finalIndex > 0 && highestTpReached >= finalIndex) {
      return {
        status: `tp${finalIndex}` as FollowStatus,
        highestTpReached: finalIndex,
        closePrice: takeProfits[finalIndex - 1],
        closed: true,
        closedAt: step.at,
      };
    }
    // Then the stop: a loss ONLY if no TP has ever been touched; otherwise close
    // securing the highest TP reached so far.
    if (stopHitBy(step.slProbe)) {
      if (highestTpReached === 0) {
        return {
          status: "sl",
          highestTpReached: 0,
          closePrice: stopLoss,
          closed: true,
          closedAt: step.at,
        };
      }
      return {
        status: `tp${highestTpReached}` as FollowStatus,
        highestTpReached,
        closePrice: takeProfits[highestTpReached - 1],
        closed: true,
        closedAt: step.at,
      };
    }
  }

  return { status: "open", highestTpReached, closed: false };
}

/** Display-facing split of a followed trade: LIFECYCLE vs OUTCOME. */
export interface FollowProgress {
  /** Position state — open vs done. Always the server's source of truth. */
  lifecycle: LifecycleStatus;
  /** TP levels touched (0..tpTotal); live-ratcheted for running trades. */
  tpReached: number;
  tpTotal: number;
  /** Closed via stop-loss (no TP ever secured). */
  slHit: boolean;
  /** Closed by a signal reversal (vs a price TP/SL hit). Display-only marker. */
  reversed: boolean;
}

/**
 * Split a trade into the two independent things the UI shows: its LIFECYCLE
 * (open/closed) and its OUTCOME (TP milestone + SL). Lifecycle is the stored
 * status (server truth). The milestone is recomputed LIVE for running trades and
 * ratcheted up from the stored floor — the cron only persists `highestTpReached`
 * on close (see core/auto-journal-core.ts), so an open row's stored milestone is
 * stale (0). `rawCandles` are Yahoo-normalized (timestamp in SECONDS); they're
 * filtered to since-follow and ms-stamped here, mirroring the cron's prep.
 */
export function deriveFollowProgress(
  trade: FollowedTrade,
  price: number,
  rawCandles?: { high: number; low: number; timestamp: number }[],
): FollowProgress {
  const tpTotal = trade.takeProfits.length;
  if (trade.status !== "open") {
    return {
      lifecycle: "closed",
      tpReached: trade.highestTpReached,
      tpTotal,
      slHit: trade.status === "sl",
      reversed: trade.reversed ?? false,
    };
  }
  const since = rawCandles
    ?.filter((c) => c.timestamp * 1000 >= trade.followedAt)
    .map<FollowCandle>((c) => ({
      high: c.high,
      low: c.low,
      timestamp: c.timestamp * 1000,
    }));
  const live = evaluateFollow(trade, price, since);
  return {
    lifecycle: "open",
    tpReached: Math.max(trade.highestTpReached, live.highestTpReached),
    tpTotal,
    slHit: false,
    reversed: false,
  };
}

/**
 * Apply a price snapshot to all open trades, partitioning into open/closed.
 * `candlesBySymbol` (optional) carries each symbol's candles since the trade was
 * followed so TP/SL touches by an intraday wick are caught — and the close is
 * stamped with the REAL hit time, not "now".
 */
export function applyPriceSync(
  openTrades: FollowedTrade[],
  prices: Record<string, number>,
  candlesBySymbol?: Record<string, FollowCandle[]>,
): { stillOpen: FollowedTrade[]; justClosed: FollowedTrade[] } {
  const stillOpen: FollowedTrade[] = [];
  const justClosed: FollowedTrade[] = [];
  for (const trade of openTrades) {
    const price = prices[trade.symbol];
    if (typeof price !== "number" || !Number.isFinite(price)) {
      stillOpen.push(trade);
      continue;
    }
    const ev = evaluateFollow(trade, price, candlesBySymbol?.[trade.symbol]);
    if (ev.closed) {
      justClosed.push({
        ...trade,
        status: ev.status,
        highestTpReached: ev.highestTpReached,
        closePrice: ev.closePrice,
        closedAt: ev.closedAt ?? Date.now(),
      });
    } else if (ev.highestTpReached !== trade.highestTpReached) {
      stillOpen.push({ ...trade, highestTpReached: ev.highestTpReached });
    } else {
      stillOpen.push(trade);
    }
  }
  return { stillOpen, justClosed };
}

/** Snapshot a followable asset into a FollowedTrade, or null if not followable. */
export function buildFollowedTrade(asset: UnifiedAsset): FollowedTrade | null {
  const { outlook, tradingPlan } = asset;
  if (!outlook || !tradingPlan) return null;
  if (outlook.signal !== "long" && outlook.signal !== "short") return null;

  const takeProfits = [
    tradingPlan.takeProfit1,
    tradingPlan.takeProfit2,
    tradingPlan.takeProfit3,
  ].filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const now = Date.now();
  return {
    id: `${asset.symbol}-${now}`,
    symbol: asset.symbol,
    name: asset.name,
    assetType: asset.assetType,
    signal: outlook.signal,
    timeframe: asset.timeframe,
    entryPrice: asset.price,
    stopLoss: tradingPlan.stopLoss,
    takeProfits,
    riskRewardRatio: tradingPlan.riskRewardRatio,
    strengthAtEntry: outlook.strength,
    grade: outlook.tier,
    followedAt: now,
    highestTpReached: 0,
    status: "open",
  };
}

export interface TrackerStats {
  totalFollowed: number;
  open: number;
  closed: number;
  /** Win rate over closed trades, 0..100. */
  winRate: number;
  avgR: number;
  totalR: number;
  equitySeries: {
    index: number;
    date: number;
    r: number;
    cumR: number;
    symbol: string;
  }[];
  /** % P/L summed per calendar day (local), with the running cumulative %. */
  dailySeries: { date: string; dayPct: number; cumPct: number }[];
  statusDistribution: { status: LifecycleStatus; count: number }[];
  perAsset: { symbol: string; pct: number }[];
  /** % P/L summed per asset type (crypto / stock / forex …). */
  byAssetType: { assetType: string; pct: number }[];
  longVsShort: { signal: FollowSignal; count: number; r: number }[];
  /** Closed-trade outcome tally: profitable vs losing trades. */
  winLoss: { wins: number; losses: number };
  /** Avg R per signal grade (A/B/C) — validates the engine's tiering. */
  byGrade: { grade: SignalTier; count: number; avgR: number }[];
}

/** Aggregate closed-trade history (+ current open count) into dashboard stats. */
export function buildTrackerStats(
  history: FollowedTrade[],
  openCount = 0,
): TrackerStats {
  const closed = history.length;
  const ordered = [...history].sort(
    (a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0),
  );

  const dayKey = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const statusCounts = new Map<FollowStatus, number>();
  const perAssetMap = new Map<string, number>();
  const assetTypeMap = new Map<string, number>();
  const dirMap = new Map<FollowSignal, { count: number; r: number }>();
  const gradeMap = new Map<SignalTier, { count: number; r: number }>();
  const dateToPct = new Map<string, number>();
  const equitySeries: TrackerStats["equitySeries"] = [];
  let totalR = 0;
  let wins = 0;
  let losses = 0;
  let cumR = 0;

  ordered.forEach((t, i) => {
    const { pct, r } = computePnl(t, t.closePrice ?? t.entryPrice);
    totalR += r;
    cumR += r;
    if (r > 0) wins++;
    else if (r < 0) losses++;
    equitySeries.push({
      index: i + 1,
      date: t.closedAt ?? t.followedAt,
      r,
      cumR,
      symbol: t.symbol,
    });
    statusCounts.set(t.status, (statusCounts.get(t.status) ?? 0) + 1);
    perAssetMap.set(t.symbol, (perAssetMap.get(t.symbol) ?? 0) + pct);
    assetTypeMap.set(t.assetType, (assetTypeMap.get(t.assetType) ?? 0) + pct);
    const d = dirMap.get(t.signal) ?? { count: 0, r: 0 };
    dirMap.set(t.signal, { count: d.count + 1, r: d.r + r });
    if (t.grade) {
      const g = gradeMap.get(t.grade) ?? { count: 0, r: 0 };
      gradeMap.set(t.grade, { count: g.count + 1, r: g.r + r });
    }
    const day = dayKey(t.closedAt ?? t.followedAt);
    dateToPct.set(day, (dateToPct.get(day) ?? 0) + pct);
  });

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();

  const daysInMonth: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    daysInMonth.push(
      `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    );
  }
  const minDayStr = daysInMonth[0];

  let initialCumPct = 0;
  for (const [date, pct] of dateToPct.entries()) {
    if (date < minDayStr) {
      initialCumPct += pct;
    }
  }

  let dayCum = initialCumPct;
  const dailySeries = daysInMonth.map((date) => {
    const dayPct = dateToPct.get(date) ?? 0;
    dayCum += dayPct;
    return { date, dayPct, cumPct: dayCum };
  });

  return {
    totalFollowed: closed + openCount,
    open: openCount,
    closed,
    winRate: closed > 0 ? (wins / closed) * 100 : 0,
    avgR: closed > 0 ? totalR / closed : 0,
    totalR,
    equitySeries,
    dailySeries,
    // Matches the table's Status column (open vs closed lifecycle). Uses the shared LIFECYCLE_STATUSES array.
    statusDistribution: LIFECYCLE_STATUSES.map((status) => ({
      status,
      count: status === "open" ? openCount : closed,
    })),
    perAsset: [...perAssetMap.entries()].map(([symbol, pct]) => ({
      symbol,
      pct,
    })),
    byAssetType: TRADEABLE_ASSET_TYPES.map((assetType) => ({
      assetType,
      pct: assetTypeMap.get(assetType) ?? 0,
    })),
    // Fixed order (long → short) to match the signal filter dropdown. Uses the shared FOLLOW_SIGNALS array.
    longVsShort: FOLLOW_SIGNALS.map((signal) => {
      const v = dirMap.get(signal) ?? { count: 0, r: 0 };
      return { signal, count: v.count, r: v.r };
    }),
    winLoss: { wins, losses },
    byGrade: SIGNAL_TIERS.filter((g) => gradeMap.has(g)).map((g) => {
      const v = gradeMap.get(g)!;
      return {
        grade: g,
        count: v.count,
        avgR: v.count > 0 ? v.r / v.count : 0,
      };
    }),
  };
}
