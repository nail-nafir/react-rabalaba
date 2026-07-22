import { useTranslation } from "react-i18next";
import { LockKeyhole, Key } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { DisclaimerDialog } from "@/features/market/components/disclaimer-dialog";
import { MarketTerminalContent } from "@/features/market/components/market-terminal-content";
import { JournalTerminalContent } from "@/features/journal/components/journal-terminal-content";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { usePremiumAccess } from "@/hooks/use-premium-access";
import { useAuth } from "@/hooks/use-auth";
import { useDisclaimer } from "@/hooks/use-disclaimer";
import { useIsMobile } from "@/hooks/use-media-query";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LicenseDialog } from "@/components/shared/license-dialog";

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
        <LicenseDialog
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
  const isMobile = useIsMobile();

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

          {isMobile ? (
            <Select

              value={activeView}
              onValueChange={(value) => {
                setView(value as TerminalView);
              }}
            >
              <SelectTrigger className="h-11 w-fit min-w-32.5 cursor-pointer bg-card text-[10px] uppercase tracking-wider hover:bg-accent">
                <SelectValue className="truncate text-left" />
              </SelectTrigger>
              <SelectContent
                align="end"

                className="p-1"
              >
                <SelectGroup>
                  {terminalViewItems.map((item) => (
                    <SelectItem
                      key={item.value}
                      value={item.value}
                      className="cursor-pointer text-[10px] uppercase tracking-wider"
                    >
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <div className="flex shrink-0 items-center gap-1 rounded-lg border border-input bg-card p-1">
              <Button
                variant={activeView === "market" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("market")}
                className={cn(
                  "cursor-pointer whitespace-nowrap text-[10px] font-bold uppercase tracking-wider",
                  activeView !== "market" &&
                    "text-muted-foreground hover:bg-accent!",
                )}
              >
                {t("journal.view_market")}
              </Button>
              <Button
                variant={activeView === "journal" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("journal")}
                className={cn(
                  "cursor-pointer whitespace-nowrap text-[10px] font-bold uppercase tracking-wider",
                  activeView !== "journal" &&
                    "text-muted-foreground hover:bg-accent!",
                )}
              >
                {t("journal.view_journal")}
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {disclaimerResolving && !disclaimerLoadError ? (
          <div className="flex flex-col gap-4" aria-busy="true">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : needsAgreement || disclaimerLoadError ? (
          <DisclaimerDialog />
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
