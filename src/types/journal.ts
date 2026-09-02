import type {
  ExitReason,
  FollowSignal,
  FollowStatus,
} from "@/constants/taxonomy/status";
import type { SignalTier } from "@/constants/taxonomy/tier";
import type { MarketRegime, TrendDirection } from "@/types/market";
import type { SignalDirection } from "@/constants/taxonomy/signal";

/** FollowStatus mirrored in the journal persistence contract. */
export type JournalStatus = FollowStatus;

export interface JournalTradeRow {
  id: string;
  symbol: string;
  name: string;
  asset_type: string;
  signal: FollowSignal;
  timeframe: string;
  entry_price: number;
  stop_loss: number;
  take_profits: number[];
  risk_reward_ratio: number | null;
  strength_at_entry: number | null;
  grade: SignalTier | null;
  engine_version: string | null;
  decision_candle_open_at: string | null;
  decision_candle_closed_at: string | null;
  regime: MarketRegime | null;
  higher_timeframe_trend: TrendDirection | null;
  direction_score: number | null;
  status: JournalStatus;
  highest_tp_reached: number;
  exit_reason: ExitReason | null;
  reversed: boolean;
  opened_at: string;
  closed_at: string | null;
  close_price: number | null;
  created_at: string;
  updated_at: string;
}

/** Insert shape: the database fills id/timestamps/reversed. */
export type JournalTradeInsert = Omit<
  JournalTradeRow,
  "id" | "created_at" | "updated_at" | "reversed"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  reversed?: boolean;
};

/** Persisted state for one raw signal episode per symbol/timeframe. */
export interface JournalSignalStateRow {
  symbol: string;
  timeframe: string;
  active_signal: FollowSignal | null;
  blocked_signal: FollowSignal | null;
  last_raw_signal: SignalDirection;
  decision_candle_open_at: string | null;
  decision_candle_closed_at: string | null;
  entry_price: number | null;
  stop_loss: number | null;
  take_profits: number[];
  risk_reward_ratio: number | null;
  updated_at: string;
}

export type JournalSignalStateUpsert = Omit<
  JournalSignalStateRow,
  "updated_at"
> & { updated_at?: string };
