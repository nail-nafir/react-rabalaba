import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFearGreedIndex } from "@/services/queries/use-fear-greed";
import { useMarketData } from "@/services/queries/use-yahoo-data";
import { useCryptoContext } from "@/services/queries/use-crypto-context";
import { useIdxContext } from "@/services/queries/use-idx-context";
import { useUsContext } from "@/services/queries/use-us-context";
import { useMarketContexts } from "@/services/queries/use-market-context";
import { cn } from "@/lib/utils";
import {
  Loader2,
  RotateCw,
  Coins,
  Building2,
  Globe,
  Gem,
  DollarSign,
  AlertTriangle,
  Info,
} from "lucide-react";
import { memo, useMemo } from "react";
import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Sparkline } from "@/components/charts/sparkline";
import { PercentageChange } from "@/components/shared/percentage-change";
import { EmptyState } from "@/components/shared/empty-state";
import { TrendIndicator } from "@/components/shared/trend-indicator";
import {
  mapCryptoCard,
  mapIdEquityCard,
  mapUsEquityCard,
  mapCommoditiesCard,
  mapForexCard,
} from "../lib/market-pulse-mapper";
import type { MarketContext, MarketContextDirection } from "@/types/market";

const MARKET_PULSE_SYMBOLS = [
  "BTC-USD",
  "ETH-USD",
  "^JKSE",
  "USDIDR=X",
  "^GSPC",
  "^VIX",
  "DX-Y.NYB",
  "GC=F",
];

import { PALETTE } from "@/constants/taxonomy/palette";

const directionConfig = {
  up: PALETTE.positive.textStrong,
  down: PALETTE.negative.textStrong,
  flat: PALETTE.neutral.textStrong,
} as const;

function formatValue(value: number, precision: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

function ContextChange({
  changePercent,
  direction,
}: {
  changePercent: number;
  direction: MarketContextDirection;
}) {
  const colorClass = directionConfig[direction];

  return (
    <span className="inline-flex items-baseline gap-1">
      <span aria-hidden="true" className={cn("opacity-40", colorClass)}>
        •
      </span>
      <PercentageChange
        value={changePercent}
        className="text-xs font-semibold"
      />
    </span>
  );
}

function QuoteChange({
  context,
}: {
  context: Extract<MarketContext, { kind: "quote" }>;
}) {
  return (
    <ContextChange
      changePercent={context.changePercent}
      direction={context.direction}
    />
  );
}

// All recharts inputs are hoisted/memoized — identity churn on data/domain/
// margin restarts mount animations whose effect cleanup calls setState, which
// can cascade into "Maximum update depth exceeded" (see sparkline.tsx).
// Dimensions mirror WinRateRing (size 112 / outer 52 / inner 42 / barSize 10)
// scaled down to the 40px footer slot.
const DONUT_SIZE = 40;
const DONUT_OUTER = 18.5;
const DONUT_INNER = 15;
const DONUT_DOMAIN: [number, number] = [0, 100];
const DONUT_MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };
/** Full-circle track behind the arc — same style as WinRateRing. */
const DONUT_TRACK = { fill: "var(--color-zinc-400)", fillOpacity: 0.15 };

const DONUT_COLOR_ROSE = "var(--color-rose-400)";
const DONUT_COLOR_AMBER = "var(--color-amber-400)";
const DONUT_COLOR_EMERALD = "var(--color-emerald-400)";

const DONUT_TEXT_ROSE = "text-rose-400";
const DONUT_TEXT_AMBER = "text-amber-400";
const DONUT_TEXT_EMERALD = "text-emerald-400";

