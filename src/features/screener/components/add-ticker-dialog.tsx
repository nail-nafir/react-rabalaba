import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Search, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { Field, FieldGroup, FieldError } from "@/components/ui/field";
import { useFavoriteStore } from "@/store/favorite-store";
import { useDebounce } from "@/hooks/use-debounce";
import { useYahooSearch } from "@/services/queries/use-yahoo-data";
import { fetchYahooChart } from "@/services/api/yahoo-finance";
import {
  favoriteSchema,
  type FavoriteFormValues,
} from "@/features/screener/schemas/favorite-schema";

interface AddTickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTickerDialog({ open, onOpenChange }: AddTickerDialogProps) {
  const { t } = useTranslation();
  const { addSymbol, error: favoriteError, clearError } = useFavoriteStore();
  const [isAdding, setIsAdding] = useState(false);
  const [hideSuggestions, setHideSuggestions] = useState(false);

  const form = useForm<FavoriteFormValues>({
    resolver: zodResolver(favoriteSchema),
    defaultValues: {
      symbol: "",
    },
  });

  const symbolWatch = useWatch({
    control: form.control,
    name: "symbol",
    defaultValue: "",
  });

  const debouncedNewSymbol = useDebounce(symbolWatch, 300);
  const { data: suggestions, isLoading: isSearching } =
    useYahooSearch(debouncedNewSymbol);

  const handleSymbolSubmit = async (data: FavoriteFormValues) => {
    const symbol = data.symbol.trim().toUpperCase();
    if (!symbol) return;

    setIsAdding(true);

    try {
      // Validate with real Yahoo API first
      const result = await fetchYahooChart(symbol, "1d", "1d");

      if (!result || !result.meta) {
        form.setError("symbol", {
          type: "manual",
          message: t("terminal.ticker_not_found", { symbol }),
        });
        setIsAdding(false);
        return;
      }

      const success = addSymbol(symbol);

      if (success) {
        toast.success(t("terminal.favorite_added", { symbol }));
        form.reset({ symbol: "" });
        onOpenChange(false);
      } else {
        const error = useFavoriteStore.getState().error;
        if (error) {
          form.setError("symbol", {
            type: "manual",
            message: t(`terminal.${error}`),
          });
        }
      }
    } catch {
      form.setError("symbol", {
        type: "manual",
        message: t("terminal.ticker_not_found", { symbol }),
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      form.reset({ symbol: "" });
      form.clearErrors();
      setHideSuggestions(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md border border-border p-6 gap-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {t("terminal.add_ticker_dialog_title")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {t("terminal.add_ticker_dialog_desc")}
          </DialogDescription>
        </DialogHeader>
        <form
          id="add-ticker-form"
          onSubmit={form.handleSubmit(handleSymbolSubmit)}
          className="space-y-5"
        >
          <FieldGroup>
            <Controller
              name="symbol"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <div className="relative group">
                    <Input
                      {...field}
                      type="text"
                      placeholder={t("terminal.add_ticker_placeholder")}
                      className={cn(
                        "h-10 text-sm bg-background border-input focus:ring-primary/20 focus:border-primary transition-all shadow-sm uppercase pr-10",
                        fieldState.invalid &&
                          "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500",
                      )}
                      autoFocus
                      autoComplete="off"
                      onChange={(e) => {
                        field.onChange(e);
                        setHideSuggestions(false);
                        if (favoriteError) clearError();
                      }}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isSearching ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Search className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Suggestions dropdown */}
                    {symbolWatch.trim().length >= 2 &&
                      !hideSuggestions &&
                      !isSearching && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1">
                          {suggestions && suggestions.length > 0 ? (
                            suggestions.map((s) => (
                              <button
                                key={s.symbol}
                                type="button"
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors border-b border-border/50 last:border-0 group cursor-pointer"
                                onClick={() => {
                                  form.setValue("symbol", s.symbol);
                                  setHideSuggestions(true);
                                }}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-bold truncate">
                                    {s.symbol}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {s.shortname || s.longname}
                                  </div>
                                </div>
                                <div className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                  {s.typeDisp || s.quoteType}
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50">
                                <SearchX className="h-5 w-5 text-muted-foreground/60" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground">
                                  {t("terminal.ticker_not_found_suggestion")}
                                </p>
                                <p className="text-[10px] text-muted-foreground leading-relaxed max-w-45 mx-auto">
                                  {t("terminal.add_ticker_dialog_desc")}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                  {fieldState.invalid && (
                    <FieldError
                      errors={[fieldState.error]}
                      className="text-[10px]"
                    />
                  )}
                </Field>
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            className="h-9 text-xs cursor-pointer"
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="add-ticker-form"
            size="sm"
            disabled={isAdding || !symbolWatch.trim()}
            className="h-9 px-4 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md shadow-primary/10 cursor-pointer shrink-0"
          >
            {isAdding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              t("terminal.add_ticker_btn")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
