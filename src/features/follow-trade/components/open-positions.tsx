import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useFollowStore } from "@/store/follow-store";
import { useMarketData } from "@/services/queries/use-yahoo-data";
import { computePnl } from "@/features/follow-trade/lib/follow-trade-model";
import { formatPrice, formatRatio } from "@/lib/formatters";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { SIGNAL_COLORS, TIER_COLORS } from "@/constants/signals";
import { cn } from "@/lib/utils";

export function OpenPositions() {
  const { t } = useTranslation();
  const openTrades = useFollowStore((s) => s.openTrades);
  const closeManual = useFollowStore((s) => s.closeManual);

  const symbols = useMemo(
    () => [...new Set(openTrades.map((tr) => tr.symbol))],
    [openTrades],
  );
  const { data, refetch, isFetching } = useMarketData(symbols);
  const priceBySymbol = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of data) m[a.symbol] = a.price;
    return m;
  }, [data]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          {t("journal.open_positions")}
        </h2>
        <Button
          variant="link"
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-foreground hover:text-primary px-0 hover:no-underline"
        >
          <RefreshCw className={isFetching ? "animate-spin" : undefined} />
          {t("journal.refresh")}
        </Button>
      </div>

      {openTrades.length === 0 ? (
        <Card className="border border-border">
          <CardContent>
            <EmptyState
              title={t("journal.no_open_title")}
              description={t("journal.no_open")}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {openTrades.map((tr) => {
            const price = priceBySymbol[tr.symbol] ?? tr.entryPrice;
            const { pct, r } = computePnl(tr, price);
            const pos = r >= 0;
            const sign = (v: number) => (v >= 0 ? "+" : "");
            return (
              <Card
                key={tr.id}
                className="gap-0 p-0 overflow-hidden border border-border"
              >
                {/* Header: identity + live P/L */}
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold tracking-tight">
                        {tr.symbol}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-bold tracking-wider uppercase text-[10px] rounded-md",
                          SIGNAL_COLORS[tr.signal].bg,
                          SIGNAL_COLORS[tr.signal].text,
                          SIGNAL_COLORS[tr.signal].border,
                        )}
                      >
                        {t(`journal.${tr.signal}`)}
                      </Badge>
                      {tr.grade && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold rounded-md",
                            TIER_COLORS[tr.grade].border,
                            TIER_COLORS[tr.grade].bg,
                            TIER_COLORS[tr.grade].text,
                          )}
                        >
                          {tr.grade}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {tr.name} · {t(`common.asset_types.${tr.assetType}`)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right leading-tight">
                    <div
                      className={`text-lg font-bold text-mono-data ${
                        pos ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {sign(pct)}
                      {pct.toFixed(2)}%
                    </div>
                    <div
                      className={`text-xs font-semibold text-mono-data ${
                        pos ? "text-emerald-400/80" : "text-rose-400/80"
                      }`}
                    >
                      {sign(r)}
                      {formatRatio(r)}R
                    </div>
                  </div>
                </div>

                {/* Footer: price stats + close */}
                <CardFooter className="justify-between gap-3">
                  <div className="flex items-center gap-6">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {t("journal.entry_price")}
                      </div>
                      <div className="text-sm text-mono-data">
                        {formatPrice(tr.entryPrice, tr.assetType)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {t("journal.current_price")}
                      </div>
                      <div className="text-sm text-mono-data">
                        {formatPrice(price, tr.assetType)}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => closeManual(tr.id, price)}
                    className="shrink-0 border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                  >
                    <X />
                    {t("journal.close_position")}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
