import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Ticket,
  CheckCircle2,
  XCircle,
  LogIn,
  UserPlus,
  ArrowRight,
} from "lucide-react";
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
import { useAuth } from "@/hooks/use-auth";
import {
  useInvitation,
  useInvitationPeek,
  type ClaimResult,
} from "@/hooks/use-invitation";

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
  const { data: peek, isLoading } = useInvitationPeek(code);
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
              ? t("invite.claiming", "Mengklaim undangan...")
              : t("invite.loading", "Memuat undangan...")}
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
                ? t("invite.success_premium_title", "Premium Aktif!")
                : t("invite.success_trial_title", "Trial Aktif!")}
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              {t("invite.success_desc", "Selamat! Akses kamu sudah terbuka. Langsung gas ke terminal.")}
            </CardDescription>
          </CardHeader>
          <CardFooter className="pb-8">
            <Button
              onClick={() => navigate("/terminal")}
              className="w-full text-xs font-bold cursor-pointer gap-1.5"
            >
              {t("invite.go_terminal", "Masuk Terminal")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardFooter>
        </Shell>
      );
    }
    // Non-success outcomes (already / already_premium / expired / revoked / exhausted / invalid / error)
    const alreadyHadIt = result === "already" || result === "already_premium";
    return (
      <Shell>
        <CardHeader className="flex flex-col items-center text-center gap-3 pt-8">
          <div
            className={
              alreadyHadIt
                ? "flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500"
                : "flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500"
            }
          >
            {alreadyHadIt ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
          </div>
          <CardTitle className="text-xl font-bold">
            {result === "already_premium"
              ? t("invite.already_premium_title", "Sudah Premium")
              : alreadyHadIt
                ? t("invite.already_title", "Sudah Diklaim")
                : t("invite.invalid_title", "Undangan Tidak Berlaku")}
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            {t(`invite.reason_${result}`, t("invite.invalid_desc", "Undangan ini tidak bisa dipakai lagi."))}
          </CardDescription>
        </CardHeader>
        <CardFooter className="pb-8">
          <Button
            variant="outline"
            onClick={() => navigate("/terminal")}
            className="w-full text-xs font-bold cursor-pointer"
          >
            {t("invite.go_terminal", "Masuk Terminal")}
          </Button>
        </CardFooter>
      </Shell>
    );
  }

  // ── Anonymous: invalid invite ──
  if (!peek || !peek.valid) {
    const reason = peek?.reason ?? "invalid";
    return (
      <Shell>
        <CardHeader className="flex flex-col items-center text-center gap-3 pt-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
            <XCircle className="h-8 w-8" />
          </div>
          <CardTitle className="text-xl font-bold">
            {t("invite.invalid_title", "Undangan Tidak Berlaku")}
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            {t(`invite.reason_${reason}`, t("invite.invalid_desc", "Undangan ini tidak bisa dipakai lagi."))}
          </CardDescription>
        </CardHeader>
        <CardFooter className="pb-8">
          <Link
            to="/terminal"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full text-xs font-bold cursor-pointer",
            )}
          >
            {t("invite.go_terminal", "Masuk Terminal")}
          </Link>
        </CardFooter>
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
          {isTrial ? t("license.tier_trial", "Trial") : t("license.tier_premium", "Premium")}
          {isTrial && peek.trial_days ? ` · ${peek.trial_days} ${t("invite.days", "hari")}` : ""}
        </Badge>
        <CardTitle className="text-xl font-bold">
          {t("invite.offer_title", "Kamu Diundang!")}
        </CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          {isTrial
            ? t("invite.offer_trial_desc", "Klaim undangan ini untuk membuka akses trial premium. Login atau daftar dulu ya.")
            : t("invite.offer_premium_desc", "Klaim undangan ini untuk membuka akses premium. Login atau daftar dulu ya.")}
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
          {t("invite.login_to_claim", "Login untuk Klaim")}
        </Link>
        <Link
          to={`/register${redirectParam}`}
          className={cn(
            buttonVariants(),
            "h-9 w-full cursor-pointer text-xs font-bold tracking-tight bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] shadow-none border-0 rounded-lg flex items-center justify-center gap-1.5 transition-all",
          )}
        >
          <UserPlus className="h-3.5 w-3.5" />
          {t("invite.register_to_claim", "Daftar Akun Baru")}
        </Link>
      </CardContent>
      <CardFooter className="pb-8 pt-2">
        <p className="text-[10px] text-muted-foreground text-center w-full leading-relaxed">
          {t("invite.footer_note", "Undangan otomatis terklaim setelah kamu masuk.")}
        </p>
      </CardFooter>
    </Shell>
  );
}
