import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Search, SearchX, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useJournalAssets } from "@/hooks/use-journal-assets";
import { useDebounce } from "@/hooks/use-debounce";
import { useYahooSearch } from "@/services/queries/use-yahoo-data";
import type { YahooSearchQuote } from "@/services/api/yahoo-finance";
import { cn } from "@/lib/utils";

interface AddJournalAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Add to the AUTO-JOURNAL universe — same Yahoo-search + pending-then-save UX
 *  as the screener's AddTickerDialog, adapted to `useJournalAssets`. Each symbol
 *  is validated against Yahoo on save (addAsset derives name + asset_type), so a
 *  typo can't slip in as a silent no-op for the cron. */
export function AddJournalAssetDialog({
  open,
  onOpenChange,
}: AddJournalAssetDialogProps) {
  const { t } = useTranslation();
  const { assets, addAsset } = useJournalAssets();
  const [inputValue, setInputValue] = useState("");
  const [hideSuggestions, setHideSuggestions] = useState(false);
  const [pendingSymbols, setPendingSymbols] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(inputValue, 300);
  const { data: suggestions, isLoading: isSearching } =
    useYahooSearch(debouncedSearch);

  const trackedSet = useMemo(
    () => new Set(assets.map((a) => a.symbol.toUpperCase())),
    [assets],
  );

  const addToPending = (raw: string) => {
    const symbol = raw.trim().toUpperCase();
    if (!symbol) return;
    if (trackedSet.has(symbol)) return; // already in the universe
    setPendingSymbols((prev) =>
      prev.includes(symbol) ? prev : [...prev, symbol],
    );
    setInputValue("");
    setHideSuggestions(true);
    inputRef.current?.focus();
  };

  const handleRemovePending = (symbol: string) =>
    setPendingSymbols((prev) => prev.filter((s) => s !== symbol));

  const handleSaveAll = async () => {
    if (pendingSymbols.length === 0 || isSaving) return;
    setIsSaving(true);
    const results = await Promise.all(pendingSymbols.map((s) => addAsset(s)));
    setIsSaving(false);

    const added = results.filter((r) => r === "added").length;
    const duplicate = results.filter((r) => r === "duplicate").length;
    const invalid = results.filter((r) => r === "invalid").length;

    if (added > 0)
      toast.success(t("admin.add_asset_toast_success", { count: added }));
    if (duplicate > 0)
      toast.info(t("admin.add_asset_toast_info", { count: duplicate }));
    if (invalid > 0)
      toast.error(t("admin.add_asset_toast_error", { count: invalid }));

    // Close once everything resolved; keep open if some symbols were invalid so
    // the admin can fix them without re-typing the rest.
    if (invalid === 0) {
      onOpenChange(false);
    } else {
      setPendingSymbols(
        pendingSymbols.filter(
          (_, i) => results[i] === "invalid", // leave only the failures behind
        ),
      );
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      setInputValue("");
      setPendingSymbols([]);
      setHideSuggestions(false);
    }
  };

  const canSuggest =
    inputValue.trim().length >= 2 && !hideSuggestions && !isSearching;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md border border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {t("admin.add_asset_dialog_title")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {t("admin.add_asset_dialog_desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              value={inputValue}
              placeholder={t("market.add_ticker_placeholder")}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="pr-10 placeholder:text-sm text-sm"
              onChange={(e) => {
                setInputValue(e.target.value);
                setHideSuggestions(false);
              }}
              onKeyDown={(e) => {
                // Allow adding a manually-typed Yahoo symbol (admin needs to be
                // able to add arbitrary symbols, not just search hits).
                if (e.key === "Enter") {
                  e.preventDefault();
                  addToPending(inputValue);
                }
              }}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Search className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            {canSuggest && suggestions && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1">
                {suggestions.length > 0 ? (
                  suggestions.map((s: YahooSearchQuote) => {
                    const sym = s.symbol.toUpperCase();
                    const tracked = trackedSet.has(sym);
                    const pending = pendingSymbols.includes(sym);
                    const disabled = tracked || pending;
                    return (
                      <div
                        key={s.symbol}
                        onClick={
                          disabled ? undefined : () => addToPending(s.symbol)
                        }
                        aria-disabled={disabled}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-border/50 last:border-0",
                          disabled
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-accent transition-colors cursor-pointer",
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold truncate">
                            {s.symbol}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {s.shortname || s.longname}
                          </div>
                        </div>
                        <Badge
                          variant={disabled ? "outline" : "secondary"}
                          className="font-bold tracking-wider uppercase text-[10px] rounded-md shrink-0"
                        >
                          {tracked
                            ? t("admin.add_asset_already_exists")
                            : pending
                              ? t("admin.add_asset_selected")
                              : s.typeDisp || s.quoteType}
                        </Badge>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50">
                      <SearchX className="h-5 w-5 text-muted-foreground/60" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {t("admin.add_asset_not_found")}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed max-w-45 mx-auto">
                        {t("admin.add_asset_not_found_desc")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {pendingSymbols.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground tracking-wider">
                {t("admin.add_asset_ready_to_add", { count: pendingSymbols.length })}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {pendingSymbols.map((symbol) => (
                  <Button
                    key={symbol}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRemovePending(symbol)}
                    aria-label={t("market.add_ticker_chip_remove", { symbol })}
                    className="text-[10px] font-bold uppercase"
                  >
                    {symbol}
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            size="lg"
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            className="text-xs cursor-pointer"
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleSaveAll}
            size="lg"
            disabled={isSaving || pendingSymbols.length === 0}
            className="text-xs font-bold cursor-pointer shrink-0"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : pendingSymbols.length > 0 ? (
              t("admin.add_asset_btn_add_with_count", { count: pendingSymbols.length })
            ) : (
              t("admin.add_asset_btn_add")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
