import { useMemo, useRef, useState, type ReactElement } from "react";
import { Search, SearchX, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useDebounce } from "@/hooks/use-debounce";
import { useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";
import type { YahooSearchQuote } from "@/services/api/yahoo-finance";
import { useYahooSearch } from "@/services/queries/use-yahoo-data";
import { ActionButtonContent } from "@/components/shared/action-button-content";
import { toast } from "sonner";

interface AddSignalAssetDialogProps {
  trigger: ReactElement;
}

export function AddSignalAssetDialog({ trigger }: AddSignalAssetDialogProps) {
  const { t } = useTranslation();
  const { addSymbols, favoriteSymbols } = useFavorites();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [hideSuggestions, setHideSuggestions] = useState(false);
  const [pendingSymbols, setPendingSymbols] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(inputValue, 300);
  const { data: suggestions, isLoading: isSearching } =
    useYahooSearch(debouncedSearch);
  const trackedSet = useMemo(
    () => new Set(favoriteSymbols.map((symbol) => symbol.toUpperCase())),
    [favoriteSymbols],
  );

  const resetDraft = () => {
    setInputValue("");
    setHideSuggestions(false);
    setPendingSymbols([]);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSaving) return;
    setOpen(nextOpen);
    if (!nextOpen) resetDraft();
  };

  const addToPending = (raw: string) => {
    const symbol = raw.trim().toUpperCase();
    if (!symbol || trackedSet.has(symbol)) return;
    setPendingSymbols((previous) =>
      previous.includes(symbol) ? previous : [...previous, symbol],
    );
    setInputValue("");
    setHideSuggestions(true);
    inputRef.current?.focus();
  };

  const handleSave = async () => {
    if (pendingSymbols.length === 0 || isSaving) return;
    setIsSaving(true);

    try {
      const added = await addSymbols(pendingSymbols);
      if (added.length === 0) {
        toast.error(t("toasts.market.favorites_error"));
        return;
      }
      toast.success(t("toasts.market.favorites_added"));
      resetDraft();
      setOpen(false);
    } catch {
      toast.error(t("toasts.market.favorites_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const canSuggest =
    inputValue.trim().length >= 2 && !hideSuggestions && !isSearching;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="border border-border text-foreground sm:max-w-md"
        showCloseButton={!isSaving}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {t("market.add_ticker_dialog_title")}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t("market.add_ticker_dialog_desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="relative">
            <div className="absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none">
              <Search className="size-4 text-muted-foreground" />
            </div>
            <Input
              ref={inputRef}
              type="text"
              value={inputValue}
              placeholder={t("market.add_ticker_placeholder")}
              autoFocus
              autoComplete="off"
              className="pl-9 pr-9 text-sm placeholder:text-sm"
              onChange={(event) => {
                setInputValue(event.target.value);
                setHideSuggestions(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addToPending(inputValue);
                }
              }}
            />
            <div className="absolute top-1/2 right-3 -translate-y-1/2 flex items-center gap-1">
              {isSearching ? (
                <Spinner className="size-4 text-muted-foreground" />
              ) : inputValue ? (
                <button
                  type="button"
                  onClick={() => {
                    setInputValue("");
                    setHideSuggestions(true);
                    inputRef.current?.focus();
                  }}
                  className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none cursor-pointer"
                >
                  <X className="size-4 text-muted-foreground" />
                  <span className="sr-only">Clear search</span>
                </button>
              ) : null}
            </div>

            {canSuggest && suggestions && (
              <div className="absolute top-full right-0 left-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-popover shadow-2xl animate-in fade-in slide-in-from-top-1 z-50">
                {suggestions.length > 0 ? (
                  suggestions.map((suggestion: YahooSearchQuote) => {
                    const symbol = suggestion.symbol.toUpperCase();
                    const tracked = trackedSet.has(symbol);
                    const pending = pendingSymbols.includes(symbol);
                    const disabled = tracked || pending;

                    return (
                      <button
                        key={suggestion.symbol}
                        type="button"
                        disabled={disabled}
                        onClick={() => addToPending(suggestion.symbol)}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-3 border-b border-border/50 px-4 py-2.5 text-left transition-colors last:border-0",
                          disabled
                            ? "cursor-not-allowed opacity-50"
                            : "hover:bg-accent",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">
                            {suggestion.symbol}
                          </span>
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {suggestion.shortname || suggestion.longname}
                          </span>
                        </span>
                        <Badge
                          variant={disabled ? "outline" : "secondary"}
                          className="shrink-0 rounded-md text-[10px] font-bold tracking-wider uppercase"
                        >
                          {tracked
                            ? t("market.add_ticker_already_favorite_badge")
                            : pending
                              ? t("admin.add_asset_selected")
                              : suggestion.typeDisp || suggestion.quoteType}
                        </Badge>
                      </button>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                    <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-muted/50">
                      <SearchX className="size-5 text-muted-foreground/60" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-semibold text-foreground">
                        {t("market.ticker_not_found_suggestion")}
                      </p>
                      <p className="mx-auto max-w-45 text-[10px] leading-relaxed text-muted-foreground">
                        {t("market.add_ticker_dialog_desc")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {pendingSymbols.length > 0 && (
            <div className="mt-6 flex flex-col gap-2">
              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground">
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
                    onClick={() =>
                      setPendingSymbols((previous) =>
                        previous.filter((item) => item !== symbol),
                      )
                    }
                    aria-label={t("market.add_ticker_chip_remove", { symbol })}
                    className="text-[10px] font-bold uppercase"
                  >
                    {symbol}
                    <X data-icon="inline-end" className="text-destructive" />
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={handleSave}
            size="lg"
            disabled={isSaving || pendingSymbols.length === 0}
            aria-busy={isSaving}
          >
            <ActionButtonContent
              label={t("common.actions.add")}
              pending={isSaving}
            />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
