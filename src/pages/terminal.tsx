import { useTranslation } from "react-i18next";
import { LockKeyhole, Key } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { RiskDisclaimerDialog } from "@/features/market/components/risk-disclaimer-dialog";
import { MarketTerminalContent } from "@/features/market/components/market-terminal-content";
import { JournalTerminalContent } from "@/features/journal/components/journal-terminal-content";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePremiumAccess } from "@/features/auth/hooks/use-premium-access";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useDisclaimer } from "@/features/auth/hooks/use-disclaimer";
import { FilterGroup } from "@/components/shared/filter-group";
import { LicenseAccessDialog } from "@/components/shared/license-access-dialog";

type TerminalView = "market" | "journal";

function JournalAccessState({
  resolving,
}: {
  resolving: boolean;
}) {
  const { t } = useTranslation();

  if (resolving) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <Card className="border border-border">
      <CardContent className="flex min-h-72 flex-col items-center justify-center gap-5 p-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary">
          <LockKeyhole className="size-6" aria-hidden="true" />
        </div>
        <div className="flex max-w-md flex-col gap-2">
          <h2 className="text-lg font-bold text-foreground">
            {t("license.login_required_title")}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("license.login_required_desc")}
          </p>
        </div>
        <LicenseAccessDialog
          trigger={
            <Button
              type="button"
              size="lg"
              className="font-bold transition-all text-xs cursor-pointer items-center gap-1.5 tracking-tight"
            >
              <Key className="h-3.5 w-3.5" />
              <span>{t("terminal.access_dialog_unlock_btn")}</span>
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}

export default function TerminalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasAccess, isResolving: accessResolving } = usePremiumAccess();
  const { ready: authReady } = useAuth();
  const {
    needsAgreement,
    hasLoadError: disclaimerLoadError,
    isResolving: disclaimerResolving,
  } = useDisclaimer();

  const activeView: TerminalView =
    location.pathname === "/terminal/journal" ? "journal" : "market";
  const journalAccessReady = authReady && !accessResolving && hasAccess;
  const journalGateResolving = !authReady || accessResolving;
  const terminalViewItems: Array<{ label: string; value: TerminalView }> = [
    { value: "market", label: t("journal.view_market") },
    { value: "journal", label: t("journal.view_journal") },
  ];

  const setView = (view: TerminalView) => {
    const pathname =
      view === "journal" ? "/terminal/journal" : "/terminal/market";
    navigate(pathname, { preventScrollReset: true });
  };

  return (
    <div className="w-full bg-background py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6">
        <div className="flex flex-row items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">
              {t("terminal.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("terminal.subtitle")}
            </p>
          </div>

          <FilterGroup
            value={activeView}
            options={terminalViewItems}
            onChange={(view) => setView(view as TerminalView)}
          />
        </div>

        <Separator />

        {disclaimerResolving && !disclaimerLoadError ? (
          <div className="flex flex-col gap-4" aria-busy="true">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : needsAgreement || disclaimerLoadError ? (
          <RiskDisclaimerDialog />
        ) : activeView === "market" ? (
          <MarketTerminalContent />
        ) : journalAccessReady ? (
          <JournalTerminalContent />
        ) : (
          <JournalAccessState
            resolving={journalGateResolving}
          />
        )}
      </div>
    </div>
  );
}