const DonutGauge = memo(function DonutGauge({
  value,
  cardId,
}: {
  value: number;
  cardId: string;
}) {
  const { t } = useTranslation();
  const normalizedValue = Number.isFinite(value)
    ? Math.min(100, Math.max(0, Math.round(value)))
    : 50;

  const arcFill =
    normalizedValue <= 35
      ? DONUT_COLOR_ROSE
      : normalizedValue <= 65
        ? DONUT_COLOR_AMBER
        : DONUT_COLOR_EMERALD;

  const textClass =
    normalizedValue <= 35
      ? DONUT_TEXT_ROSE
      : normalizedValue <= 65
        ? DONUT_TEXT_AMBER
        : DONUT_TEXT_EMERALD;

  const data = useMemo(
    () => [{ v: normalizedValue, fill: arcFill }],
    [normalizedValue, arcFill],
  );

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className="relative flex cursor-help items-center justify-center"
            style={{ width: DONUT_SIZE, height: DONUT_SIZE }}
          />
        }
      >
        <RadialBarChart
          width={DONUT_SIZE}
          height={DONUT_SIZE}
          data={data}
          startAngle={90}
          endAngle={-270}
          innerRadius={DONUT_INNER}
          outerRadius={DONUT_OUTER}
          margin={DONUT_MARGIN}
          accessibilityLayer={false}
        >
          <PolarAngleAxis
            type="number"
            domain={DONUT_DOMAIN}
            tick={false}
            axisLine={false}
          />
          <RadialBar
            dataKey="v"
            barSize={3.5}
            cornerRadius={1.75}
            background={DONUT_TRACK}
          />
        </RadialBarChart>
        {/* Inner label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className={cn("text-[10px] font-bold tabular-nums", textClass)}>
            {normalizedValue}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-55 leading-relaxed">
        {t(`market.score_explainer.${cardId}`, { defaultValue: "" })}
      </TooltipContent>
    </Tooltip>
  );
});

function MarketContextFooter({
  context,
  isLoading,
  score,
  cardId,
}: {
  context: MarketContext | null;
  isLoading: boolean;
  score: number;
  cardId: string;
}) {
  const { t } = useTranslation();

  if (isLoading && !context) {
    return (
      <CardFooter className="mt-auto flex items-center justify-between gap-3 border-t border-border/40 pt-3">
        <div className="flex flex-col gap-2 flex-1">
          <Skeleton className="h-3.5 w-32 max-w-full" />
          <Skeleton className="h-4 w-28 max-w-full" />
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0">
          <Skeleton className="size-10 rounded-full" />
        </div>
      </CardFooter>
    );
  }

  return (
    <CardFooter className="mt-auto flex items-center justify-between gap-3 border-t border-border/40 pt-3">
      {/* Left side: Context details */}
      <div className="flex flex-col items-start gap-1 min-w-0 flex-1">
        {context ? (
          <>
            <div className="flex items-center gap-1 min-w-0">
              <span
                className="line-clamp-1 wrap-break-word text-xs font-semibold leading-tight text-foreground"
                title={context.name}
              >
                {context.name}
              </span>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="shrink-0 text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-help"
                      aria-label={t("market.market_context")}
                    />
                  }
                >
                  <Info className="size-3" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-55 leading-relaxed">
                  {t(`market.context_explainer.${cardId}`, {
                    defaultValue: "",
                  })}
                </TooltipContent>
              </Tooltip>
            </div>

            {context.kind === "quote" ? (
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 tabular-nums">
                <span className="text-sm font-bold text-foreground">
                  {formatValue(context.value, context.precision)}
                </span>
                <QuoteChange context={context} />
              </div>
            ) : context.changePercent !== undefined &&
              context.direction !== undefined ? (
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 tabular-nums">
                <span className="text-sm font-bold text-foreground">
                  {formatValue(context.value, context.precision)}
                </span>
                <ContextChange
                  changePercent={context.changePercent}
                  direction={context.direction}
                />
              </div>
            ) : (
              <span className="text-sm font-bold tabular-nums text-foreground">
                {formatValue(context.value, context.precision)}
              </span>
            )}
          </>
        ) : (
          <span
            className="text-xs leading-snug text-muted-foreground"
            role="status"
          >
            {t("market.market_context_unavailable")}
          </span>
        )}
      </div>

      {/* Right side: Score Donut */}
      <div className="flex flex-col items-center gap-1 shrink-0">
        <DonutGauge value={score} cardId={cardId} />
      </div>
    </CardFooter>
  );
}

