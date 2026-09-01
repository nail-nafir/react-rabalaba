import React from "react";
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
import { Button } from "@/components/ui/button";
import { BADGE } from "@/constants/taxonomy/palette";
import { cn } from "@/lib/utils";
import { PatternVisual } from "./pattern-visual";
import { StrategyDetailDialog } from "./strategy-detail-dialog";
import { TRADING_STRATEGIES } from "../data/strategy-data";
import { BookOpen } from "lucide-react";

export const StrategySection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
        {t("learn.strategies_ui.title")}
      </h2>

      {/* 6 Strategy Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 items-stretch">
        {TRADING_STRATEGIES.map((strategy) => (
          <Card
            key={strategy.id}
            className="relative transition-all duration-300 h-full flex flex-col cursor-pointer border border-border hover:border-primary shadow-sm hover:-translate-y-1 hover:shadow-md overflow-hidden ring-0 bg-card group"
          >
            {/* Header */}
            <CardHeader className="space-y-4 flex flex-col w-full p-6">
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
                <CardTitle className="text-lg font-bold tracking-tight uppercase group-hover:text-primary transition-colors line-clamp-1">
                  {t(`learn.strategies.items.${strategy.id}.title`)}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground leading-relaxed min-h-10 line-clamp-2 px-0">
                  {t(`learn.strategies.items.${strategy.id}.summary`)}
                </CardDescription>
              </div>
            </CardHeader>

            {/* Content */}
            <CardContent className="flex-1 w-full flex flex-col items-center space-y-6 pb-6">
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
    </div>
  );
};
