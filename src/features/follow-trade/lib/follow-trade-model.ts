import type { AssetType, SignalTier, UnifiedAsset } from "@/types/asset";

/** Lifecycle status of a followed trade. `open` while live; the rest are terminal. */
export type FollowStatus = "open" | "tp1" | "tp2" | "tp3" | "sl" | "manual";
export type FollowSignal = "long" | "short";

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
}

/**
 * Evaluate a trade against the latest price.
 * - final (highest) TP hit -> close at that TP.
 * - SL hit with no TP touched -> close as loss.
 * - SL hit after a TP was touched -> close at the highest TP (secured profit).
 * - otherwise stay open, advancing the monotonic milestone.
 */
export function evaluateFollow(
  trade: FollowedTrade,
  price: number,
): FollowEvaluation {
  const { signal, stopLoss, takeProfits } = trade;
  const isLong = signal === "long";
  const reached = (level: number) => (isLong ? price >= level : price <= level);
  const hitStop = isLong ? price <= stopLoss : price >= stopLoss;

  let reachedNow = 0;
  for (let i = 0; i < takeProfits.length; i++) {
    if (reached(takeProfits[i])) reachedNow = i + 1;
    else break;
  }
  const highestTpReached = Math.max(trade.highestTpReached, reachedNow);
  const finalIndex = takeProfits.length;

  if (finalIndex > 0 && highestTpReached >= finalIndex) {
    return {
      status: `tp${finalIndex}` as FollowStatus,
      highestTpReached: finalIndex,
      closePrice: takeProfits[finalIndex - 1],
      closed: true,
    };
  }

  if (hitStop) {
    if (highestTpReached === 0) {
      return { status: "sl", highestTpReached, closePrice: stopLoss, closed: true };
    }
    return {
      status: `tp${highestTpReached}` as FollowStatus,
      highestTpReached,
      closePrice: takeProfits[highestTpReached - 1],
      closed: true,
    };
  }

  return { status: "open", highestTpReached, closed: false };
}

/** Apply a price snapshot to all open trades, partitioning into open/closed. */
export function applyPriceSync(
  openTrades: FollowedTrade[],
  prices: Record<string, number>,
): { stillOpen: FollowedTrade[]; justClosed: FollowedTrade[] } {
  const stillOpen: FollowedTrade[] = [];
  const justClosed: FollowedTrade[] = [];
  for (const trade of openTrades) {
    const price = prices[trade.symbol];
    if (typeof price !== "number" || !Number.isFinite(price)) {
      stillOpen.push(trade);
      continue;
    }
    const ev = evaluateFollow(trade, price);
    if (ev.closed) {
      justClosed.push({
        ...trade,
        status: ev.status,
        highestTpReached: ev.highestTpReached,
        closePrice: ev.closePrice,
        closedAt: Date.now(),
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
  equitySeries: { index: number; date: number; r: number; cumR: number; symbol: string }[];
  statusDistribution: { status: FollowStatus; count: number }[];
  perAsset: { symbol: string; r: number }[];
  longVsShort: { signal: FollowSignal; count: number; r: number }[];
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

  const statusCounts = new Map<FollowStatus, number>();
  const perAssetMap = new Map<string, number>();
  const dirMap = new Map<FollowSignal, { count: number; r: number }>();
  const equitySeries: TrackerStats["equitySeries"] = [];
  let totalR = 0;
  let wins = 0;
  let cumR = 0;

  ordered.forEach((t, i) => {
    const { r } = computePnl(t, t.closePrice ?? t.entryPrice);
    totalR += r;
    cumR += r;
    if (r > 0) wins++;
    equitySeries.push({
      index: i + 1,
      date: t.closedAt ?? t.followedAt,
      r,
      cumR,
      symbol: t.symbol,
    });
    statusCounts.set(t.status, (statusCounts.get(t.status) ?? 0) + 1);
    perAssetMap.set(t.symbol, (perAssetMap.get(t.symbol) ?? 0) + r);
    const d = dirMap.get(t.signal) ?? { count: 0, r: 0 };
    dirMap.set(t.signal, { count: d.count + 1, r: d.r + r });
  });

  return {
    totalFollowed: closed + openCount,
    open: openCount,
    closed,
    winRate: closed > 0 ? (wins / closed) * 100 : 0,
    avgR: closed > 0 ? totalR / closed : 0,
    totalR,
    equitySeries,
    statusDistribution: [...statusCounts.entries()].map(([status, count]) => ({
      status,
      count,
    })),
    perAsset: [...perAssetMap.entries()].map(([symbol, r]) => ({ symbol, r })),
    longVsShort: [...dirMap.entries()].map(([signal, v]) => ({
      signal,
      count: v.count,
      r: v.r,
    })),
  };
}
