/**
 * Hand-written DB types for the Supabase schema (mirrors
 * supabase/migrations/20260613000001_journal_trades.sql). Pure — no runtime,
 * no browser/Vite deps (the taxonomy imports below are type-only, erased) — so
 * BOTH the Vite app and the Cron Worker can import it.
 */
import type { FollowStatus, FollowSignal } from "@/constants/taxonomy/status";
import type { SignalTier } from "@/constants/taxonomy/tier";

/** FollowStatus mirrored in the DB. 'open' = live (UI: "RUNNING TRADE"). */
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
  status: JournalStatus;
  highest_tp_reached: number;
  /** Closed by a SIGNAL REVERSAL (vs a price TP/SL hit). DB default false. */
  reversed: boolean;
  /** timestamptz, ISO string. */
  opened_at: string;
  closed_at: string | null;
  close_price: number | null;
  created_at: string;
  updated_at: string;
}

/** Insert shape: DB defaults id/timestamps/reversed, so they're optional on write. */
export type JournalTradeInsert = Omit<
  JournalTradeRow,
  "id" | "created_at" | "updated_at" | "reversed"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  reversed?: boolean;
};

export type JournalTradeUpdate = Partial<JournalTradeRow>;

/** Per-user entitlement (mirrors 20260614000001_auth_entitlements.sql). */
export interface ProfileRow {
  user_id: string;
  tier: "free" | "trial" | "premium";
  /** timestamptz ISO string; null unless on a trial. */
  trial_expires_at: string | null;
  /** Manages the auto-journal universe via the admin UI (20260617000001). */
  is_admin: boolean;
  is_owner: boolean;
  updated_at: string;
}

/** A symbol in the auto-journal (cron) universe — the runtime source of truth
 *  that replaces the bundled EDGE_UNIVERSE (mirrors 20260617000001_journal_assets.sql). */
export interface JournalAssetRow {
  symbol: string;
  name: string | null;
  asset_type: string | null;
  active: boolean;
  sort_order: number | null;
  created_by: string | null;
  created_at: string;
}

/** Insert shape: DB defaults active/created_at, so they're optional on write. */
export type JournalAssetInsert = Omit<
  JournalAssetRow,
  "active" | "created_at"
> & { active?: boolean; created_at?: string };

/** Auto-journal schedule config — a SINGLETON row (id is always true). Mirrors
 *  20260617000002_journal_settings.sql. The edge function reads it each cron
 *  tick to decide enabled/interval/market-hours; admins edit it via the UI. */
export interface JournalSettingsRow {
  id: boolean;
  enabled: boolean;
  interval_minutes: number;
  market_hours_only: boolean;
  /** timestamptz ISO string; null until the first run stamps it. */
  last_run_at: string | null;
  updated_at: string;
  updated_by: string | null;
}

/** Row shape returned by the admin_list_users() RPC
 *  (mirrors 20260623000001_admin_list_users.sql). */
export interface AdminUserRow {
  user_id: string;
  email: string;
  tier: "free" | "trial" | "premium";
  is_admin: boolean;
  is_owner: boolean;
  is_blocked: boolean;
  trial_expires_at: string | null;
  access_code: string | null;
  access_code_kind: string | null;
  redeemed_at: string | null;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  created_at: string;
}

/** Row shape returned by the admin_list_access_codes() RPC
 *  (mirrors 20260623000001_admin_list_users.sql). */
export interface AccessCodeRow {
  code: string;
  kind: "full" | "trial";
  note: string | null;
  max_redemptions: number | null;
  trial_days: number | null;
  redemption_count: number;
  created_at: string;
}

/** Per-user favorite ticker (mirrors 20260615000001_user_favorites.sql). */
export interface UserFavoriteRow {
  user_id: string;
  symbol: string;
  created_at: string;
}

/** Insert shape: DB defaults created_at. */
export type UserFavoriteInsert = Omit<UserFavoriteRow, "created_at"> & {
  created_at?: string;
};

/** supabase-js Database generic (standard generated shape). */
export interface Database {
  public: {
    Tables: {
      journal_trades: {
        Row: JournalTradeRow;
        Insert: JournalTradeInsert;
        Update: JournalTradeUpdate;
      };
      profiles: {
        Row: ProfileRow;
        Insert: ProfileRow;
        Update: Partial<ProfileRow>;
      };
      user_favorites: {
        Row: UserFavoriteRow;
        Insert: UserFavoriteInsert;
        Update: Partial<UserFavoriteRow>;
      };
      journal_assets: {
        Row: JournalAssetRow;
        Insert: JournalAssetInsert;
        Update: Partial<JournalAssetRow>;
      };
      journal_settings: {
        Row: JournalSettingsRow;
        Insert: Partial<JournalSettingsRow>;
        Update: Partial<JournalSettingsRow>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      /** Server-side access-code check — returns 'full' | 'trial' | null. */
      verify_access_code: {
        Args: { p_code: string };
        Returns: string | null;
      };
      /** Redeem a code for the authed caller; writes profiles.tier server-side.
       *  Returns 'premium'|'trial'|'invalid'|'exhausted'|'already'|'unauthenticated'. */
      redeem_access_code: {
        Args: { p_code: string };
        Returns: string;
      };
      /** Admin-only: returns every registered user with their entitlement + access-code. */
      admin_list_users: {
        Args: Record<string, never>;
        Returns: AdminUserRow[];
      };
      /** Admin-only: returns every access code with its redemption count. */
      admin_list_access_codes: {
        Args: Record<string, never>;
        Returns: AccessCodeRow[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
