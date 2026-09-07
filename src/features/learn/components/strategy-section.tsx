import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FilterGroup } from "@/components/shared/filter-group";
import { Button } from "@/components/ui/button";
import { BADGE } from "@/constants/taxonomy/palette";
import { cn } from "@/lib/utils";
import { PatternVisual } from "./pattern-visual";
import { StrategyDetailDialog } from "./strategy-detail-dialog";
import { TRADING_STRATEGIES } from "../data/strategy-data";
import { BookOpen, Search, X } from "lucide-react";
import type { TradingStrategy } from "../types/learn";

type StrategyFilter = "all" | TradingStrategy["category"];

export const StrategySection: React.FC = () => {
  const { t } = useTranslation();
  const [strategyFilter, setStrategyFilter] = useState<StrategyFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const strategyFilterOptions = [
    { value: "all" as const, label: t("learn.strategies_ui.filters.all") },
    {
      value: "indicators" as const,
      label: t("learn.common.strategy_categories.indicators"),
    },
    { value: "smc" as const, label: t("learn.common.strategy_categories.smc") },
    {
      value: "market_structure" as const,
      label: t("learn.common.strategy_categories.market_structure"),
    },
    {
      value: "multi_timeframe" as const,
      label: t("learn.common.strategy_categories.multi_timeframe"),
    },
  ];

  const filteredStrategies = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return TRADING_STRATEGIES.filter((strategy) => {
      const strategyKey = `learn.strategies.items.${strategy.id}`;
      const categoryLabel = t(
        `learn.common.strategy_categories.${strategy.category}`,
      );
      const matchesFilter =
        strategyFilter === "all" || strategy.category === strategyFilter;
      const matchesSearch =
        !query ||
        [
          t(`${strategyKey}.title`),
          t(`${strategyKey}.summary`),
          categoryLabel,
        ].some((value) => value.toLowerCase().includes(query));

      return matchesFilter && matchesSearch;
    });
  }, [searchQuery, strategyFilter, t]);

  return (
    <section className="flex flex-col gap-4">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          {t("learn.strategies_ui.title")}
        </h2>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest shrink-0">
          {t("learn.strategies_ui.results", {
            count: filteredStrategies.length,
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FilterGroup
              value={strategyFilter}
              options={strategyFilterOptions}
              onChange={(value) => setStrategyFilter(value as StrategyFilter)}
              className="flex-1 md:flex-none shrink-0 min-w-0 sm:w-fit"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 min-h-9">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              type="text"
              placeholder={t("learn.strategies_ui.search_placeholder")}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-9 pr-9 text-sm placeholder:text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label={t("learn.strategies_ui.clear_search")}
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Strategy Cards Grid */}
      {filteredStrategies.length === 0 ? (
        <div className="rounded-md border p-12 text-center text-xs text-muted-foreground">
          {t("learn.strategies_ui.empty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 items-stretch">
          {filteredStrategies.map((strategy) => (
            <Card
              key={strategy.id}
              className="relative h-full flex flex-col cursor-pointer border border-border hover:bg-muted/50 hover:border-primary group"
            >
            {/* Header */}
            <CardHeader className="space-y-4 flex flex-col w-full">
              <div className="flex items-center justify-between w-full gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-md text-[10px] font-bold uppercase tracking-wider",
                    BADGE.positive.bg,
                    BADGE.positive.text,
                    BADGE.positive.border,
                  )}
                >
                  {t(`learn.common.strategy_categories.${strategy.category}`)}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-md text-[10px] font-bold uppercase tracking-wider",
                    BADGE.neutral.bg,
                    BADGE.neutral.text,
                    BADGE.neutral.border,
                  )}
                >
                  {t(`learn.common.difficulty.${strategy.difficulty}`)}
                </Badge>
              </div>

              <div className="space-y-1.5 w-full">
                <CardTitle className="text-lg font-bold tracking-tight uppercase leading-7 line-clamp-2 min-h-14 group-hover:text-primary transition-colors">
                  {t(`learn.strategies.items.${strategy.id}.title`)}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground leading-relaxed min-h-10 line-clamp-2 px-0">
                  {t(`learn.strategies.items.${strategy.id}.summary`)}
                </CardDescription>
              </div>
            </CardHeader>

            {/* Content */}
            <CardContent className="flex-1 w-full flex flex-col items-center space-y-6 pb-0">
              {/* Inner Card Box */}
              <Card className="relative overflow-hidden w-full transition-all duration-300 select-none border shadow-none bg-muted/50 border-border hover:bg-muted/60">
                {/* Subtle dashed technical grid lines */}
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none opacity-30 flex flex-col justify-around px-2 py-4"
                >
                  <div className="border-b border-dashed border-muted-foreground/30 w-full" />
                  <div className="border-b border-dashed border-muted-foreground/30 w-full" />
                  <div className="border-b border-dashed border-muted-foreground/30 w-full" />
                </div>
                <CardContent className="relative z-10 flex flex-col items-center justify-center p-4 h-40">
                  <PatternVisual
                    type={strategy.svgType}
                    className="w-full h-full"
                  />
                </CardContent>
              </Card>
            </CardContent>

            {/* Footer */}
            <CardFooter>
              <StrategyDetailDialog
                strategy={strategy}
                trigger={
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full text-xs font-bold transition-all cursor-pointer items-center justify-center gap-1.5 tracking-tight hover:bg-primary hover:text-primary-foreground hover:border-primary"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>{t("learn.common.explore_masterclass")}</span>
                  </Button>
                }
              />
            </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};
