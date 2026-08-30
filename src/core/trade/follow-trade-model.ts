import type { AssetType, UnifiedAsset } from "@/types/asset";
import { TRADEABLE_ASSET_TYPES } from "@/constants/taxonomy/asset";
import { SIGNAL_TIERS, type SignalTier } from "@/constants/taxonomy/tier";
import {
  FOLLOW_SIGNALS,
  LIFECYCLE_STATUSES,
  type FollowSignal,
  type FollowStatus,
  type LifecycleStatus,
  type ExitReason,
  type PnlFilter,
} from "@/constants/taxonomy/status";
import { ENGINE_VERSION } from "@/constants/signals";
import type { MarketRegime, TrendDirection } from "@/types/market";

// Re-export the followed-trade status taxonomy so existing imports of these
// names from this module (UI + engine) keep resolving unchanged.
export {
  FOLLOW_SIGNALS,
  LIFECYCLE_STATUSES,
  type FollowSignal,
  type FollowStatus,
  type LifecycleStatus,
  type ExitReason,
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
  engineVersion?: string;
  decisionCandleTime?: number;
  regime?: MarketRegime;
  higherTimeframeTrend?: TrendDirection;
  directionScore?: number;
  followedAt: number;
  /** Monotonic milestone progress: 0 = none, 1..3 = highest TP touched. */
  highestTpReached: number;
  status: FollowStatus;
  /** Exact terminal event. Undefined on open and pre-v4 historical rows. */
  exitReason?: ExitReason;
  /** Legacy audit flag retained for historical rows and DB compatibility. New
   *  v4 reversals also persist `exitReason: "reversal"`. */
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

/** Number of ordered TP levels at or beyond `price`, mirrored for shorts. */
export function countTakeProfitsAtPrice(
  trade: Pick<FollowedTrade, "signal" | "takeProfits">,
  price: number | undefined,
): number {
  if (price == null || !Number.isFinite(price)) return 0;
  let reached = 0;
  for (let i = 0; i < trade.takeProfits.length; i++) {
    const hit =
      trade.signal === "long"
        ? price >= trade.takeProfits[i]
        : price <= trade.takeProfits[i];
    if (!hit) break;
    reached = i + 1;
  }
  return reached;
}

/** Resolve old rows into the explicit v4 outcome contract without rewriting
 *  closed history. New rows always carry `exitReason`; the rest is fallback. */
export function resolveExitReason(
  trade: Pick<
    FollowedTrade,
    | "status"
    | "exitReason"
    | "reversed"
    | "engineVersion"
    | "highestTpReached"
    | "takeProfits"
  >,
): ExitReason | undefined {
  if (trade.exitReason) return trade.exitReason;
  if (trade.reversed || trade.status === "reversed") return "reversal";
  if (trade.status === "sl") return "initial_stop";

  const tp = /^tp([123])$/.exec(trade.status);
  if (!tp) return undefined;
  if (
    trade.engineVersion === "engine-v3" &&
    Number(tp[1]) < trade.takeProfits.length
  ) {
    return "progressive_stop";
  }
  return "final_take_profit";
}

export type TradeOutcomeBucket = Exclude<PnlFilter, "all">;

/** Single bucketing rule shared by the journal table and outcome chart. */
export function tradeOutcomeBucket(
  trade: FollowedTrade,
): TradeOutcomeBucket {
  const reason = resolveExitReason(trade);
  const { r } = computePnl(trade, trade.closePrice ?? trade.entryPrice);
  if (r === 0) return "breakeven";
  if (reason === "final_take_profit") return "tp";
  if (reason === "breakeven_stop" || reason === "progressive_stop") {
    return r > 0 ? "tp" : "sl";
  }
  if (reason === "reversal") {
    return r > 0 ? "reversal_profit" : "reversal_loss";
  }
  return "sl";
}

export interface TradeWinrateSnapshot {
  wins: number;
  total: number;
}

const tradeResolvedAt = (trade: FollowedTrade) =>
  trade.closedAt ?? trade.followedAt;

const compareTradeTimeline = (a: FollowedTrade, b: FollowedTrade) => {
  const resolvedDiff = tradeResolvedAt(a) - tradeResolvedAt(b);
  if (resolvedDiff !== 0) return resolvedDiff;
  const openedDiff = a.followedAt - b.followedAt;
  if (openedDiff !== 0) return openedDiff;
  return a.id.localeCompare(b.id);
};

/**
 * Per-row journal win-rate snapshots. Closed rows include their own result;
 * open rows show only the closed track record that existed before entry.
 */
export function buildTradeWinrateSnapshots(
  trades: FollowedTrade[],
): Record<string, TradeWinrateSnapshot> {
  const snapshots: Record<string, TradeWinrateSnapshot> = {};
  const closedBySymbol = new Map<string, FollowedTrade[]>();

  for (const trade of trades) {
    if (trade.status === "open") continue;
    const list = closedBySymbol.get(trade.symbol);
    if (list) list.push(trade);
    else closedBySymbol.set(trade.symbol, [trade]);
  }

  const cumulativeBySymbol = new Map<
    string,
    (TradeWinrateSnapshot & { at: number })[]
  >();

  for (const [symbol, closedTrades] of closedBySymbol) {
    const ordered = [...closedTrades].sort(compareTradeTimeline);
    const cumulative: (TradeWinrateSnapshot & { at: number })[] = [];
    let wins = 0;
    let total = 0;

    for (const trade of ordered) {
      const { r } = computePnl(trade, trade.closePrice ?? trade.entryPrice);
      if (r > 0) {
        wins += 1;
        total += 1;
      } else if (r < 0) {
        total += 1;
      }
      const snapshot = { wins, total };
      snapshots[trade.id] = snapshot;
      cumulative.push({ ...snapshot, at: tradeResolvedAt(trade) });
    }

    cumulativeBySymbol.set(symbol, cumulative);
  }

  for (const trade of trades) {
    if (trade.status !== "open") continue;
    let snapshot: TradeWinrateSnapshot = { wins: 0, total: 0 };
    for (const point of cumulativeBySymbol.get(trade.symbol) ?? []) {
      if (point.at >= trade.followedAt) break;
      snapshot = { wins: point.wins, total: point.total };
    }
    snapshots[trade.id] = snapshot;
  }

  return snapshots;
}

export interface FollowEvaluation {
  status: FollowStatus;
  highestTpReached: number;
  exitReason?: ExitReason;
  closePrice?: number;
  closed: boolean;
  /** When the closing level was actually hit (ms). Derived from candle history
   *  so a level touched in the past is stamped with its REAL time, not "now".
   *  Undefined when closed off a live snapshot (caller falls back to Date.now). */
  closedAt?: number;
}

/** Minimal candle for follow evaluation. `timestamp` in ms, ascending order. */
export interface FollowCandle {
  open?: number;
  high: number;
  low: number;
  close?: number;
  timestamp: number;
}

/**
 * Evaluate a trade against the candle history since it was followed (+ the live
 * price), REPLAYED IN ORDER so the outcome respects sequence:
 * - within each bar the stop is checked first — OHLC cannot prove intrabar
 *   ordering, so the engine takes the conservative outcome;
 * - TP1 moves the stop to entry; TP2 moves it to TP1 (one rung behind);
 * - a newly raised stop starts on the NEXT step, never retroactively in the bar
 *   that reached the TP;
 * - the trade closes on the first active-stop or final-TP event;
 * - a gap through the active stop fills at its open rather than assuming a
 *   perfect fill;
 * - otherwise it stays open with the milestone the candles actually show.
 *
 * Why ordered: aggregate highs/lows can't tell whether the stop or a target came
 * first, which produces phantom outcomes. When candles are supplied they are
 * the authoritative ordered record since follow and `closedAt` is the real hit
 * time. The stored milestone remains a monotonic floor in case the available
 * market-data window no longer reaches all the way back to entry.
 */
export function evaluateFollow(
  trade: FollowedTrade,
  price: number,
  candles?: FollowCandle[],
): FollowEvaluation {
  const { signal, stopLoss, takeProfits } = trade;
  const finalIndex = takeProfits.length;
  const hasCandles = !!candles && candles.length > 0;
  const activeStopFor = (milestone: number) => {
    if (milestone <= 0) return stopLoss;
    if (milestone === 1) return trade.entryPrice;
    return takeProfits[milestone - 2] ?? trade.entryPrice;
  };
  const isLong = signal === "long";

  // A timestamped range is replayed from scratch so a persisted milestone does
  // not activate its raised stop before the TP was actually reached.
  // ponytail: the Edge source replays 60d; persist milestone timestamps if
  // positions are ever intentionally allowed to outlive that source window.
  let highestTpReached = hasCandles ? 0 : trade.highestTpReached;

  // Steps in chronological order: each candle (favorable extreme for TP, adverse
  // for SL), then the latest live tick (no timestamp -> caller stamps "now").
  const steps: {
    tpProbe: number;
    slProbe: number;
    open?: number;
    at?: number;
  }[] = [];
  if (hasCandles) {
    for (const c of candles!) {
      steps.push({
        tpProbe: isLong ? c.high : c.low,
        slProbe: isLong ? c.low : c.high,
        open: c.open,
        at: c.timestamp,
      });
    }
  }
  const lastClose = candles?.[candles.length - 1]?.close;
  // The cron passes the latest candle close as `price`; do not replay that same
  // observation as a fake next step after raising the stop inside the candle.
  if (!hasCandles || lastClose == null || lastClose !== price) {
    steps.push({ tpProbe: price, slProbe: price });
  }

  for (const step of steps) {
    const activeStop = activeStopFor(highestTpReached);
    const gapThroughStop =
      typeof step.open === "number" &&
      Number.isFinite(step.open) &&
      (isLong ? step.open <= activeStop : step.open >= activeStop);
    const stopHit =
      gapThroughStop ||
      (isLong ? step.slProbe <= activeStop : step.slProbe >= activeStop);
    // Stop first: an OHLC bar cannot tell whether its high or low happened
    // first, so same-bar TP+SL is treated as the safer stop outcome.
    if (stopHit) {
      return {
        status: "sl",
        highestTpReached,
        exitReason:
          highestTpReached === 0
            ? "initial_stop"
            : highestTpReached === 1
              ? "breakeven_stop"
              : "progressive_stop",
        closePrice: gapThroughStop ? step.open : activeStop,
        closed: true,
        closedAt: step.at,
      };
    }

    // Targets are evaluated only when the stop was not touched.
    const reachedNow = countTakeProfitsAtPrice(trade, step.tpProbe);
    if (reachedNow > highestTpReached) highestTpReached = reachedNow;
    if (finalIndex > 0 && highestTpReached >= finalIndex) {
      return {
        status: `tp${finalIndex}` as FollowStatus,
        highestTpReached: finalIndex,
        exitReason: "final_take_profit",
        closePrice: takeProfits[finalIndex - 1],
        closed: true,
        closedAt: step.at,
      };
    }
  }

  return {
    status: "open",
    highestTpReached: Math.max(trade.highestTpReached, highestTpReached),
    closed: false,
  };
}

/** Display-facing split of a followed trade: LIFECYCLE vs OUTCOME. */
export interface FollowProgress {
  /** Position state — open vs done. Always the server's source of truth. */
  lifecycle: LifecycleStatus;
  /** TP levels touched (0..tpTotal); live-tracked for running trades. */
  tpReached: number;
  /** TP levels still secured by the realized close price. */
  tpSecured: number;
  tpTotal: number;
  /** Closed via a price stop (initial, entry, or progressive). */
  slHit: boolean;
  /** Authoritative v4 reason, or a legacy fallback derived from old fields. */
  exitReason?: ExitReason;
}

/**
 * Split a trade into the two independent things the UI shows: its LIFECYCLE
 * (open/closed) and its OUTCOME (TP milestone + SL). Lifecycle is the stored
 * status (server truth). The milestone is recomputed LIVE for running trades and
 * kept above the stored floor. The cron also persists that floor while a trade
 * remains open. `rawCandles` are Yahoo-normalized (timestamp in SECONDS); they're
 * filtered to since-follow and ms-stamped here, mirroring the cron's prep.
 */
export function deriveFollowProgress(
  trade: FollowedTrade,
  price: number,
  rawCandles?: {
    open?: number;
    high: number;
    low: number;
    close?: number;
    timestamp: number;
  }[],
): FollowProgress {
  const tpTotal = trade.takeProfits.length;
  if (trade.status !== "open") {
    const closedTp = /^tp([123])$/.exec(trade.status);
    const exitReason = resolveExitReason(trade);
    const fallbackSecured =
      exitReason === "final_take_profit"
        ? Number(closedTp?.[1] ?? trade.highestTpReached)
        : exitReason === "progressive_stop"
          ? Math.max(0, trade.highestTpReached - 1)
          : 0;
    const tpSecured =
      typeof trade.closePrice === "number" && Number.isFinite(trade.closePrice)
        ? countTakeProfitsAtPrice(trade, trade.closePrice)
        : fallbackSecured;
    return {
      lifecycle: "closed",
      tpReached: trade.highestTpReached,
      tpSecured,
      tpTotal,
      slHit:
        exitReason === "initial_stop" ||
        exitReason === "breakeven_stop" ||
        exitReason === "progressive_stop",
      exitReason,
    };
  }
  const since = rawCandles
    ?.filter((c) => c.timestamp * 1000 >= trade.followedAt)
    .map<FollowCandle>((c) => ({
      high: c.high,
      low: c.low,
      open: c.open,
      close: c.close,
      timestamp: c.timestamp * 1000,
    }));
  const live = evaluateFollow(trade, price, since);
  return {
    lifecycle: "open",
    tpReached: Math.max(trade.highestTpReached, live.highestTpReached),
    tpSecured: 0,
    tpTotal,
    slHit: false,
    exitReason: undefined,
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
): {
  stillOpen: FollowedTrade[];
  justClosed: FollowedTrade[];
  progressed: FollowedTrade[];
} {
  const stillOpen: FollowedTrade[] = [];
  const justClosed: FollowedTrade[] = [];
  const progressed: FollowedTrade[] = [];
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
        exitReason: ev.exitReason,
        closePrice: ev.closePrice,
        closedAt: ev.closedAt ?? Date.now(),
      });
    } else if (ev.highestTpReached !== trade.highestTpReached) {
      const updated = { ...trade, highestTpReached: ev.highestTpReached };
      stillOpen.push(updated);
      progressed.push(updated);
    } else {
      stillOpen.push(trade);
    }
  }
  return { stillOpen, justClosed, progressed };
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
    engineVersion: ENGINE_VERSION,
    decisionCandleTime: asset.decisionCandleTime,
    regime: outlook.regime,
    higherTimeframeTrend: outlook.higherTimeframeReady
      ? outlook.higherTimeframeTrend
      : undefined,
    directionScore: outlook.directionScore,
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
  /** Realized R summed per calendar day (local), with running cumulative R. */
  dailySeries: { date: string; dayR: number; cumR: number }[];
  statusDistribution: { status: LifecycleStatus; count: number }[];
  perAsset: { symbol: string; r: number }[];
  /** Realized R summed per asset type (crypto / stock / forex …). */
  byAssetType: { assetType: string; r: number }[];
  longVsShort: { signal: FollowSignal; count: number; r: number }[];
  /** Closed-trade outcome tally. Breakeven is excluded from win rate. */
  winLoss: { wins: number; losses: number; breakevens: number };
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
  const perAssetMap = new Map<string, number>();
  const assetTypeMap = new Map<string, number>();
  const dirMap = new Map<FollowSignal, { count: number; r: number }>();
  const gradeMap = new Map<SignalTier, { count: number; r: number }>();
  const dateToR = new Map<string, number>();
  const equitySeries: TrackerStats["equitySeries"] = [];
  let totalR = 0;
  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let cumR = 0;

  ordered.forEach((t, i) => {
    const { r } = computePnl(t, t.closePrice ?? t.entryPrice);
    totalR += r;
    cumR += r;
    if (r > 0) wins++;
    else if (r < 0) losses++;
    else breakevens++;
    equitySeries.push({
      index: i + 1,
      date: t.closedAt ?? t.followedAt,
      r,
      cumR,
      symbol: t.symbol,
    });
    perAssetMap.set(t.symbol, (perAssetMap.get(t.symbol) ?? 0) + r);
    assetTypeMap.set(t.assetType, (assetTypeMap.get(t.assetType) ?? 0) + r);
    const d = dirMap.get(t.signal) ?? { count: 0, r: 0 };
    dirMap.set(t.signal, { count: d.count + 1, r: d.r + r });
    if (t.grade) {
      const g = gradeMap.get(t.grade) ?? { count: 0, r: 0 };
      gradeMap.set(t.grade, { count: g.count + 1, r: g.r + r });
    }
    const day = dayKey(t.closedAt ?? t.followedAt);
    dateToR.set(day, (dateToR.get(day) ?? 0) + r);
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

  let initialCumR = 0;
  for (const [date, r] of dateToR.entries()) {
    if (date < minDayStr) {
      initialCumR += r;
    }
  }

  let dayCum = initialCumR;
  const dailySeries = daysInMonth.map((date) => {
    const dayR = dateToR.get(date) ?? 0;
    dayCum += dayR;
    return { date, dayR, cumR: dayCum };
  });

  return {
    totalFollowed: closed + openCount,
    open: openCount,
    closed,
    winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
    avgR: closed > 0 ? totalR / closed : 0,
    totalR,
    equitySeries,
    dailySeries,
    // Matches the table's Status column (open vs closed lifecycle). Uses the shared LIFECYCLE_STATUSES array.
    statusDistribution: LIFECYCLE_STATUSES.map((status) => ({
      status,
      count: status === "open" ? openCount : closed,
    })),
    perAsset: [...perAssetMap.entries()].map(([symbol, r]) => ({
      symbol,
      r,
    })),
    byAssetType: TRADEABLE_ASSET_TYPES.map((assetType) => ({
      assetType,
      r: assetTypeMap.get(assetType) ?? 0,
    })),
    // Fixed order (long → short) to match the signal filter dropdown. Uses the shared FOLLOW_SIGNALS array.
    longVsShort: FOLLOW_SIGNALS.map((signal) => {
      const v = dirMap.get(signal) ?? { count: 0, r: 0 };
      return { signal, count: v.count, r: v.r };
    }),
    winLoss: { wins, losses, breakevens },
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
