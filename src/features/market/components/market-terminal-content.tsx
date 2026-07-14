import { useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { AssetSignalTable } from "@/features/market/components/asset-signal-table";
import { MarketSummaryRow } from "@/features/market/components/market-summary-row";
import { useScreenerUniverse } from "@/hooks/use-screener-universe";
import { useFavorites } from "@/hooks/use-favorites";
import { usePremiumAccess } from "@/hooks/use-premium-access";
import {
  DEFAULT_COMMODITY_TICKERS,
  DEFAULT_FOREX_TICKERS,
} from "@/constants/assets";
import { resolveMarketSymbolAvailability } from "@/features/terminal/lib/dialog-url";
import {
  AssetDetailDialog,
  type MarketDetailAvailability,
} from "@/features/trading-plan/components/asset-detail-dialog";

interface MarketTerminalContentProps {
  requestedSymbol: string | null;
  requestIsValid: boolean;
  detailOpen: boolean;
  onAssetSelect: (symbol: string, trigger: HTMLElement) => void;
  onDetailOpenChange: (open: boolean) => void;
  onDetailCloseAutoFocus?: (open: boolean) => void;
}

/**
 * Owns the unfiltered access universe used by both row-driven and direct-link
 * detail requests. Membership never depends on the table's current search,
 * category, signal, pagination, or whether Yahoo happened to return data.
 */
export function MarketTerminalContent({
  requestedSymbol,
  requestIsValid,
  detailOpen,
  onAssetSelect,
  onDetailOpenChange,
  onDetailCloseAutoFocus,
}: MarketTerminalContentProps) {
  const { isResolving: entitlementResolving } = usePremiumAccess();
  const universe = useScreenerUniverse();
  const { favoriteSymbols, isLoading: favoritesLoading } = useFavorites();

  const supportedSymbols = useMemo(
    () =>
      new Set([
        ...universe.crypto,
        ...universe.usStock,
        ...universe.idStock,
        ...DEFAULT_COMMODITY_TICKERS,
        ...DEFAULT_FOREX_TICKERS,
        ...favoriteSymbols,
      ]),
    [
      favoriteSymbols,
      universe.crypto,
      universe.idStock,
      universe.usStock,
    ],
  );

  const availability: MarketDetailAvailability =
    resolveMarketSymbolAvailability(
      requestIsValid ? requestedSymbol : null,
      supportedSymbols,
      entitlementResolving || universe.isLoading || favoritesLoading,
    );

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <MarketSummaryRow />
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <AssetSignalTable onAssetSelect={onAssetSelect} />
      </section>

      <AssetDetailDialog
        open={detailOpen}
        symbol={requestedSymbol}
        availability={availability}
        onOpenChange={onDetailOpenChange}
        onCloseAutoFocus={onDetailCloseAutoFocus}
      />
    </div>
  );
}
