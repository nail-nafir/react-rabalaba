import { cn } from "@/lib/utils";
import { useMarketData } from "@/services/queries/use-market-data";
import { MARKET_INDICES } from "@/constants/assets";
import { formatPrice } from "@/lib/formatters";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "../ui/card";

export function MarketTicker({ showTitle = false }: { showTitle?: boolean }) {
  const { t } = useTranslation();
  const { data: indices, isError: indicesError } = useMarketData(
    MARKET_INDICES.map((i) => i.symbol),
  );
  const tickerData = (indices ?? []).map((item) => {
    const meta = MARKET_INDICES.find((index) => index.symbol === item.symbol);
    return {
      symbol: meta?.name || item.name || item.symbol,
      price: formatPrice(item.price),
      change: item.changePercent,
    };
  });

  // If error, hide everything
  if (indicesError) return null;

  const content = (
    <Card className="p-0 overflow-hidden bg-transparent border border-border">
      <CardContent>
        {tickerData.length === 0 ? (
          <div className="h-10 flex items-center px-4 w-full">
            <div className="flex gap-8 animate-pulse w-full">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-3 rounded-xl shrink-0",
                    i % 3 === 0 ? "w-24" : i % 3 === 1 ? "w-16" : "w-20",
                  )}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="animate-ticker flex w-max whitespace-nowrap py-2">
            {Array.from({ length: 2 }, (_, copyIndex) => (
              <div
                key={`ticker-copy-${copyIndex}`}
                className="flex shrink-0"
                aria-hidden={copyIndex > 0 ? true : undefined}
              >
                {tickerData.map((item) => (
                  <div
                    key={`${item.symbol}-${copyIndex}`}
                    className="inline-flex items-center gap-2 px-4 text-xs uppercase"
                  >
                    <span className="font-medium text-foreground">
                      {item.symbol}
                    </span>
                    <span className="text-muted-foreground">{item.price}</span>
                    <span
                      className={cn(
                        "font-medium",
                        item.change > 0
                          ? "text-emerald-400"
                          : item.change < 0
                            ? "text-rose-400"
                            : "text-zinc-400",
                      )}
                    >
                      {item.change > 0 ? "+" : ""}
                      {item.change.toFixed(2)}%
                    </span>
                    <span className="ml-5 text-foreground">•</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (!showTitle) return content;

  return (
    <div className="w-full">
      <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] mb-4 flex items-center gap-4 justify-center">
        <div className="h-px w-8 bg-muted-foreground" />
        <span>{t("market.ticker_title")}</span>
        <div className="h-px w-8 bg-muted-foreground" />
      </div>
      <div className="rounded-xl border border-border overflow-hidden bg-card/30 backdrop-blur-sm text-xs text-muted-foreground">
        {content}
      </div>
    </div>
  );
}
