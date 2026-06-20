/**
 * Supabase Auth session, mirrored into the Redux `auth` slice.
 *
 * Free tier stays ANONYMOUS — nothing here runs for logged-out users beyond a
 * null session. Login is required only to redeem a code; the entitlement itself
 * lives server-side in `profiles` (see [[use-premium-access]]), so it can't be
 * forged from the client the way the old localStorage grant could.
 */
import { supabase } from "@/services/supabase/client";
import { store } from "@/store";
import { authActions } from "@/store/slices/auth-slice";
import { useAppSelector } from "@/store/hooks";

// Hydrate once on first import, then stay in sync with every auth change
// (login, logout, token refresh, multi-tab). Module-level so it runs exactly
// once regardless of how many components mount useAuth. Dispatches straight to
// the singleton store (the same instance the <Provider> uses).
let initialized = false;
function initAuth() {
  if (initialized) return;
  initialized = true;
  supabase.auth.getSession().then(({ data }) => {
    store.dispatch(authActions.setSession(data.session));
    store.dispatch(authActions.setReady(true));
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    store.dispatch(authActions.setSession(session));
  });
}
initAuth();

export function useAuth() {
  const session = useAppSelector((s) => s.auth.session);
  const user = useAppSelector((s) => s.auth.user);
  const ready = useAppSelector((s) => s.auth.ready);

  return {
    session,
    user,
    ready,
    isAuthenticated: !!session,
    signIn: (email: string, password: string) =>
      supabase.auth.signInWithPassword({ email, password }),
    signUp: (email: string, password: string) =>
      supabase.auth.signUp({ email, password }),
    signOut: () => supabase.auth.signOut(),
  };
}
