import { canonicalTimeframe } from "@/constants/timeframes";
import type { FollowSignal } from "@/constants/taxonomy/status";
import type { SignalDirection } from "@/constants/taxonomy/signal";
import type { TradingPlan, UnifiedAsset } from "@/types/asset";
import type {
  JournalSignalStateRow,
  JournalSignalStateUpsert,
} from "@/types/journal";

/** Browser presentation only; raw engine decisions remain on UnifiedAsset. */
export type TerminalSignalStatus =
  | "active"
  | "pending"
  | "blocked"
  | "neutral"
  | "unavailable";

export interface TerminalAsset extends UnifiedAsset {
  signalStatus: TerminalSignalStatus;
}

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
    blocked_signal:
      raw === "neutral" ? null : (current?.blocked_signal ?? null),
    last_raw_signal: raw,
    decision_candle_open_at:
      raw === "neutral" || keepActiveEpisode
        ? (current?.decision_candle_open_at ?? null)
        : iso(asset.decisionCandleOpenAt),
    decision_candle_closed_at:
      raw === "neutral" || keepActiveEpisode
        ? (current?.decision_candle_closed_at ?? null)
        : iso(asset.decisionCandleClosedAt),
    entry_price:
      raw === "neutral" || keepActiveEpisode
        ? (current?.entry_price ?? null)
        : (plan?.entry ?? null),
    stop_loss:
      raw === "neutral" || keepActiveEpisode
        ? (current?.stop_loss ?? null)
        : (plan?.stopLoss ?? null),
    take_profits:
      raw === "neutral" || keepActiveEpisode
        ? (current?.take_profits ?? [])
        : [plan?.takeProfit1, plan?.takeProfit2, plan?.takeProfit3].filter(
            (value): value is number =>
              typeof value === "number" && Number.isFinite(value),
          ),
    risk_reward_ratio:
      raw === "neutral" || keepActiveEpisode
        ? (current?.risk_reward_ratio ?? null)
        : (plan?.riskRewardRatio ?? null),
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
  const targets = state.take_profits;
  if (
    (state.active_signal !== "long" && state.active_signal !== "short") ||
    !positiveNumber(state.entry_price) ||
    !positiveNumber(state.stop_loss) ||
    !positiveNumber(state.risk_reward_ratio) ||
    !Array.isArray(targets) ||
    targets.length < 2 ||
    targets.length > 3 ||
    !targets.every(positiveNumber)
  ) {
    return null;
  }
  const direction = state.active_signal === "long" ? 1 : -1;
  const levels = [state.stop_loss, state.entry_price, ...targets];
  if (
    levels.some((level, i) => i > 0 && (level - levels[i - 1]) * direction <= 0)
  ) {
    return null;
  }
  const [takeProfit1, takeProfit2, takeProfit3] = targets;
  return {
    entry: state.entry_price,
    stopLoss: state.stop_loss,
    takeProfit1,
    takeProfit2,
    takeProfit3,
    riskRewardRatio: state.risk_reward_ratio,
  };
}

function positiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Publish only recorded active episodes. Never promote a raw candidate or
 * recreate a missing snapshot from the current price. Server observation and
 * re-arming continue to consume the unprojected asset, not this UI result. */
export function applySignalEpisode(
  asset: UnifiedAsset,
  state?: JournalSignalStateRow,
  stateAvailable = true,
): TerminalAsset {
  const raw = asset.outlook?.signal ?? "neutral";
  const plan = state?.active_signal ? episodePlan(state) : null;
  let signalStatus: TerminalSignalStatus;
  if (
    !stateAvailable ||
    !asset.outlook ||
    (state &&
      signalEpisodeKey(state.symbol, state.timeframe) !==
        signalEpisodeKey(asset.symbol, asset.timeframe))
  ) {
    signalStatus = "unavailable";
  } else if (state?.active_signal) {
    signalStatus = plan ? "active" : "unavailable";
  } else if (raw !== "neutral" && state?.blocked_signal === raw) {
    signalStatus = "blocked";
  } else {
    signalStatus = raw === "neutral" ? "neutral" : "pending";
  }
  const signal: SignalDirection =
    signalStatus === "active" ? state!.active_signal! : "neutral";
  return {
    ...asset,
    signalStatus,
    outlook: asset.outlook
      ? {
          ...asset.outlook,
          signal,
          suppressed: signalStatus === "neutral" && asset.outlook.suppressed,
        }
      : null,
    tradingPlan: signalStatus === "active" ? plan : null,
  };
}
