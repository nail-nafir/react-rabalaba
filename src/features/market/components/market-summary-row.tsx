import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  SkeletonCryptoCard,
  SkeletonIndexCard,
} from "@/components/shared/skeleton-card";
import { EmptyState } from "@/components/shared/empty-state";
import { useFearGreedIndex } from "@/services/queries/use-fear-greed";
import { useMarketData } from "@/services/queries/use-yahoo-data";
import { useMarketContext } from "@/services/queries/use-market-context";
import { useMarketMomentum } from "@/services/queries/use-market-momentum";
import { MARKET_INDICES } from "@/constants/assets";
import { Loader2, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FearGreedBar } from "@/components/charts/fear-greed-bar";
import { DominanceChart } from "@/components/charts/dominance-chart";
import { PercentageChange } from "@/components/shared/percentage-change";
import { Sparkline } from "@/components/charts/sparkline";
import { TrendIndicator } from "@/components/shared/trend-indicator";
import type { TrendDirection } from "@/types/market";
import { cn } from "@/lib/utils";

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
  const { data: marketContext, isLoading: contextLoading } = useMarketContext();
  const { momentum } = useMarketMomentum();

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
              title={t("market.data_unavailable")}
              description={t("market.data_unavailable_desc")}
              icon={<AlertCircle className="h-6 w-6 text-muted-foreground" />}
            />
          </div>
        ) : (
          <>
            {/* Market Sentiment: regime + fear & greed */}
            {contextLoading || fearGreedLoading ? (
              <SkeletonCryptoCard className="min-w-52" />
            ) : (
              <Card className="min-w-52 border border-border">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Crypto
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {marketContext && (
                      <TrendIndicator
                        trend={marketContext.btcTrend}
                        meta={(marketContext.btcTrend === "bearish"
                          ? momentum?.bearishPercent
                          : momentum?.bullishPercent
                        )?.toString()}
                        showBar={false}
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {marketContext?.dominance &&
                    (() => {
                      const { btc, eth } = marketContext.dominance;
                      const others = Math.max(0, 100 - btc - eth);
                      const btcTw =
                        btc <= 20
                          ? "bg-rose-500"
                          : btc <= 40
                            ? "bg-orange-400"
                            : btc <= 60
                              ? "bg-amber-400"
                              : btc <= 80
                                ? "bg-lime-400"
                                : "bg-emerald-400";
                      const ethTw =
                        eth <= 20
                          ? "bg-rose-500"
                          : eth <= 40
                            ? "bg-orange-400"
                            : eth <= 60
                              ? "bg-amber-400"
                              : eth <= 80
                                ? "bg-lime-400"
                                : "bg-emerald-400";

                      return (
                        <div className="flex items-center gap-3 w-full py-1">
                          <div className="shrink-0">
                            <DominanceChart
                              btc={btc}
                              eth={eth}
                              others={others}
                            />
                          </div>
                          <div className="flex flex-col items-start gap-1 flex-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                              Dominance
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full shrink-0",
                                  btcTw,
                                )}
                              />
                              <span className="text-xs font-bold text-mono-data tabular-nums leading-none">
                                BTC {btc.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full shrink-0",
                                  ethTw,
                                )}
                              />
                              <span className="text-xs font-bold text-mono-data tabular-nums leading-none">
                                ETH {eth.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                </CardContent>
                <CardFooter className="flex-col items-stretch">
                  {fearGreed && (
                    <FearGreedBar
                      value={fearGreed.value}
                      label={fearGreed.label}
                      change={fearGreed.change}
                    />
                  )}
                </CardFooter>
              </Card>
            )}

            {/* Market index cards */}
            {indicesLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonIndexCard
                    key={`idx-skeleton-${i}`}
                    className="min-w-52"
                  />
                ))
              : indices
                  ?.filter(
                    (idx) =>
                      idx.symbol !== "BTC-USD" && idx.symbol !== "ETH-USD",
                  )
                  .map((idx) => {
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

                    return (
                      <Card
                        key={idx.symbol}
                        className="min-w-52 border border-border"
                      >
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                            {meta?.name || idx.name}
                          </CardTitle>
                          <TrendIndicator trend={trend} />
                        </CardHeader>

                        <CardContent className="flex-1 flex flex-col">
                          <Sparkline
                            className="w-full h-full"
                            values={idx.quoteIndicators?.close}
                            width={170}
                            height={80}
                            strokeWidth={1.5}
                            margin={2}
                            animationDuration={1000}
                            animationBegin={200}
                          />
                        </CardContent>

                        <CardFooter className="flex-col items-start justify-center">
                          <div className="text-2xl font-bold text-mono-data tracking-tight text-foreground">
                            {formattedValue}
                          </div>
                          <PercentageChange
                            value={idx.changePercent}
                            className="text-xs font-semibold"
                          />
                        </CardFooter>
                      </Card>
                    );
                  })}
          </>
        )}
      </div>
    </>
  );
}
