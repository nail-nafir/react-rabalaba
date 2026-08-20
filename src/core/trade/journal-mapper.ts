/** Pure persistence-shape mappers shared by the browser and edge build. */
import type {
  FollowedTrade,
  FollowSignal,
  FollowStatus,
} from "@/core/trade/follow-trade-model";
import type { AssetType, SignalTier } from "@/types/asset";
import type {
  JournalTradeInsert,
  JournalTradeRow,
} from "@/types/journal";

export function rowToFollowedTrade(r: JournalTradeRow): FollowedTrade {
  return {
    id: r.id,
    symbol: r.symbol,
    name: r.name,
    assetType: r.asset_type as AssetType,
    signal: r.signal as FollowSignal,
    timeframe: r.timeframe,
    entryPrice: r.entry_price,
    stopLoss: r.stop_loss,
    takeProfits: r.take_profits ?? [],
    riskRewardRatio: r.risk_reward_ratio ?? 0,
    strengthAtEntry: r.strength_at_entry ?? 0,
    grade: (r.grade ?? undefined) as SignalTier | undefined,
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
    timeframe: t.timeframe,
    entry_price: t.entryPrice,
    stop_loss: t.stopLoss,
    take_profits: t.takeProfits,
    risk_reward_ratio: t.riskRewardRatio,
    strength_at_entry: t.strengthAtEntry,
    grade: t.grade ?? null,
    status: t.status,
    highest_tp_reached: t.highestTpReached,
    opened_at: new Date(t.followedAt).toISOString(),
    close_price: t.closePrice ?? null,
    closed_at: t.closedAt ? new Date(t.closedAt).toISOString() : null,
  };
}
