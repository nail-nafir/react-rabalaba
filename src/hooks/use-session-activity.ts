/**
 * Session activity — two jobs sharing one "last active" signal:
 *
 *  1. Stamp profiles.last_active_at whenever the app actually hits the backend,
 *     so the admin User Management table shows when a user last USED the app —
 *     not just when they last logged in (last_sign_in_at only moves on login).
 *     We piggyback on React Query: every fetch goes through the cache, and the
 *     app-wide `refetchInterval` (query-client) re-hits the backend ~every 5 min
 *     WHILE the tab is open and visible, then pauses when it's hidden/closed.
 *     Server writes are throttled to at most one per THROTTLE_MS.
 *
 *  2. Client-side idle logout: if the user hasn't touched the app for
 *     IDLE_LIMIT_MS (1 week), sign them out — on next load or the periodic check.
 *     Native Supabase session timebox needs a Pro plan, so we enforce it here.
 *     This is convenience/hygiene, NOT a hard boundary (localStorage is user
 *     editable); real access stays enforced server-side by RLS regardless.
 *
 * See [[use-auth]] (session) and [[use-premium-access]] (profile row).
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/services/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import i18n from "@/app/config/i18n";

const THROTTLE_MS = 5 * 60_000; // ≤ one server stamp / 5 min
const IDLE_LIMIT_MS = 7 * 24 * 60 * 60_000; // logout after 1 week idle
const IDLE_CHECK_MS = 5 * 60_000; // re-check while the tab stays open
const LAST_ACTIVE_KEY = "rabalaba-last-active";

function readLastActive(): number {
  const n = Number(localStorage.getItem(LAST_ACTIVE_KEY));
  return Number.isFinite(n) ? n : 0;
}

export function useSessionActivity() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const lastStamp = useRef(0);

  useEffect(() => {
    // Only logged-in users have a profile row / session. Keyed on userId (not the
    // session) so an hourly token refresh doesn't re-subscribe.
    if (!userId) return;

    const logoutIfIdle = () => {
      const last = readLastActive();
      if (last && Date.now() - last > IDLE_LIMIT_MS) {
        localStorage.removeItem(LAST_ACTIVE_KEY);
        // Global i18n.t (not the hook) — this fires from a timer/callback.
        toast.info(i18n.t("auth.session_idle_logout"));
        supabase.auth.signOut().catch(() => {});
        return true;
      }
      return false;
    };

    // Stale session from a previous visit → sign out and stop. (No stored value
    // = brand-new/first-load session; seeded below, never logged out here.)
    if (logoutIfIdle()) return;

    const onActivity = () => {
      localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
      const now = Date.now();
      if (now - lastStamp.current < THROTTLE_MS) return;
      lastStamp.current = now;
      // The rpc builder is lazy — .then() is what actually sends it; both handlers
      // swallow the result/error (offline/transient → the next fetch retries).
      supabase.rpc("touch_last_active" as never).then(
        () => {},
        () => {},
      );
    };

    // Access on load, then on every successful backend fetch.
    onActivity();
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") {
        onActivity();
      }
    });
    const idleTimer = setInterval(logoutIfIdle, IDLE_CHECK_MS);

    return () => {
      unsubscribe();
      clearInterval(idleTimer);
    };
  }, [userId, queryClient]);
}
