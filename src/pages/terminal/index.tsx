import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import { MarketSummaryRow } from "@/features/market/components/market-summary-row";
import { AssetSignalTable } from "@/features/market/components/asset-signal-table";
import { DisclaimerDialog } from "@/features/market/components/disclaimer-dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePremiumAccess } from "@/hooks/use-premium-access";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-media-query";
import { useUIActions } from "@/store/hooks";
import { useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FollowHistoryTable } from "@/features/follow-trade/components/follow-history-table";
import { JournalDashboard } from "@/features/journal/components/journal-dashboard";
import { TopPerformers } from "@/features/journal/components/top-performers";

export default function TerminalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { hasAccess } = usePremiumAccess();
  const { isAuthenticated } = useAuth();
  const { openLicenseDialog } = useUIActions();
  const isMobile = useIsMobile();

  const activeView = pathname === "/terminal/journal" ? "journal" : "market";
  const setView = (v: "market" | "journal") =>
    navigate(v === "journal" ? "/terminal/journal" : "/terminal/market");

  const showLock = !isAuthenticated || !hasAccess;

  useEffect(() => {
    if (pathname === "/terminal/journal" && showLock) {
      navigate("/terminal/market", { replace: true });
      openLicenseDialog();
    }
  }, [pathname, showLock, navigate, openLicenseDialog]);

  return (
    <div className="w-full py-10 bg-background">
      <div className="max-w-7xl mx-auto px-6 space-y-8">
        {/* Page header + view switcher */}
        <div className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase">
              {t("terminal.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("terminal.subtitle")}
            </p>
          </div>
          
          {isMobile ? (
            <Select 
              value={activeView} 
              onValueChange={(v) => {
                if (v === "journal" && showLock) {
                  openLicenseDialog();
                } else {
                  setView(v as "market" | "journal");
                }
              }}
            >
              <SelectTrigger
                className="w-fit min-w-[130px] uppercase tracking-wider text-[10px] h-8 bg-card border-input hover:bg-accent cursor-pointer"
              >
                <SelectValue className="truncate text-left" />
              </SelectTrigger>
              <SelectContent align="end" position="popper" className="p-1">
                <SelectItem value="market" className="uppercase tracking-wider text-[10px] cursor-pointer">
                  {t("journal.view_market")}
                </SelectItem>
                <SelectItem value="journal" className="uppercase tracking-wider text-[10px] cursor-pointer">
                  {t("journal.view_journal")}
                </SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-1 rounded-lg border border-input bg-card p-1 shrink-0">
              <Button
                variant={activeView === "market" ? "default" : "ghost"}
                size="xs"
                onClick={() => setView("market")}
                className={cn(
                  "text-[10px] font-bold whitespace-nowrap uppercase tracking-wider cursor-pointer",
                  activeView !== "market" && "text-muted-foreground hover:bg-accent!",
                )}
              >
                {t("journal.view_market")}
              </Button>
              <Button
                variant={activeView === "journal" ? "default" : "ghost"}
                size="xs"
                onClick={() => {
                  if (showLock) {
                    openLicenseDialog();
                  } else {
                    setView("journal");
                  }
                }}
                className={cn(
                  "text-[10px] font-bold whitespace-nowrap uppercase tracking-wider cursor-pointer",
                  activeView !== "journal" && "text-muted-foreground hover:bg-accent!",
                )}
              >
                {t("journal.view_journal")}
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {activeView === "market" ? (
          <div className="space-y-8">
            <section className="space-y-3">
              <MarketSummaryRow />
            </section>

            <Separator />

            <section className="space-y-3">
              <AssetSignalTable />
            </section>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="space-y-3">
              <JournalDashboard />
            </section>

            <Separator />

            <section className="space-y-3">
              <TopPerformers />
            </section>

            <Separator />

            <section className="space-y-3">
              <FollowHistoryTable />
            </section>
          </div>
        )}

        {/* Disclaimer Dialog */}
        <DisclaimerDialog />
      </div>
    </div>
  );
}
