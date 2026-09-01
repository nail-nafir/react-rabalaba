import React from "react";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BADGE } from "@/constants/taxonomy/palette";
import { TIER_COLORS } from "@/constants/taxonomy/colors";
import { cn } from "@/lib/utils";
import type { CandlestickPattern, ChartPattern } from "../types/learn";
import { PatternDetailDialog } from "./pattern-detail-dialog";

export interface CheatsheetTableProps {
  patterns: (CandlestickPattern | ChartPattern)[];
}

const getWinRateColor = (winRate: number): string => {
  if (winRate >= 65) return TIER_COLORS.A.text;
  if (winRate >= 55) return TIER_COLORS.B.text;
  return TIER_COLORS.C.text;
};

const getDifficultyBadge = (difficulty: string) => {
  switch (difficulty) {
    case "beginner":
      return BADGE.positive;
    case "intermediate":
      return BADGE.warning;
    case "advanced":
      return BADGE.negative;
    default:
      return BADGE.neutral;
  }
};

const getPatternIdealTimeframe = (category: string, id: string): string => {
  if (
    id === "head-and-shoulders" ||
    id === "inverse-head-and-shoulders" ||
    id === "cup-and-handle"
  ) {
    return "H4 - Daily";
  }
  if (category === "chart-continuation" || id === "bull-flag-and-pennant") {
    return "M15 - H4";
  }
  if (category === "chart-reversal") {
    return "H1 - Daily";
  }
  if (category === "candlestick-single") {
    return "M15 - Daily";
  }
  return "H1 - Daily";
};

const getPatternExpectedRR = (category: string, winRate: number): string => {
  if (category === "chart-reversal") return "1 : 3.2";
  if (category === "chart-continuation") return "1 : 2.8";
  if (category === "candlestick-multi") return "1 : 2.5";
  if (category === "candlestick-dual") return "1 : 2.2";
  return winRate >= 70 ? "1 : 2.0" : "1 : 1.8";
};

export const CheatsheetTable: React.FC<CheatsheetTableProps> = ({
  patterns,
}) => {
  const { t } = useTranslation();

  return (
    <div className="rounded-md border overflow-x-auto shadow-sm">
      <Table>
        <TableHeader className="bg-muted">
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-45 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              {t("learn.cheatsheet.columns.name")}
            </TableHead>
            <TableHead className="min-w-32 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              {t("learn.cheatsheet.columns.category")}
            </TableHead>
            <TableHead className="min-w-28 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              {t("learn.cheatsheet.columns.bias")}
            </TableHead>
            <TableHead className="min-w-28 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              {t("learn.cheatsheet.columns.difficulty")}
            </TableHead>
            <TableHead className="min-w-32 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              {t("learn.cheatsheet.columns.timeframe")}
            </TableHead>
            <TableHead className="min-w-28 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              {t("learn.cheatsheet.columns.rr")}
            </TableHead>
            <TableHead className="text-right min-w-35 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              {t("learn.cheatsheet.columns.rating")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patterns.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={7}
                className="h-48 text-center text-xs text-muted-foreground"
              >
                {t("learn.cheatsheet.empty")}
              </TableCell>
            </TableRow>
          ) : (
            patterns.map((item) => {
              const isCandle = item.category.startsWith("candlestick");
              const patternKey = `learn.patterns.${isCandle ? "candlestick" : "chart"}.${item.id}`;
              const isBullish = item.bias === "bullish";
              const isBearish = item.bias === "bearish";

              const biasColors = isBullish
                ? BADGE.positive
                : isBearish
                  ? BADGE.negative
                  : BADGE.warning;

              const diffColors = getDifficultyBadge(item.difficulty);

              return (
                <PatternDetailDialog
                  key={item.id}
                  pattern={item}
                  trigger={
                    <TableRow className="cursor-pointer hover:bg-muted/50 active:bg-muted/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background group">
                      {/* Name & Native Name */}
                      <TableCell className="py-2.5">
                        <div className="py-0.5">
                          <div className="font-bold text-sm tracking-tight text-foreground flex items-center gap-2 group-hover:text-primary transition-colors">
                            {t(`${patternKey}.name`)}
                          </div>
                          {"nativeName" in item && item.nativeName ? (
                            <div className="text-xs truncate max-w-xs text-muted-foreground">
                              {item.nativeName}
                            </div>
                          ) : (
                            <div className="text-xs truncate max-w-xs text-muted-foreground">
                              {t(`${patternKey}.description`)}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Category (Plain Text) */}
                      <TableCell className="py-2.5 whitespace-nowrap">
                        <span className="text-xs text-muted-foreground font-medium">
                          {t(
                            `learn.common.pattern_categories.${item.category}`,
                          )}
                        </span>
                      </TableCell>

                      {/* Bias Badge */}
                      <TableCell className="py-2.5 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold rounded-md uppercase tracking-wider",
                            biasColors.bg,
                            biasColors.text,
                            biasColors.border,
                          )}
                        >
                          {t(`learn.common.bias.${item.bias}`)}
                        </Badge>
                      </TableCell>

                      {/* Difficulty Badge (Color adjusted by level) */}
                      <TableCell className="py-2.5 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold rounded-md uppercase tracking-wider",
                            diffColors.bg,
                            diffColors.text,
                            diffColors.border,
                          )}
                        >
                          {t(`learn.common.difficulty.${item.difficulty}`)}
                        </Badge>
                      </TableCell>

                      {/* Timeframe Ideal (Plain Text) */}
                      <TableCell className="py-2.5 whitespace-nowrap">
                        <span className="text-xs text-muted-foreground font-medium">
                          {getPatternIdealTimeframe(item.category, item.id)}
                        </span>
                      </TableCell>

                      {/* Expected R:R */}
                      <TableCell className="py-2.5 whitespace-nowrap">
                        <span className="text-xs font-semibold text-foreground">
                          {getPatternExpectedRR(item.category, item.winRate)}
                        </span>
                      </TableCell>

                      {/* Win Rate & Segmented Micro-Bar Meter */}
                      <TableCell className="py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2.5">
                          <span
                            className={cn(
                              "font-bold text-xs",
                              getWinRateColor(item.winRate),
                            )}
                          >
                            {item.winRate}%
                          </span>
                          <div
                            className="flex items-center gap-0.5"
                            title={`${item.reliability} / 5`}
                            role="img"
                            aria-label={t("learn.common.rating_aria", {
                              count: item.reliability,
                            })}
                          >
                            {Array.from({ length: 5 }).map((_, i) => {
                              const isActive = i < item.reliability;
                              return (
                                <div
                                  key={i}
                                  className={cn(
                                    "w-1 h-3 rounded-[1px] transition-colors",
                                    isActive
                                      ? item.reliability >= 4
                                        ? "bg-emerald-500"
                                        : item.reliability === 3
                                          ? "bg-amber-400"
                                          : "bg-rose-500"
                                      : "bg-muted-foreground/20",
                                  )}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  }
                />
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};