export function MarketSummaryRow() {
  const { t } = useTranslation();

  const {
    data: assets,
    isLoading: assetsLoading,
    isFetching: assetsFetching,
    refetch: refetchAssets,
  } = useMarketData(MARKET_PULSE_SYMBOLS);

  const {
    data: fearGreed,
    isLoading: fearGreedLoading,
    isFetching: fgFetching,
    refetch: refetchFearGreed,
  } = useFearGreedIndex();

  const {
    data: cryptoContext,
    isLoading: cryptoContextLoading,
    refetch: refetchCryptoContext,
  } = useCryptoContext();

  const { data: idxContext, isLoading: idxContextLoading } = useIdxContext();

  const { data: usContext, isLoading: usContextLoading } = useUsContext();

  const {
    data: marketContexts,
    isLoading: marketContextsLoading,
    isFetching: marketContextsFetching,
    refetch: refetchMarketContexts,
  } = useMarketContexts();

  const isLoading =
    assetsLoading ||
    cryptoContextLoading ||
    idxContextLoading ||
    usContextLoading ||
    fearGreedLoading;

  const showEmptyState = !assets?.length && !assetsLoading && !isLoading;

  if (isLoading) {
    return (
      <>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              {t("market.pulse")}
            </h2>
            <Loader2 className="size-3.5 animate-spin text-primary opacity-50" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex size-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex size-1.5 rounded-full bg-primary"></span>
            </span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {t("market.live_connection")}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 w-full">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={`pulse-skeleton-${i}`} />
          ))}
        </div>
      </>
    );
  }

  // Map each card
  const cryptoCard = mapCryptoCard(
    cryptoContext,
    fearGreed,
    assets?.find((a) => a.symbol === "BTC-USD"),
    assets?.find((a) => a.symbol === "ETH-USD"),
  );

  const idEquityCard = mapIdEquityCard(
    idxContext,
    assets?.find((a) => a.symbol === "^JKSE"),
    assets?.find((a) => a.symbol === "USDIDR=X"),
  );

  const usEquityCard = mapUsEquityCard(
    usContext,
    assets?.find((a) => a.symbol === "^GSPC"),
    assets?.find((a) => a.symbol === "^VIX"),
    assets?.find((a) => a.symbol === "DX-Y.NYB"),
  );

  const commoditiesCard = mapCommoditiesCard(
    assets?.find((a) => a.symbol === "GC=F"),
    usContext,
    assets?.find((a) => a.symbol === "^VIX"),
    assets?.find((a) => a.symbol === "DX-Y.NYB"),
  );

  const forexCard = mapForexCard(
    assets?.find((a) => a.symbol === "USDIDR=X"),
    usContext,
    assets?.find((a) => a.symbol === "^VIX"),
    assets?.find((a) => a.symbol === "DX-Y.NYB"),
  );

  const cards = [
    cryptoCard,
    idEquityCard,
    usEquityCard,
    commoditiesCard,
    forexCard,
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            {t("market.pulse")}
          </h2>
          {(assetsFetching || fgFetching || marketContextsFetching) && (
            <Loader2 className="size-3.5 animate-spin text-primary opacity-50" />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex size-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex size-1.5 rounded-full bg-primary"></span>
          </span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {t("market.live_connection")}
          </span>
        </div>
      </div>

      <div className="w-full">
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
                    refetchAssets();
                    refetchFearGreed();
                    refetchCryptoContext();
                    refetchMarketContexts();
                  }}
                  className="gap-2 cursor-pointer font-semibold"
                >
                  <RotateCw data-icon="inline-start" />
                  {t("common.retry")}
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 w-full">
            {cards.map((card) => {
              const icon = getCardIcon(card.id);

              return (
                <Card
                  key={card.id}
                  className={cn(
                    "border transition-all duration-300 bg-card/45 backdrop-blur-xs w-full",
                    card.status === "error"
                      ? "border-rose-500/30 bg-rose-500/5"
                      : "border-border hover:border-zinc-700",
                  )}
                >
                  <CardHeader>
                    <CardTitle className="flex min-w-0 items-center gap-2">
                      {icon}
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
                        {t(card.title)}
                      </span>
                    </CardTitle>
                    <CardAction>
                      <TrendIndicator trend={card.trend} />
                    </CardAction>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-3 px-4 pt-0">
                    {card.status === "error" ? (
                      <div className="flex flex-col items-center justify-center py-4 text-center gap-2">
                        <AlertTriangle className="h-8 w-8 text-rose-500/80 animate-pulse" />
                        <span className="text-xs text-muted-foreground font-semibold">
                          {t("market.data_offline")}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 max-w-50">
                          {t("market.data_offline_desc")}
                        </span>
                      </div>
                    ) : (
                      <>
                        {/* Headline */}
                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                          <div className="flex flex-col min-w-0 gap-0.5 flex-1">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                              {getLabel(card.id, t)}
                            </span>
                            <div className="flex items-baseline gap-1 min-w-0">
                              <span
                                className="truncate text-xl font-bold tracking-tight text-foreground xl:text-2xl"
                                title={card.headlineValue}
                              >
                                {card.headlineValue}
                              </span>
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "opacity-40",
                                  card.changePercent > 0
                                    ? PALETTE.positive.textStrong
                                    : card.changePercent === 0
                                      ? PALETTE.neutral.textStrong
                                      : PALETTE.negative.textStrong,
                                )}
                              >
                                ∙
                              </span>
                              <PercentageChange
                                value={card.changePercent}
                                className="text-xs font-semibold shrink-0"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Sparkline Chart */}
                        <div className="h-9 w-full overflow-hidden">
                          {card.sparkline && card.sparkline.length > 0 && (
                            <Sparkline
                              values={card.sparkline}
                              width={220}
                              height={40}
                              className="flex w-full"
                            />
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>

                  <MarketContextFooter
                    context={marketContexts?.[card.assetGroup] ?? null}
                    isLoading={marketContextsLoading}
                    score={card.score}
                    cardId={card.id}
                  />
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function getCardIcon(id: string) {
  switch (id) {
    case "crypto":
      return <Coins className="size-4 text-muted-foreground" />;
    case "id-equity":
      return <Building2 className="size-4 text-muted-foreground" />;
    case "us-equity":
      return <Globe className="size-4 text-muted-foreground" />;
    case "commodities":
      return <Gem className="size-4 text-muted-foreground" />;
    case "forex":
      return <DollarSign className="size-4 text-muted-foreground" />;
    default:
      return <Coins className="size-4 text-muted-foreground" />;
  }
}

function getLabel(cardId: string, t: (key: string) => string) {
  switch (cardId) {
    case "crypto":
      return "BTC USD";
    case "id-equity":
      return "IHSG IDX";
    case "us-equity":
      return "S&P 500";
    case "commodities":
      return "Gold USD";
    case "forex":
      return "USD / IDR";
    default:
      return t("market.index_fallback");
  }
}

function SkeletonCard() {
  return (
    <Card className="border transition-all duration-300 bg-card/45 backdrop-blur-xs w-full border-border hover:border-zinc-700">
      <CardHeader>
        <CardTitle className="flex min-w-0 items-center gap-2">
          <Skeleton className="size-4" />
          <Skeleton className="h-4 w-20" />
        </CardTitle>
        <CardAction>
          <Skeleton className="h-5 w-16 rounded-md" />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 px-4 pt-0">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-6 w-28 max-w-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-9 w-full" />
      </CardContent>

      <CardFooter className="mt-auto flex items-center justify-between gap-3 border-t border-border/40 pt-3">
        <div className="flex flex-col gap-2 flex-1">
          <Skeleton className="h-3.5 w-32 max-w-full" />
          <Skeleton className="h-4 w-28 max-w-full" />
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0">
          <Skeleton className="size-10 rounded-full" />
        </div>
      </CardFooter>
    </Card>
  );
}
