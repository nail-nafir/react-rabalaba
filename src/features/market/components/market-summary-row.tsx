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
import { useCryptoContext } from "@/services/queries/use-crypto-context";
import { useCryptoDominance } from "@/services/queries/use-crypto-dominance";
import { useMarketMomentum } from "@/services/queries/use-market-momentum";
import { MARKET_INDICES } from "@/constants/assets";
import { Loader2, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FearGreedBar } from "@/components/charts/fear-greed-bar";
import { DominanceChart } from "@/components/charts/dominance-chart";
import { PercentageChange } from "@/components/shared/percentage-change";
import { Sparkline } from "@/components/charts/sparkline";
import { TrendIndicator } from "@/components/shared/trend-indicator";
import type { TrendDirection } from "@/types/market";

export function MarketSummaryRow() {
  const { t } = useTranslation();
  const {
    data: fearGreed,
    isFetching: fgFetching,
    isLoading: fearGreedLoading,
    isError: fearGreedError,
    refetch: refetchFearGreed,
  } = useFearGreedIndex();
  const {
    data: indices,
    isFetching: indicesFetching,
    isLoading: indicesLoading,
    isError: indicesError,
    refetch: refetchIndices,
  } = useMarketData(MARKET_INDICES.map((i) => i.symbol));
  const { data: marketContext, isLoading: contextLoading, refetch: refetchContext } = useCryptoContext();
  const { isLoading: dominanceLoading, refetch: refetchDominance } = useCryptoDominance();
  const { momentum } = useMarketMomentum();

  const showEmptyState =
    (fearGreedError || (!fearGreed && !fearGreedLoading)) &&
    (indicesError || (!indices?.length && !indicesLoading));

  // Crypto card: both sub-signals (dominance + F&G) are settled AND missing →
  // one combined message instead of two separate "unavailable" placeholders.
  const cryptoBothEmpty =
    !marketContext?.dominance && !dominanceLoading && !fearGreed;

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
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    refetchFearGreed();
                    refetchIndices();
                    refetchContext();
                    refetchDominance();
                  }}
                  className="gap-2 cursor-pointer font-semibold"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  {t("common.retry")}
                </Button>
              }
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
                {cryptoBothEmpty ? (
                  <CardContent className="flex flex-1 flex-col items-center justify-center py-6 w-full text-center gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {t("market.crypto_unavailable")}
                    </span>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        refetchDominance();
                        refetchFearGreed();
                        refetchContext();
                      }}
                      className="text-[10px] h-7 gap-1 font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <RotateCw className="h-3 w-3" />
                      {t("common.retry")}
                    </Button>
                  </CardContent>
                ) : (
                  <>
                <CardContent className="flex flex-1 flex-col justify-center gap-4">
                  {marketContext?.dominance ? (
                    (() => {
                      const { btc, eth } = marketContext.dominance;
                      const others = Math.max(0, 100 - btc - eth);
                      const getColor = (val: number) => {
                        if (val <= 20) return "var(--color-rose-400)";
                        if (val <= 40) return "var(--color-orange-400)";
                        if (val <= 60) return "var(--color-amber-400)";
                        if (val <= 80) return "var(--color-lime-400)";
                        return "var(--color-emerald-400)";
                      };
                      const btcColor = getColor(btc);
                      const ethColor = getColor(eth);

                      return (
                        <div className="flex flex-col items-center w-full py-1 gap-1">
                          <div className="relative shrink-0" style={{ width: 50, height: 50 }}>
                            <DominanceChart
                              btc={btc}
                              eth={eth}
                              others={others}
                              width={50}
                              height={50}
                            />
                          </div>
                          <div className="flex justify-center gap-x-4 text-[11px] text-[#71717a] font-normal">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: btcColor }}
                              />
                              <span className="text-zinc-400">BTC</span>
                              <span className="text-zinc-200 font-bold">{btc.toFixed(1)}%</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: ethColor }}
                              />
                              <span className="text-zinc-400">ETH</span>
                              <span className="text-zinc-200 font-bold">{eth.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center py-2 gap-1.5 w-full">
                      {dominanceLoading ? (
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin opacity-50" />
                          <span>{t("market.loading_dominance")}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground">
                            {t("market.dominance_unavailable")}
                          </span>
                          <Button
                            variant="link"
                            size="xs"
                            onClick={() => {
                              refetchDominance();
                              refetchContext();
                            }}
                            className="text-[10px] h-auto p-0 font-semibold text-primary cursor-pointer hover:no-underline"
                          >
                            <RotateCw className="h-2.5 w-2.5 mr-1" />
                            {t("common.retry")}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex-col items-stretch">
                  {fearGreed ? (
                    <FearGreedBar
                      value={fearGreed.value}
                      label={fearGreed.label}
                      change={fearGreed.change}
                    />
                  ) : (
                    <div className="flex flex-col items-start py-2 gap-1.5 w-full">
                      <span className="text-[11px] text-muted-foreground">
                        {t("market.sentiment_unavailable")}
                      </span>
                      <Button
                        variant="link"
                        size="xs"
                        onClick={() => {
                          refetchFearGreed();
                          refetchContext();
                        }}
                        className="text-[10px] h-auto p-0 font-semibold text-primary cursor-pointer hover:no-underline"
                      >
                        <RotateCw className="h-2.5 w-2.5 mr-1" />
                        {t("common.retry")}
                      </Button>
                    </div>
                  )}
                </CardFooter>
                  </>
                )}
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
                          <div className="text-2xl font-bold tracking-tight text-foreground">
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
