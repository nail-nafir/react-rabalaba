import { useTranslation } from "react-i18next";
import { MarketSummaryRow } from "@/features/market/components/market-summary-row";
import { AssetSignalTable } from "@/features/market/components/asset-signal-table";
import { DisclaimerDialog } from "@/features/market/components/disclaimer-dialog";
import { FilterGroup } from "@/components/shared/filter-group";
import { Separator } from "@/components/ui/separator";
import { usePremiumAccess } from "@/hooks/use-premium-access";
import { useUIStore } from "@/store/ui-store";
import { useFollowJournal } from "@/features/follow-trade/hooks/use-follow-journal";
import { OpenPositions } from "@/features/follow-trade/components/open-positions";
import { FollowHistoryTable } from "@/features/follow-trade/components/follow-history-table";
import { JournalDashboard } from "@/features/journal/components/journal-dashboard";

export default function TerminalPage() {
  const { t } = useTranslation();
  const view = useUIStore((s) => s.terminalView);
  const setView = useUIStore((s) => s.setTerminalView);
  const { hasAccess } = usePremiumAccess();
  // The journal/tracker view is premium-only; non-premium users stay on market.
  const activeView = hasAccess ? view : "market";
  // Keep open positions synced with live prices regardless of the active view.
  useFollowJournal();

  const viewOptions = [
    { value: "market" as const, label: t("journal.view_market") },
    { value: "journal" as const, label: t("journal.view_journal") },
  ];

  return (
    <div className="w-full py-10">
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
          {hasAccess && (
            <FilterGroup
              value={view}
              options={viewOptions}
              onChange={setView}
              className="shrink-0 min-w-24 sm:w-40"
            />
          )}
        </div>

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
              <OpenPositions />
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
