import { cn } from "@/lib/utils";
import { useMarketData } from "@/services/queries/use-yahoo-data";
import { MARKET_INDICES } from "@/constants/assets";
import { formatPrice } from "@/lib/formatters";
import { useTranslation } from "react-i18next";

export function MarketTicker({ showTitle = false }: { showTitle?: boolean }) {
  const { t } = useTranslation();
  const { data: indices, isError: indicesError } = useMarketData(
    MARKET_INDICES.map((i) => i.symbol),
  );
  const { data: crypto, isError: cryptoError } = useMarketData([
    "BTC-USD",
    "ETH-USD",
    "SOL-USD",
    "BNB-USD",
  ]);
  const { data: usStocks, isError: usError } = useMarketData([
    "AAPL",
    "MSFT",
    "NVDA",
    "TSLA",
  ]);
  const { data: idStocks, isError: idError } = useMarketData([
    "BBCA.JK",
    "BBRI.JK",
    "BMRI.JK",
    "TLKM.JK",
  ]);

  const isError = indicesError && cryptoError && usError && idError;

  // Helper to format any asset into ticker format
  const formatTickerItem = (
    symbol: string,
    name: string,
    price: number,
    change: number,
    type: "index" | "stock" | "crypto",
  ) => {
    let displaySymbol = name || symbol;

    // Standardize symbols for display if name is not helpful
    if (type === "crypto" && displaySymbol.endsWith("-USD")) {
      displaySymbol = displaySymbol.replace("-USD", "");
    }
    if (type === "stock" && displaySymbol.endsWith(".JK")) {
      displaySymbol = displaySymbol.replace(".JK", "");
    }

    // Standardize price formatting
    const displayPrice = formatPrice(
      price,
      symbol.endsWith(".JK") ? "id-stock" : undefined,
    );

    return {
      symbol: displaySymbol,
      price: displayPrice,
      change,
    };
  };

  // Combine and format real data
  const tickerData = [
    ...(indices?.map((i) => {
      const meta = MARKET_INDICES.find((m) => m.symbol === i.symbol);
      return formatTickerItem(
        i.symbol,
        meta?.name || i.name,
        i.price,
        i.changePercent,
        "index",
      );
    }) ?? []),
    ...(usStocks?.map((s) =>
      formatTickerItem(s.symbol, s.name, s.price, s.changePercent, "stock"),
    ) ?? []),
    ...(idStocks?.map((s) =>
      formatTickerItem(s.symbol, s.name, s.price, s.changePercent, "stock"),
    ) ?? []),
    ...(crypto?.map((c) =>
      formatTickerItem(c.symbol, c.name, c.price, c.changePercent, "crypto"),
    ) ?? []),
  ];

  // If error, hide everything
  if (isError) return null;

  const content = (
    <div className="relative overflow-hidden border-border">
      {tickerData.length === 0 ? (
        <div className="h-10 flex items-center px-4 w-full">
          <div className="flex gap-8 animate-pulse w-full">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-3 bg-muted rounded-xl shrink-0",
                  i % 3 === 0 ? "w-24" : i % 3 === 1 ? "w-16" : "w-20",
                )}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="animate-ticker flex whitespace-nowrap py-2">
          {[...tickerData, ...tickerData, ...tickerData].map((item, i, arr) => (
            <div
              key={`${item.symbol}-${i}`}
              className="inline-flex items-center gap-2 px-4 text-xs"
            >
              <span className="font-medium text-foreground">{item.symbol}</span>
              <span className="text-mono-data text-muted-foreground">
                {item.price}
              </span>
              <span
                className={cn(
                  "text-mono-data font-medium",
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
              {i < arr.length - 1 && (
                <span className="ml-5 text-foreground">•</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!showTitle) return content;

  return (
    <div className="w-full">
      <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] mb-4 flex items-center gap-4 justify-center">
        <div className="h-px w-8 bg-border" />
        <span>{t("market.ticker_title")}</span>
        <div className="h-px w-8 bg-border" />
      </div>
      <div className="rounded-xl border border-border overflow-hidden bg-card/30 backdrop-blur-sm text-xs text-muted-foreground">
        {content}
      </div>
    </div>
  );
}
