import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  Ticket,
  CheckCircle2,
  XCircle,
  LogIn,
  UserPlus,
  ArrowRight,
} from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  useInvitation,
  useInvitationPeek,
  type ClaimResult,
} from "@/features/auth/hooks/use-invitation";

/** Centered card frame shared by every state of the invite page. */
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="w-full min-h-[70vh] flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md border border-border">{children}</Card>
    </div>
  );
}

/**
 * Public invite landing — /invite/:code. Anonymous visitors get a preview of the
 * invite and a login/register CTA (which returns here via ?redirect). Once
 * authenticated, the code is claimed automatically and the entitlement updates.
 */
export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ready, isAuthenticated } = useAuth();
  const {
    data: peek,
    isLoading,
    isError: peekError,
    isFetching: isPeeking,
    refetch: refetchPeek,
  } = useInvitationPeek(code);
  const { claim } = useInvitation();

  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const attempted = useRef(false);

  // Once authenticated, claim exactly once. The claim result (not the peek) is
  // the source of truth for logged-in users so "already claimed by me" reads
  // correctly even when a single-use code now looks exhausted.
  useEffect(() => {
    if (attempted.current || !ready || !code || !isAuthenticated) return;
    attempted.current = true;
    setClaiming(true);
    claim(code).then((r) => {
      setResult(r);
      setClaiming(false);
    });
  }, [ready, isAuthenticated, code, claim]);

  const redirectParam = `?redirect=${encodeURIComponent(`/invite/${code ?? ""}`)}`;

  // ── Booting / claiming ──
  if (!ready || (isAuthenticated && (claiming || !result)) || (!isAuthenticated && isLoading)) {
    return (
      <Shell>
        <CardContent className="flex flex-col items-center gap-4 py-14">
          <Spinner className="h-6 w-6 text-primary" />
          <p className="text-xs text-muted-foreground">
            {isAuthenticated
              ? t("invite.claiming")
              : t("invite.loading")}
          </p>
        </CardContent>
      </Shell>
    );
  }

  // ── Authenticated: show the claim outcome ──
  if (isAuthenticated && result) {
    const success = result === "premium" || result === "trial";
    if (success) {
      return (
        <Shell>
          <CardHeader className="flex flex-col items-center text-center gap-3 pt-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <CardTitle className="text-xl font-bold">
              {result === "premium"
                ? t("invite.success_premium_title")
                : t("invite.success_trial_title")}
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              {t("invite.success_desc")}
            </CardDescription>
          </CardHeader>
          <CardFooter className="pb-8">
            <Button
              onClick={() => navigate("/terminal")}
              className="w-full text-xs font-bold cursor-pointer gap-1.5"
            >
              {t("invite.go_terminal")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardFooter>
        </Shell>
      );
    }
    // Non-success outcomes (already / already_premium / expired / revoked / exhausted / invalid / error)
    const alreadyHadIt = result === "already" || result === "already_premium";
    const claimError = result === "error";
    return (
      <Shell>
        <CardContent className="p-0">
          <Empty
            role={claimError ? "alert" : undefined}
            className="min-h-64 border-0"
          >
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {claimError ? (
                  <AlertCircle aria-hidden="true" />
                ) : alreadyHadIt ? (
                  <CheckCircle2 aria-hidden="true" />
                ) : (
                  <XCircle aria-hidden="true" />
                )}
              </EmptyMedia>
              <EmptyTitle>
                {result === "already_premium"
                  ? t("invite.already_premium_title")
                  : alreadyHadIt
                    ? t("invite.already_title")
                    : t("invite.invalid_title")}
              </EmptyTitle>
              <EmptyDescription>
                {t(`invite.reason_${result}`, t("invite.invalid_desc"))}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                onClick={() => navigate("/terminal")}
              >
                {t("invite.go_terminal")}
              </Button>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Shell>
    );
  }

  // ── Anonymous: invalid invite ──
  if (peekError && !peek) {
    return (
      <Shell>
        <CardContent className="p-0">
          <Empty role="alert" className="min-h-64 border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <AlertCircle aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("common.load_error_title")}</EmptyTitle>
              <EmptyDescription>
                {t("common.load_error_description")}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                onClick={() => void refetchPeek()}
                disabled={isPeeking}
                aria-busy={isPeeking}
              >
                {t("common.retry")}
              </Button>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Shell>
    );
  }

  if (!peek || !peek.valid) {
    const reason = peek?.reason ?? "invalid";
    return (
      <Shell>
        <CardContent className="p-0">
          <Empty className="min-h-64 border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <XCircle aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("invite.invalid_title")}</EmptyTitle>
              <EmptyDescription>
                {t(`invite.reason_${reason}`, t("invite.invalid_desc"))}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild variant="outline">
                <Link to="/terminal">{t("invite.go_terminal")}</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Shell>
    );
  }

  // ── Anonymous: valid invite → offer + login/register ──
  const isTrial = peek.kind === "trial";
  return (
    <Shell>
      <CardHeader className="flex flex-col items-center text-center gap-3 pt-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Ticket className="h-8 w-8" />
        </div>
        <Badge
          variant="outline"
          className={cn(
            // No icon either way. Trial wears the terminal grade-B tier-pill
            // (amber, no uppercase); premium wears the terminal neutral-signal
            // style (purple, uppercase + tracked).
            "rounded-md text-[10px] font-bold",
            isTrial
              ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
              : "uppercase tracking-wider bg-primary/15 text-primary border-primary/30",
          )}
        >
          {isTrial ? t("license.tier_trial") : t("license.tier_premium")}
          {isTrial && peek.trial_days ? ` · ${peek.trial_days} ${t("invite.days")}` : ""}
        </Badge>
        <CardTitle className="text-xl font-bold">
          {t("invite.offer_title")}
        </CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          {isTrial
            ? t("invite.offer_trial_desc")
            : t("invite.offer_premium_desc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <Link
          to={`/login${redirectParam}`}
          className={cn(
            buttonVariants(),
            "h-9 w-full cursor-pointer text-xs font-bold tracking-tight bg-primary text-primary-foreground hover:bg-primary/80 shadow-none border-0 rounded-lg flex items-center justify-center gap-1.5 transition-all",
          )}
        >
          <LogIn className="h-3.5 w-3.5" />
          {t("invite.login_to_claim")}
        </Link>
        <Link
          to={`/register${redirectParam}`}
          className={cn(
            buttonVariants(),
            "h-9 w-full cursor-pointer text-xs font-bold tracking-tight bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] shadow-none border-0 rounded-lg flex items-center justify-center gap-1.5 transition-all",
          )}
        >
          <UserPlus className="h-3.5 w-3.5" />
          {t("invite.register_to_claim")}
        </Link>
      </CardContent>
      <CardFooter className="pb-8 pt-2">
        <p className="text-[10px] text-muted-foreground text-center w-full leading-relaxed">
          {t("invite.footer_note")}
        </p>
      </CardFooter>
    </Shell>
  );
}
