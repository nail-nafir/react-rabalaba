import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useFavorites } from "@/hooks/use-favorites";
import { SymbolSearchDialog } from "@/components/shared/symbol-search-dialog";

interface AddSignalAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddSignalAssetDialog({ open, onOpenChange }: AddSignalAssetDialogProps) {
  const { t } = useTranslation();
  const { addSymbols, favoriteSymbols } = useFavorites();

  const handleSave = async (symbols: string[]) => {
    try {
      const added = await addSymbols(symbols);
      if (added.length > 0) {
        toast.success(
          t("market.favorites_added_bulk", { count: added.length }),
        );
      }
      return []; // All resolved successfully, clear pending symbols
    } catch {
      toast.error(t("market.favorites_save_failed"));
      return symbols; // Keep them in pending symbols list if it failed
    }
  };

  return (
    <SymbolSearchDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("market.add_ticker_dialog_title")}
      description={t("market.add_ticker_dialog_desc")}
      placeholder={t("market.add_ticker_placeholder")}
      trackedSymbols={favoriteSymbols}
      alreadyExistsLabel={t("market.add_ticker_already_favorite_badge")}
      selectedLabel={t("admin.add_asset_selected")}
      notFoundLabel={t("market.ticker_not_found_suggestion")}
      notFoundDesc={t("market.add_ticker_dialog_desc")}
      pendingLabel={(count) => t("market.add_ticker_pending_label", { count })}
      saveButtonLabel={t("market.add_ticker_btn")}
      saveButtonWithCountLabel={(count) =>
        t("market.add_ticker_save_all_with_count", { count })
      }
      removeSymbolAriaLabel={(symbol) =>
        t("market.add_ticker_chip_remove", { symbol })
      }
      onSave={handleSave}
    />
  );
}

