/**
 * Premium entitlement — now SERVER-TRUTH, read from the `profiles` row of the
 * authenticated user (RLS: a user can only read their own). Replaces the old
 * forgeable localStorage grant + env trial. Free tier is the logged-out (or
 * tier='free') state; codes are redeemed via the redeem_access_code RPC which
 * writes the tier server-side. See [[use-auth]].
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase/client";
import type { ProfileRow } from "@/services/supabase/database.types";
import { useAuth } from "@/hooks/use-auth";
import { trialDaysLeft } from "@/lib/premium-trial";

export type AccessResult =
  | "granted"
  | "trial"
  | "invalid"
  | "exhausted"
  | "already"
  | "blocked"
  | "unauthenticated";

export type LicenseTier = "free" | "trial" | "premium";

export interface LicenseStatus {
  tier: LicenseTier;
  hasAccess: boolean;
  expiresAt: number | null;
}

const FREE: LicenseStatus = { tier: "free", hasAccess: false, expiresAt: null };

async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  // The hand-written Database type doesn't resolve select() shapes (yields
  // `never`); the row is known from the schema, so assert it.
  return data as ProfileRow | null;
}

export function usePremiumAccess() {
  const { user, ready } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  // One shared query per user (react-query dedupes across every consumer).
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: () => fetchProfile(userId!),
  });

  // Wall-clock 'now', refreshed on an interval. Kept in state rather than read
  // via Date.now() during render so `status` below stays a PURE derivation of
  // its deps. Ticking it also flips an expired trial to free mid-session
  // without waiting on the next profile refetch.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Effective access is computed from server fields; the stored tier never
  // auto-flips on expiry (no cron), so a stale 'trial' past its date reads free.
  const status = useMemo<LicenseStatus>(() => {
    if (!userId || !profile || profile.is_blocked) return FREE;
    if (profile.tier === "premium") {
      return { tier: "premium", hasAccess: true, expiresAt: null };
    }
    if (profile.tier === "trial" && profile.trial_expires_at) {
      const exp = Date.parse(profile.trial_expires_at);
      if (Number.isFinite(exp) && exp > now) {
        return { tier: "trial", hasAccess: true, expiresAt: exp };
      }
    }
    return FREE;
  }, [userId, profile, now]);

  const grantAccess = useCallback(
    async (code: string): Promise<AccessResult> => {
      if (!userId) return "unauthenticated";

      // Redemption is a privileged transition. Re-check the profile instead
      // of trusting the minute-long display cache, and never consume a code for
      // an account that the server currently marks as blocked.
      try {
        const currentProfile = await queryClient.fetchQuery({
          queryKey: ["profile", userId],
          queryFn: () => fetchProfile(userId),
          staleTime: 0,
        });
        if (currentProfile?.is_blocked) return "blocked";
      } catch {
        return "invalid";
      }

      let kind: string | null;
      try {
        // postgrest's typed rpc overload mis-resolves single-arg fns; cast args.
        const { data, error } = await supabase.rpc("redeem_access_code", {
          p_code: code,
        } as never);
        if (error) throw error;
        kind = data as string | null;
      } catch {
        return "invalid";
      }
      // Pull the fresh entitlement so the gate updates immediately.
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      switch (kind) {
        case "premium":
          return "granted";
        case "trial":
          return "trial";
        case "exhausted":
          return "exhausted";
        case "already":
          return "already";
        case "unauthenticated":
          return "unauthenticated";
        default:
          return "invalid";
      }
    },
    [queryClient, userId],
  );

  const checkAccess = useCallback(() => status.hasAccess, [status.hasAccess]);
  const isResolving = !ready || (!!userId && isProfileLoading);
  const isBlocked = profile?.is_blocked === true;

  return {
    hasAccess: status.hasAccess,
    tier: status.tier,
    expiresAt: status.expiresAt,
    daysLeft: status.expiresAt != null ? trialDaysLeft(status.expiresAt) : null,
    // Manages the auto-journal universe (admin UI). Read off the same profile
    // row already fetched above — no extra query. See [[use-journal-assets]].
    isAdmin: !isBlocked && (!!profile?.is_admin || !!profile?.is_owner),
    isOwner: !isBlocked && !!profile?.is_owner,
    isBlocked,
    isLoading: isResolving,
    // Entitlement not yet known: auth still resolving, OR a logged-in user whose
    // profile row is still in-flight. Lets the UI show a placeholder instead of
    // flashing the default 'free' state and snapping to 'premium' once it loads.
    // A logged-out (ready, no user) state is NOT resolving — it's settled free.
    isResolving,
    checkAccess,
    grantAccess,
    accessCode: "",
    isConfigured: true,
  };
}
