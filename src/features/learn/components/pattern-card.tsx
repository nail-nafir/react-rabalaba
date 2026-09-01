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
import { TIER_COLORS } from "@/constants/taxonomy/colors";
import { cn } from "@/lib/utils";
import { PatternVisual } from "./pattern-visual";
import { PatternDetailDialog } from "./pattern-detail-dialog";
import { BookOpen } from "lucide-react";
import type { CandlestickPattern, ChartPattern } from "../types/learn";

interface PatternCardProps {
  pattern: CandlestickPattern | ChartPattern;
}

const COMPACT_SIGNAL_BADGE_CLASSNAME =
  "rounded-md text-[10px] font-bold uppercase tracking-wider";

const getWinRateColor = (winRate: number): string => {
  if (winRate >= 65) return TIER_COLORS.A.text; // text-emerald-400
  if (winRate >= 55) return TIER_COLORS.B.text; // text-amber-400
  return TIER_COLORS.C.text; // text-rose-400
};

export const PatternCard: React.FC<PatternCardProps> = ({ pattern }) => {
  const { t } = useTranslation();

  const isBullish = pattern.bias === "bullish";
  const isBearish = pattern.bias === "bearish";
  const patternKey = `learn.patterns.${pattern.category.startsWith("candlestick") ? "candlestick" : "chart"}.${pattern.id}`;

  const colors = isBullish
    ? BADGE.positive
    : isBearish
      ? BADGE.negative
      : BADGE.warning;

  return (
    <Card className="relative transition-all duration-300 h-full flex flex-col cursor-pointer border border-border hover:border-primary shadow-sm hover:-translate-y-1 hover:shadow-md overflow-hidden ring-0 bg-card group">
      {/* Header */}
      <CardHeader className="space-y-4 flex flex-col w-full p-6">
        <div className="flex items-center justify-between w-full gap-2">
          <Badge
            variant="outline"
            className={cn(
              COMPACT_SIGNAL_BADGE_CLASSNAME,
              colors.bg,
              colors.text,
              colors.border,
            )}
          >
            {t(`learn.common.bias.${pattern.bias}`)}
          </Badge>

          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "text-xs font-bold",
                getWinRateColor(pattern.winRate),
              )}
            >
              {pattern.winRate}%
            </span>
            <div
              role="img"
              aria-label={t("learn.common.rating_aria", {
                count: pattern.reliability,
              })}
              title={`${pattern.reliability} / 5`}
              className="flex items-center gap-0.5"
            >
              {Array.from({ length: 5 }).map((_, i) => {
                const isActive = i < pattern.reliability;
                return (
                  <div
                    key={i}
                    aria-hidden
                    className={cn(
                      "w-1.5 h-3.5 rounded-[1.5px] transition-colors",
                      isActive
                        ? pattern.reliability >= 4
                          ? "bg-emerald-500"
                          : pattern.reliability === 3
                            ? "bg-amber-400"
                            : "bg-rose-500"
                        : "bg-muted-foreground/20",
                    )}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-1.5 w-full">
          <CardTitle className="text-lg font-bold tracking-tight uppercase group-hover:text-primary transition-colors">
            {t(`${patternKey}.name`)}
          </CardTitle>
          {"nativeName" in pattern && pattern.nativeName && (
            <p className="text-xs text-muted-foreground">
              {pattern.nativeName}
            </p>
          )}
          <CardDescription className="text-xs text-muted-foreground leading-relaxed min-h-10 line-clamp-2 px-0">
            {t(`${patternKey}.description`)}
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
            <PatternVisual type={pattern.svgType} className="w-full h-full" />
          </CardContent>
        </Card>
      </CardContent>

      {/* Footer */}
      <CardFooter>
        <PatternDetailDialog
          pattern={pattern}
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
  );
};
