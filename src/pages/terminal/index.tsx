import { useTranslation } from "react-i18next";
import { MarketSummaryRow } from "@/features/market/components/market-summary-row";
import { AssetTable } from "@/features/screener/components/asset-table";
import { DisclaimerDialog } from "@/features/screener/components/disclaimer-dialog";

export default function TerminalPage() {
  const { t } = useTranslation();

  return (
    <div className="w-full py-10">
      <div className="max-w-7xl mx-auto px-6 space-y-8">
        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {t("terminal.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("terminal.subtitle")}
            </p>
          </div>
        </div>

        {/* Market Summary */}
        <div>
          <MarketSummaryRow />
        </div>

        <div className="space-y-6">
          {/* Asset Table includes Header and FilterBar internally */}
          <div>
            <AssetTable />
          </div>
        </div>

        {/* Disclaimer Dialog */}
        <DisclaimerDialog />
      </div>
    </div>
  );
}
