import { canonicalTimeframe } from "@/constants/timeframes";
import type { FollowSignal } from "@/constants/taxonomy/status";
import type { SignalDirection } from "@/constants/taxonomy/signal";
import type { TradingPlan, UnifiedAsset } from "@/types/asset";
import type {
  JournalSignalStateRow,
  JournalSignalStateUpsert,
} from "@/types/journal";

export function signalEpisodeKey(symbol: string, timeframe?: string): string {
  return `${symbol}|${canonicalTimeframe(timeframe)}`;
}

function iso(value?: number): string | null {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value).toISOString()
    : null;
}

export function observeSignalEpisode(
  current: JournalSignalStateRow | JournalSignalStateUpsert | undefined,
  asset: UnifiedAsset,
  now: number,
): JournalSignalStateUpsert {
  const raw = asset.outlook?.signal ?? "neutral";
  const keepActiveEpisode = current?.active_signal != null;
  const plan = asset.tradingPlan;
  return {
    symbol: asset.symbol,
    timeframe: canonicalTimeframe(asset.timeframe),
    active_signal: current?.active_signal ?? null,
    blocked_signal: raw === "neutral" ? null : current?.blocked_signal ?? null,
    last_raw_signal: raw,
    decision_candle_open_at:
      raw === "neutral" || keepActiveEpisode
        ? current?.decision_candle_open_at ?? null
        : iso(asset.decisionCandleOpenAt),
    decision_candle_closed_at:
      raw === "neutral" || keepActiveEpisode
        ? current?.decision_candle_closed_at ?? null
        : iso(asset.decisionCandleClosedAt),
    entry_price:
      raw === "neutral" || keepActiveEpisode
        ? current?.entry_price ?? null
        : plan?.entry ?? null,
    stop_loss:
      raw === "neutral" || keepActiveEpisode
        ? current?.stop_loss ?? null
        : plan?.stopLoss ?? null,
    take_profits:
      raw === "neutral" || keepActiveEpisode
        ? current?.take_profits ?? []
        : [plan?.takeProfit1, plan?.takeProfit2, plan?.takeProfit3].filter(
            (value): value is number =>
              typeof value === "number" && Number.isFinite(value),
          ),
    risk_reward_ratio:
      raw === "neutral" || keepActiveEpisode
        ? current?.risk_reward_ratio ?? null
        : plan?.riskRewardRatio ?? null,
    updated_at: new Date(now).toISOString(),
  };
}

export function closeSignalEpisode(
  state: JournalSignalStateUpsert,
  signal: FollowSignal,
): JournalSignalStateUpsert {
  return { ...state, active_signal: null, blocked_signal: signal };
}

export function activateSignalEpisode(
  state: JournalSignalStateUpsert,
  signal: FollowSignal,
): JournalSignalStateUpsert {
  return { ...state, active_signal: signal };
}

function episodePlan(state: JournalSignalStateRow): TradingPlan | null {
  const [takeProfit1, takeProfit2, takeProfit3] = state.take_profits ?? [];
  if (
    state.entry_price == null ||
    state.stop_loss == null ||
    takeProfit1 == null ||
    takeProfit2 == null ||
    state.risk_reward_ratio == null
  ) {
    return null;
  }
  return {
    entry: state.entry_price,
    stopLoss: state.stop_loss,
    takeProfit1,
    takeProfit2,
    takeProfit3,
    riskRewardRatio: state.risk_reward_ratio,
  };
}

/** Terminal projection: keep the open episode and its original setup visible,
 * then suppress a closed direction until the raw engine passes through neutral. */
export function applySignalEpisode(
  asset: UnifiedAsset,
  state?: JournalSignalStateRow,
): UnifiedAsset {
  if (!asset.outlook || !state) return asset;
  const raw = asset.outlook.signal;
  if (state.active_signal) {
    const signal: SignalDirection = state.active_signal;
    return {
      ...asset,
      outlook:
        signal === raw ? asset.outlook : { ...asset.outlook, signal },
      tradingPlan: episodePlan(state),
    };
  }
  if (state.blocked_signal !== raw) return asset;
  return {
    ...asset,
    outlook: { ...asset.outlook, signal: "neutral" },
    tradingPlan: null,
  };
}
