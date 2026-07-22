import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import {
  buildLoginRedirectForTarget,
  sanitizeInternalRedirect,
} from "@/lib/auth-redirect";
import { toast } from "sonner";

/**
 * OAuth landing route (/auth/callback). Google → Supabase → here with a `?code`
 * that supabase-js auto-exchanges for a session (detectSessionInUrl). We just
 * wait for the session to materialize in Redux, then forward to `redirect`.
 *
 * NOTE: `ready && !isAuthenticated` is NOT treated as failure — the initial
 * getSession() can resolve null before the code exchange completes; the
 * onAuthStateChange SIGNED_IN event lands a beat later. Only an explicit
 * provider `error` param or the timeout fallback bails out.
 */
export default function AuthCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const redirect = sanitizeInternalRedirect(params.get("redirect"));
  const handled = useRef(false);

  // Provider returned an error (e.g. user denied consent) → straight to login.
  const error = params.get("error") || params.get("error_description");

  useEffect(() => {
    if (handled.current) return;

    if (error) {
      handled.current = true;
      toast.error(t("toasts.auth.google_error"));
      navigate(buildLoginRedirectForTarget(redirect), { replace: true });
      return;
    }

    if (isAuthenticated) {
      handled.current = true;
      navigate(redirect, { replace: true });
      return;
    }

    // Fallback: if no session shows up in time, the exchange likely failed.
    const timeout = setTimeout(() => {
      if (handled.current) return;
      handled.current = true;
      toast.error(t("toasts.auth.google_error"));
      navigate(buildLoginRedirectForTarget(redirect), { replace: true });
    }, 8000);
    return () => clearTimeout(timeout);
  }, [error, isAuthenticated, navigate, redirect, t]);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-background px-4">
      <Spinner className="h-8 w-8 text-primary" />
      <p className="text-sm font-medium text-muted-foreground">
        {t("auth.signing_in")}
      </p>
    </div>
  );
}
