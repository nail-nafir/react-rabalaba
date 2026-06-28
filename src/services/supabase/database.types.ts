/**
 * Hand-written DB types for the Supabase schema (mirrors
 * supabase/migrations/20260613000001_journal_trades.sql). Pure — no runtime,
 * no browser/Vite deps (the taxonomy imports below are type-only, erased) — so
 * BOTH the Vite app and the Cron Worker can import it.
 */
import type { FollowStatus, FollowSignal } from "@/constants/taxonomy/status";
import type { SignalTier } from "@/constants/taxonomy/tier";
// Type-only (erased) — keeps this module runtime-pure for the Cron Worker.
import type { Localized } from "@/lib/localized";

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
  /** End-of-day Discord recap (see 20260629000001_journal_daily_summary.sql). */
  daily_summary_enabled: boolean;
  /** WIB hour (0..23) at/after which the recap is sent; 23 = end of day. */
  daily_summary_hour: number;
  /** timestamptz ISO string; null until the first recap is sent. */
  daily_summary_last_sent_at: string | null;
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
  /** Latest disclaimer version this user accepted + when (null = never). */
  disclaimer_version: number | null;
  disclaimer_agreed_at: string | null;
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

/** A subscription plan card — admin-editable, PUBLIC-read (the /subscription page
 *  is anonymous). Copy fields are bilingual JSONB ({ en, id }). The cron never
 *  touches this; it's display config. Mirrors 20260625000001_subscription.sql. */
export interface SubscriptionPlanRow {
  slug: string;
  sort_order: number;
  name: Localized;
  description: Localized;
  price: Localized;
  original_price: Localized | null;
  features: Localized<string[]>;
  /** lucide icon name rendered via ICON_MAP on the page (e.g. 'Zap'). */
  icon: string | null;
  highlighted: boolean;
  /** Drives the card CTA: open PaymentDialog / open LicenseDialog / external link. */
  cta_kind: "link" | "payment" | "license" | "contact";
  cta_link: string | null;
  active: boolean;
  updated_at: string;
  updated_by: string | null;
}

/** Insert shape: DB defaults updated_at; the hook stamps updated_by. */
export type SubscriptionPlanInsert = Omit<
  SubscriptionPlanRow,
  "updated_at" | "updated_by"
> & {
  updated_at?: string;
  updated_by?: string | null;
};

/** A payment channel shown on /subscription + inside the PaymentDialog.
 *  Public-read, admin-write. Mirrors 20260625000001_subscription.sql. */
export interface PaymentMethodRow {
  id: string;
  sort_order: number;
  category: "bank" | "ewallet" | "qris" | "crypto";
  name: string;
  account_no: string | null;
  account_name: string | null;
  /** Optional bilingual sub-label (e.g. "BNB Smart Chain network"). */
  note: Localized | null;
  icon: string | null;
  active: boolean;
  updated_at: string;
}

/** Insert shape: DB defaults id/updated_at. */
export type PaymentMethodInsert = Omit<PaymentMethodRow, "id" | "updated_at"> & {
  id?: string;
  updated_at?: string;
};

/** Risk disclaimer clauses — a SINGLETON row (id always true), VERSIONED so an
 *  admin edit re-prompts everyone. Public-read, admin-write. Bilingual JSONB.
 *  Mirrors 20260625000002_disclaimer.sql. */
export interface DisclaimerRow {
  id: boolean;
  version: number;
  title: Localized;
  description: Localized;
  points: Localized<string[]>;
  confirm_label: Localized;
  agree_label: Localized;
  updated_at: string;
  updated_by: string | null;
}

/** Record that a LOGGED-IN user accepted a disclaimer version (hybrid: anonymous
 *  visitors keep the localStorage flag). Mirrors 20260625000002_disclaimer.sql. */
export interface DisclaimerAgreementRow {
  user_id: string;
  version: number;
  agreed_at: string;
}

export type DisclaimerAgreementInsert = Omit<
  DisclaimerAgreementRow,
  "agreed_at"
> & { agreed_at?: string };

/** An admin-issued invitation that grants premium/trial when claimed at
 *  /invite/:code. The table is LOCKED (RLS, no policies) — reached only through
 *  the SECURITY DEFINER RPCs. `redemption_count` is computed by
 *  admin_list_invitations(). Mirrors 20260625000003_invitations.sql. */
export interface InvitationRow {
  code: string;
  kind: "full" | "trial";
  trial_days: number | null;
  max_redemptions: number | null;
  recipient_label: string | null;
  expires_at: string | null;
  revoked: boolean;
  redemption_count: number;
  created_by: string | null;
  created_at: string;
}

/** Pre-claim preview returned by peek_invitation() — never leaks the code list. */
export interface InvitationPeek {
  valid: boolean;
  kind: "full" | "trial" | null;
  trial_days: number | null;
  /** When !valid: 'invalid'|'expired'|'revoked'|'exhausted'. */
  reason: string | null;
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
      subscription_plans: {
        Row: SubscriptionPlanRow;
        Insert: SubscriptionPlanInsert;
        Update: Partial<SubscriptionPlanRow>;
      };
      payment_methods: {
        Row: PaymentMethodRow;
        Insert: PaymentMethodInsert;
        Update: Partial<PaymentMethodRow>;
      };
      disclaimer: {
        Row: DisclaimerRow;
        Insert: Partial<DisclaimerRow>;
        Update: Partial<DisclaimerRow>;
      };
      disclaimer_agreements: {
        Row: DisclaimerAgreementRow;
        Insert: DisclaimerAgreementInsert;
        Update: Partial<DisclaimerAgreementRow>;
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
      /** Anon-safe preview of an invitation for the /invite/:code page. */
      peek_invitation: {
        Args: { p_code: string };
        Returns: InvitationPeek;
      };
      /** Claim an invitation for the authed caller; writes profiles.tier.
       *  Returns 'premium'|'trial'|'invalid'|'expired'|'revoked'|'exhausted'|'already'|'unauthenticated'. */
      redeem_invitation: {
        Args: { p_code: string };
        Returns: string;
      };
      /** Admin-only: mint an invitation, server-generated code returned. */
      admin_create_invitation: {
        Args: {
          p_kind: string;
          p_trial_days: number | null;
          p_max_redemptions: number | null;
          p_recipient_label: string | null;
          p_expires_at: string | null;
        };
        Returns: string;
      };
      /** Admin-only: every invitation with its redemption count. */
      admin_list_invitations: {
        Args: Record<string, never>;
        Returns: InvitationRow[];
      };
      /** Admin-only: flip an invitation's revoked flag. */
      admin_revoke_invitation: {
        Args: { p_code: string; p_revoked: boolean };
        Returns: boolean;
      };
      /** Admin-only: permanently delete an invitation (redemptions cascade). */
      admin_delete_invitation: {
        Args: { p_code: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
