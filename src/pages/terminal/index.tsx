import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { LockKeyhole } from "lucide-react";
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
import { useAppSelector, useUIActions } from "@/store/hooks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildTerminalDialogCloseHref } from "@/features/terminal/lib/dialog-url";
import { useTerminalDialogUrl } from "@/features/terminal/hooks/use-terminal-dialog-url";

type TerminalView = "market" | "journal";

function JournalAccessState({
  resolving,
  onUnlock,
}: {
  resolving: boolean;
  onUnlock: () => void;
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
        <Button type="button" size="lg" onClick={onUnlock} className="min-h-11">
          {t("terminal.access_dialog_unlock_btn")}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function TerminalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const autoGateKeyRef = useRef<string | null>(null);
  const { hasAccess, isResolving: accessResolving } = usePremiumAccess();
  const { ready: authReady } = useAuth();
  const {
    needsAgreement,
    isResolving: disclaimerResolving,
  } = useDisclaimer();
  const isLicenseDialogOpen = useAppSelector(
    (state) => state.ui.isLicenseDialogOpen,
  );
  const { openLicenseDialog } = useUIActions();
  const isMobile = useIsMobile();
  const dialogUrl = useTerminalDialogUrl({ fallbackFocusRef: headingRef });

  const activeView: TerminalView =
    location.pathname === "/terminal/journal" ? "journal" : "market";
  const journalAccessReady = authReady && !accessResolving && hasAccess;
  const journalGateResolving = !authReady || accessResolving;
  const detailLayerReady =
    !disclaimerResolving && !needsAgreement && !isLicenseDialogOpen;

  const setView = (view: TerminalView) => {
    const pathname =
      view === "journal" ? "/terminal/journal" : "/terminal/market";
    navigate(
      buildTerminalDialogCloseHref(pathname, location.search) + location.hash,
      { preventScrollReset: true },
    );
  };

  // A Journal URL remains untouched while the gates run. The license modal is
  // opened only after disclaimer + auth/profile resolution, and only once per
  // semantic location so dismissing it does not create an inescapable loop.
  useEffect(() => {
    const shouldGate =
      activeView === "journal" &&
      !disclaimerResolving &&
      !needsAgreement &&
      authReady &&
      !accessResolving &&
      !hasAccess;

    if (!shouldGate) {
      if (hasAccess || activeView !== "journal") autoGateKeyRef.current = null;
      return;
    }

    const gateKey = `${location.pathname}${location.search}`;
    if (autoGateKeyRef.current === gateKey) return;
    autoGateKeyRef.current = gateKey;
    openLicenseDialog();
  }, [
    accessResolving,
    activeView,
    authReady,
    disclaimerResolving,
    hasAccess,
    location.pathname,
    location.search,
    needsAgreement,
    openLicenseDialog,
  ]);

  const marketRequest =
    dialogUrl.request?.kind === "market" ? dialogUrl.request : null;
  const journalRequest =
    dialogUrl.request?.kind === "journal" ? dialogUrl.request : null;

  return (
    <div className="w-full bg-background py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6">
        <div className="flex flex-row items-start justify-between gap-4">
          <div className="min-w-0">
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="text-3xl font-bold uppercase tracking-tight text-foreground outline-none"
            >
              {t("terminal.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("terminal.subtitle")}
            </p>
          </div>

          {isMobile ? (
            <Select
              value={activeView}
              onValueChange={(value) => setView(value as TerminalView)}
            >
              <SelectTrigger className="h-11 w-fit min-w-[130px] cursor-pointer bg-card text-[10px] uppercase tracking-wider hover:bg-accent">
                <SelectValue className="truncate text-left" />
              </SelectTrigger>
              <SelectContent align="end" position="popper" className="p-1">
                <SelectItem
                  value="market"
                  className="cursor-pointer text-[10px] uppercase tracking-wider"
                >
                  {t("journal.view_market")}
                </SelectItem>
                <SelectItem
                  value="journal"
                  className="cursor-pointer text-[10px] uppercase tracking-wider"
                >
                  {t("journal.view_journal")}
                </SelectItem>
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

        {activeView === "market" ? (
          <MarketTerminalContent
            requestedSymbol={marketRequest?.symbol ?? null}
            requestIsValid={marketRequest?.isValid ?? false}
            detailOpen={!!marketRequest && detailLayerReady}
            onAssetSelect={dialogUrl.openMarket}
            onDetailOpenChange={dialogUrl.onOpenChange}
            onDetailCloseAutoFocus={dialogUrl.onCloseAutoFocus}
          />
        ) : journalAccessReady ? (
          <JournalTerminalContent
            requestedTradeId={journalRequest?.tradeId ?? null}
            detailOpen={!!journalRequest && detailLayerReady}
            onTradeSelect={dialogUrl.openJournal}
            onDetailOpenChange={dialogUrl.onOpenChange}
            onDetailCloseAutoFocus={dialogUrl.onCloseAutoFocus}
          />
        ) : (
          <JournalAccessState
            resolving={journalGateResolving}
            onUnlock={openLicenseDialog}
          />
        )}

        <DisclaimerDialog />
      </div>
    </div>
  );
}
