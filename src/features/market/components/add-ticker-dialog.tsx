import { useRef, useState } from "react";
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
import { useFavorites } from "@/hooks/use-favorites";
import { useDebounce } from "@/hooks/use-debounce";
import { useYahooSearch } from "@/services/queries/use-yahoo-data";
import type { YahooSearchQuote } from "@/services/api/yahoo-finance";

interface AddTickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTickerDialog({ open, onOpenChange }: AddTickerDialogProps) {
  const { t } = useTranslation();
  const { addSymbols, favoriteSymbols } = useFavorites();
  const [inputValue, setInputValue] = useState("");
  const [hideSuggestions, setHideSuggestions] = useState(false);
  const [pendingSymbols, setPendingSymbols] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(inputValue, 300);
  const { data: suggestions, isLoading: isSearching } =
    useYahooSearch(debouncedSearch);

  const handleAddFromSuggestion = (s: YahooSearchQuote) => {
    const symbol = s.symbol.trim().toUpperCase();
    if (!symbol) return;
    if (favoriteSymbols.includes(symbol)) return;
    setPendingSymbols((prev) =>
      prev.includes(symbol) ? prev : [...prev, symbol],
    );
    setInputValue("");
    setHideSuggestions(true);
    inputRef.current?.focus();
  };

  const handleRemovePending = (symbol: string) => {
    setPendingSymbols((prev) => prev.filter((s) => s !== symbol));
  };

  const handleSaveAll = async () => {
    if (pendingSymbols.length === 0) return;
    setIsSaving(true);

    try {
      const added = await addSymbols(pendingSymbols);
      if (added.length > 0) {
        toast.success(
          t("market.favorites_added_bulk", { count: added.length }),
        );
        onOpenChange(false);
      }
    } catch {
      toast.error(t("market.favorites_save_failed"));
    } finally {
      setIsSaving(false);
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md border border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {t("market.add_ticker_dialog_title")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {t("market.add_ticker_dialog_desc")}
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
              className="pr-10 placeholder:text-sm text-sm"
              onChange={(e) => {
                setInputValue(e.target.value);
                setHideSuggestions(false);
              }}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Search className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            {inputValue.trim().length >= 2 &&
              !hideSuggestions &&
              !isSearching &&
              suggestions && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1">
                  {suggestions.length > 0 ? (
                    suggestions.map((s) => {
                      const symbol = s.symbol.toUpperCase();
                      const isFavorited = favoriteSymbols.includes(symbol);
                      return (
                        <div
                          key={s.symbol}
                          onClick={
                            isFavorited
                              ? undefined
                              : () => handleAddFromSuggestion(s)
                          }
                          aria-disabled={isFavorited}
                          className={
                            isFavorited
                              ? "w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-border/50 last:border-0 opacity-50 cursor-not-allowed"
                              : "w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors border-b border-border/50 last:border-0 group cursor-pointer"
                          }
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
                            className="font-bold tracking-wider uppercase text-[10px] rounded-md"
                            variant={isFavorited ? "outline" : "secondary"}
                          >
                            {isFavorited
                              ? t("market.add_ticker_already_favorite_badge")
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
                          {t("market.ticker_not_found_suggestion")}
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed max-w-45 mx-auto">
                          {t("market.add_ticker_dialog_desc")}
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
                {t("market.add_ticker_pending_label", {
                  count: pendingSymbols.length,
                })}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {pendingSymbols.map((symbol) => (
                  <Button
                    key={symbol}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRemovePending(symbol)}
                    aria-label={t("market.add_ticker_chip_remove", {
                      symbol,
                    })}
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
            ) : (
              t("market.add_ticker_save_all_with_count", {
                count: pendingSymbols.length,
              })
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
