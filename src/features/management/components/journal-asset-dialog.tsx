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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useDebounce } from "@/hooks/use-debounce";
import { useJournalAssets } from "@/features/management/hooks/use-journal-assets";
import { cn } from "@/lib/utils";
import type { YahooSearchQuote } from "@/services/api/yahoo-finance";
import { useYahooSearch } from "@/services/queries/use-market-data";
import { ActionButtonContent } from "@/components/shared/action-button-content";
import { toast } from "sonner";

interface JournalAssetDialogProps {
  trigger: ReactElement;
}

export function JournalAssetDialog({ trigger }: JournalAssetDialogProps) {
  const { t } = useTranslation();
  const { assets, addAsset } = useJournalAssets();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [hideSuggestions, setHideSuggestions] = useState(false);
  const [pendingSymbols, setPendingSymbols] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(inputValue, 300);
  const {
    data: suggestions,
    isLoading: isSearching,
    isError: searchError,
    isFetching: searchFetching,
    refetch: refetchSearch,
  } = useYahooSearch(debouncedSearch);
  const trackedSet = useMemo(
    () => new Set(assets.map((asset) => asset.symbol.toUpperCase())),
    [assets],
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
      const symbols = pendingSymbols;
      const results = await Promise.all(
        symbols.map((symbol) => addAsset(symbol)),
      );
      const added = results.filter((result) => result === "added").length;
      const duplicate = results.filter(
        (result) => result === "duplicate",
      ).length;
      const invalid = results.filter((result) => result === "invalid").length;

      if (added > 0) {
        toast.success(t("toasts.journal_asset.add_success"));
      }
      if (duplicate > 0) {
        toast.info(t("toasts.journal_asset.duplicate_info"));
      }
      if (invalid > 0) {
        toast.error(t("toasts.journal_asset.invalid_error"));
      }

      const failed = symbols.filter((_, index) => results[index] === "invalid");
      if (failed.length > 0) {
        setPendingSymbols(failed);
      } else {
        resetDraft();
        setOpen(false);
      }
    } catch {
      toast.error(t("toasts.journal_asset.save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const canSuggest =
    inputValue.trim().length >= 2 &&
    !hideSuggestions &&
    !isSearching &&
    (searchError || suggestions !== undefined);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="border border-border text-foreground sm:max-w-md"
        showCloseButton={!isSaving}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {t("admin.add_asset_dialog_title")}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t("admin.add_asset_dialog_desc")}
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
                  <span className="sr-only">{t("common.clear_search")}</span>
                </button>
              ) : null}
            </div>

            {canSuggest && (
              <div className="absolute top-full right-0 left-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-popover shadow-2xl animate-in fade-in slide-in-from-top-1 z-50">
                {searchError && (!suggestions || suggestions.length === 0) ? (
                  <Empty role="alert" className="min-h-40 rounded-none border-0 p-4">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <SearchX aria-hidden="true" />
                      </EmptyMedia>
                      <EmptyTitle>{t("common.load_error_title")}</EmptyTitle>
                      <EmptyDescription>
                        {t("common.load_error_description")}
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void refetchSearch()}
                        disabled={searchFetching}
                        aria-busy={searchFetching}
                      >
                        {t("common.retry")}
                      </Button>
                    </EmptyContent>
                  </Empty>
                ) : suggestions && suggestions.length > 0 ? (
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
                            ? t("admin.add_asset_already_exists")
                            : pending
                              ? t("admin.add_asset_selected")
                              : suggestion.typeDisp || suggestion.quoteType}
                        </Badge>
                      </button>
                    );
                  })
                ) : (
                  <Empty className="min-h-40 rounded-none border-0 p-4">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <SearchX aria-hidden="true" />
                      </EmptyMedia>
                      <EmptyTitle>{t("admin.add_asset_not_found")}</EmptyTitle>
                      <EmptyDescription>
                        {t("admin.add_asset_not_found_desc")}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>
            )}
          </div>

          {pendingSymbols.length > 0 && (
            <div className="mt-6 flex flex-col gap-2">
              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground">
                {t("admin.add_asset_ready_to_add", {
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
