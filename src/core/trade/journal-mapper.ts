/** Pure persistence-shape mappers shared by the browser and edge build. */
import type {
  FollowedTrade,
  FollowSignal,
  FollowStatus,
} from "@/core/trade/follow-trade-model";
import type { AssetType, SignalTier } from "@/types/asset";
import type { JournalTradeInsert, JournalTradeRow } from "@/types/journal";
import { canonicalTimeframe } from "@/constants/timeframes";

export function rowToFollowedTrade(r: JournalTradeRow): FollowedTrade {
  return {
    id: r.id,
    symbol: r.symbol,
    name: r.name,
    assetType: r.asset_type as AssetType,
    signal: r.signal as FollowSignal,
    timeframe: canonicalTimeframe(r.timeframe),
    entryPrice: r.entry_price,
    stopLoss: r.stop_loss,
    takeProfits: r.take_profits ?? [],
    riskRewardRatio: r.risk_reward_ratio ?? 0,
    strengthAtEntry: r.strength_at_entry ?? 0,
    grade: (r.grade ?? undefined) as SignalTier | undefined,
    engineVersion: r.engine_version ?? undefined,
    decisionCandleTime: r.decision_candle_at
      ? Date.parse(r.decision_candle_at)
      : undefined,
    regime: r.regime ?? undefined,
    higherTimeframeTrend: r.higher_timeframe_trend ?? undefined,
    directionScore: r.direction_score ?? undefined,
    followedAt: Date.parse(r.opened_at),
    highestTpReached: r.highest_tp_reached,
    status: r.status as FollowStatus,
    reversed: r.reversed ?? false,
    closePrice: r.close_price ?? undefined,
    closedAt: r.closed_at ? Date.parse(r.closed_at) : undefined,
  };
}

export function followedTradeToInsert(t: FollowedTrade): JournalTradeInsert {
  return {
    symbol: t.symbol,
    name: t.name,
    asset_type: t.assetType,
    signal: t.signal,
    timeframe: canonicalTimeframe(t.timeframe),
    entry_price: t.entryPrice,
    stop_loss: t.stopLoss,
    take_profits: t.takeProfits,
    risk_reward_ratio: t.riskRewardRatio,
    strength_at_entry: t.strengthAtEntry,
    grade: t.grade ?? null,
    engine_version: t.engineVersion ?? null,
    decision_candle_at: t.decisionCandleTime
      ? new Date(t.decisionCandleTime).toISOString()
      : null,
    regime: t.regime ?? null,
    higher_timeframe_trend: t.higherTimeframeTrend ?? null,
    direction_score: t.directionScore ?? null,
    status: t.status,
    highest_tp_reached: t.highestTpReached,
    opened_at: new Date(t.followedAt).toISOString(),
    close_price: t.closePrice ?? null,
    closed_at: t.closedAt ? new Date(t.closedAt).toISOString() : null,
  };
}
