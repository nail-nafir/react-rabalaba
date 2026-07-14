import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useJournalAssets } from "@/hooks/use-journal-assets";
import { SymbolSearchDialog } from "@/components/shared/symbol-search-dialog";

interface AddJournalAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddJournalAssetDialog({
  open,
  onOpenChange,
}: AddJournalAssetDialogProps) {
  const { t } = useTranslation();
  const { assets, addAsset } = useJournalAssets();

  const trackedSymbols = useMemo(
    () => assets.map((a) => a.symbol),
    [assets],
  );

  const handleSave = async (symbols: string[]) => {
    const results = await Promise.all(symbols.map((s) => addAsset(s)));

    const added = results.filter((r) => r === "added").length;
    const duplicate = results.filter((r) => r === "duplicate").length;
    const invalid = results.filter((r) => r === "invalid").length;

    if (added > 0)
      toast.success(t("admin.add_asset_toast_success", { count: added }));
    if (duplicate > 0)
      toast.info(t("admin.add_asset_toast_info", { count: duplicate }));
    if (invalid > 0)
      toast.error(t("admin.add_asset_toast_error", { count: invalid }));

    // return only the invalid symbols that should remain in the pending list
    return symbols.filter((_, i) => results[i] === "invalid");
  };

  return (
    <SymbolSearchDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("admin.add_asset_dialog_title")}
      description={t("admin.add_asset_dialog_desc")}
      placeholder={t("market.add_ticker_placeholder")}
      trackedSymbols={trackedSymbols}
      alreadyExistsLabel={t("admin.add_asset_already_exists")}
      selectedLabel={t("admin.add_asset_selected")}
      notFoundLabel={t("admin.add_asset_not_found")}
      notFoundDesc={t("admin.add_asset_not_found_desc")}
      pendingLabel={(count) => t("admin.add_asset_ready_to_add", { count })}
      saveButtonLabel={t("admin.add_asset_btn_add")}
      saveButtonWithCountLabel={(count) =>
        t("admin.add_asset_btn_add_with_count", { count })
      }
      removeSymbolAriaLabel={(symbol) =>
        t("market.add_ticker_chip_remove", { symbol })
      }
      onSave={handleSave}
    />
  );
}

