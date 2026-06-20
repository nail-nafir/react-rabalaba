import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";

/** Google's multi-color "G" mark. lucide-react has no brand icons, so it lives
 *  here as a tiny inline SVG. Keeps its own colors regardless of theme. */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

interface GoogleAuthButtonProps {
  /** Where to land after a successful sign-in (carried through the OAuth round-trip). */
  redirect: string;
}

/** Shared "Continue with Google" block (divider + button) used by the login and
 *  register pages. Kicks off the OAuth redirect; on failure it surfaces a toast
 *  and resets, on success the browser navigates away so loading just stays on. */
export function GoogleAuthButton({ redirect }: GoogleAuthButtonProps) {
  const { t } = useTranslation();
  const { signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const onClick = async () => {
    setIsLoading(true);
    const { error } = await signInWithGoogle(redirect);
    if (error) {
      toast.error(t("auth.google_failed"));
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 delay-150">
      {/* Divider */}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border/60" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {t("auth.or_continue_with")}
        </span>
        <span className="h-px flex-1 bg-border/60" />
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={onClick}
        disabled={isLoading}
        className="h-10 w-full cursor-pointer gap-2 rounded-lg border-border/80 text-xs font-extrabold transition-all hover:-translate-y-px active:translate-y-px active:scale-[0.985]"
      >
        {isLoading ? (
          <Spinner className="h-4 w-4" />
        ) : (
          <GoogleIcon className="h-4 w-4" />
        )}
        <span>{t("auth.continue_with_google")}</span>
      </Button>
    </div>
  );
}
