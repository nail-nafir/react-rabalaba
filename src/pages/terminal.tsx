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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type TerminalView = "market" | "journal";

function JournalAccessState({ resolving }: { resolving: boolean }) {
  const { t } = useTranslation();

  if (resolving) {
    return (
      <Card
        className="border border-border"
        aria-busy="true"
        aria-hidden="true"
      >
        <CardContent className="flex min-h-72 flex-col items-center justify-center gap-5 p-6">
          <Skeleton className="size-14 rounded-xl" />
          <div className="flex w-full max-w-md flex-col items-center gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <Skeleton className="h-11 w-44 rounded-md" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border">
      <CardContent className="p-0">
        <Empty className="min-h-72 border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LockKeyhole aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("license.login_required_title")}</EmptyTitle>
            <EmptyDescription>
              {t("license.login_required_desc")}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <LicenseAccessDialog
              trigger={
                <Button
                  type="button"
                  size="lg"
                  className="font-bold text-xs"
                >
                  <Key data-icon="inline-start" />
                  {t("terminal.access_dialog_unlock_btn")}
                </Button>
              }
            />
          </EmptyContent>
        </Empty>
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

  if (disclaimerResolving && !disclaimerLoadError) {
    return (
      <div className="w-full bg-background py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6">
          <JournalAccessState resolving />
        </div>
      </div>
    );
  }

  if (needsAgreement || disclaimerLoadError) {
    return (
      <div className="w-full min-h-[calc(100vh-8rem)] flex items-center justify-center bg-background px-4 py-8">
        <RiskDisclaimerDialog />
      </div>
    );
  }

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
            aria-label={t("common.terminal")}
            options={terminalViewItems}
            onChange={(view) => setView(view as TerminalView)}
          />
        </div>

        <Separator />

        {activeView === "market" ? (
          <MarketTerminalContent />
        ) : journalAccessReady ? (
          <JournalTerminalContent />
        ) : (
          <JournalAccessState resolving={journalGateResolving} />
        )}
      </div>
    </div>
  );
}
