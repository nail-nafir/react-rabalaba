import { Separator } from "@/components/ui/separator";
import { AssetSignalTable } from "@/features/market/components/asset-signal-table";
import { MarketSummaryRow } from "@/features/market/components/market-summary-row";

/**
 * Owns the unfiltered access universe used by both row-driven and direct-link
 * detail requests. Membership never depends on the table's current search,
 * category, signal, pagination, or whether Yahoo happened to return data.
 */
export function MarketTerminalContent() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <MarketSummaryRow />
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <AssetSignalTable />
      </section>
    </div>
  );
}
