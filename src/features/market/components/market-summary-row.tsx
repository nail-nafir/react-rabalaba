import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketSummaryCard } from "./market-summary-card";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { EmptyState } from "@/components/shared/empty-state";
import { useFearGreedIndex } from "@/services/queries/use-fear-greed";
import { useMarketData } from "@/services/queries/use-yahoo-data";
import { MARKET_INDICES } from "@/constants/assets";
import { Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { FearGreedBar } from "@/components/charts/fear-greed-bar";
import type { TrendDirection } from "@/types/market";

export function MarketSummaryRow() {
  const { t } = useTranslation();
  const {
    data: fearGreed,
    isFetching: fgFetching,
    isLoading: fearGreedLoading,
    isError: fearGreedError,
  } = useFearGreedIndex();
  const {
    data: indices,
    isFetching: indicesFetching,
    isLoading: indicesLoading,
    isError: indicesError,
  } = useMarketData(MARKET_INDICES.map((i) => i.symbol));

  const showEmptyState =
    (fearGreedError || (!fearGreed && !fearGreedLoading)) &&
    (indicesError || (!indices?.length && !indicesLoading));

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            {t("market.pulse")}
          </h2>
          {(fgFetching || indicesFetching) && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary opacity-50" />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
          </span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {t("market.live_connection")}
          </span>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto scrollbar-none min-h-50">
        {showEmptyState ? (
          <div className="w-full flex items-center justify-center border rounded-xl py-8 border-dashed">
            <EmptyState
              title="Market data unavailable"
              description="Unable to reach API. Please check your connection or try again later."
              icon={<AlertCircle className="h-6 w-6 text-muted-foreground" />}
            />
          </div>
        ) : (
          <>
            {/* Fear & Greed Card */}
            {fearGreedLoading ? (
              <SkeletonCard className="min-w-50" />
            ) : fearGreed ? (
              <Card className="flex flex-col items-start min-w-50 shadow-sm bg-muted border border-border transition-all duration-200">
                <CardHeader className="w-full text-left">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Fear & Greed
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-start w-full">
                  <FearGreedBar
                    value={fearGreed.value}
                    label={fearGreed.label}
                  />
                  <div
                    className={cn(
                      "text-[10px] mt-6 font-bold text-mono-data uppercase tracking-tight",
                      fearGreed.change > 0
                        ? "text-emerald-400"
                        : fearGreed.change < 0
                          ? "text-rose-400"
                          : "text-muted-foreground",
                    )}
                  >
                    {fearGreed.change > 0 ? "+" : ""}
                    {fearGreed.change} Delta
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Market index cards */}
            {indicesLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard
                    key={`idx-skeleton-${i}`}
                    className="min-w-50"
                  />
                ))
              : indices?.map((idx) => {
                  const meta = MARKET_INDICES.find(
                    (m) => m.symbol === idx.symbol,
                  );
                  const trend: TrendDirection =
                    idx.changePercent > 0.5
                      ? "bullish"
                      : idx.changePercent < -0.5
                        ? "bearish"
                        : "sideways";
                  const formattedValue =
                    typeof idx.price === "number"
                      ? idx.price >= 1000
                        ? idx.price.toLocaleString("en-US", {
                            maximumFractionDigits: 2,
                          })
                        : idx.price.toFixed(2)
                      : String(idx.price);

                  const sparklineData = idx.quoteIndicators?.close
                    ?.filter((p): p is number => p !== null)
                    .slice(-20);

                  return (
                    <MarketSummaryCard
                      key={idx.symbol}
                      name={meta?.name || idx.name}
                      value={formattedValue}
                      change={idx.changePercent}
                      trend={trend}
                      sparkline={sparklineData}
                    />
                  );
                })}
          </>
        )}
      </div>
    </>
  );
}
