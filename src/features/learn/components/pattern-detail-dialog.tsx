import React, { type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BADGE, PALETTE } from "@/constants/taxonomy/palette";
import { cn } from "@/lib/utils";
import { BarChart3, CheckCircle2, Target } from "lucide-react";
import { PatternVisual } from "./pattern-visual";
import type { CandlestickPattern, ChartPattern } from "../types/learn";

export interface PatternDetailDialogProps {
  pattern: CandlestickPattern | ChartPattern;
  trigger: ReactElement;
}

export const PatternDetailDialog: React.FC<PatternDetailDialogProps> = ({
  pattern,
  trigger,
}) => {
  const { t } = useTranslation();

  const isCandle = pattern.category.startsWith("candlestick");
  const isBullish = pattern.bias === "bullish";
  const isBearish = pattern.bias === "bearish";
  const patternKey = `learn.patterns.${isCandle ? "candlestick" : "chart"}.${pattern.id}`;

  const colors = isBullish
    ? BADGE.positive
    : isBearish
      ? BADGE.negative
      : pattern.bias === "neutral"
        ? BADGE.neutral
        : BADGE.warning;

  const diffBadge = (() => {
    switch (pattern.difficulty) {
      case "beginner":
        return BADGE.positive;
      case "intermediate":
        return BADGE.warning;
      case "advanced":
        return BADGE.negative;
      default:
        return BADGE.neutral;
    }
  })();

  const rules = t(`${patternKey}.${isCandle ? "rules" : "structure_rules"}`, {
    returnObjects: true,
  });
  const rulesList = Array.isArray(rules) ? (rules as string[]) : [];

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] border border-border text-foreground flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header styled identically to terminal detail dialogs */}
        <DialogHeader className="shrink-0 bg-popover p-4 pb-0">
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground uppercase flex items-center gap-2 flex-wrap pr-6">
            <span>{t(`${patternKey}.name`)}</span>
            <Badge
              variant="outline"
              className={cn(
                "font-bold tracking-wider uppercase text-[10px] rounded-md",
                colors.bg,
                colors.text,
                colors.border,
              )}
            >
              {t(`learn.common.bias.${pattern.bias}`)}
            </Badge>
          </DialogTitle>

          <div className="space-y-0.5 mt-1">
            {"nativeName" in pattern && pattern.nativeName && (
              <p className="text-xs font-medium text-foreground/85">
                {pattern.nativeName}
              </p>
            )}
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              {t(`${patternKey}.description`)}
            </DialogDescription>
          </div>

          {/* Meta badges */}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <Badge
              variant="outline"
              className={cn(
                "font-bold uppercase tracking-wider text-[10px] rounded-md",
                diffBadge.bg,
                diffBadge.text,
                diffBadge.border,
              )}
            >
              {t(`learn.common.difficulty.${pattern.difficulty}`)}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "font-bold uppercase tracking-wider text-[10px] rounded-md",
                BADGE.neutral.bg,
                BADGE.neutral.text,
                BADGE.neutral.border,
              )}
            >
              {t(`learn.common.pattern_categories.${pattern.category}`)}
            </Badge>
          </div>

          <Separator className="mt-4" />
        </DialogHeader>

        {/* Scrollable Content Body */}
        <div className="flex-1 min-h-0 flex flex-col space-y-6 p-4 overflow-y-auto">
          {/* Section: Schematic Visual Diagram & Psychology */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">
                {t("learn.pattern_dialog.schematic")}
              </h3>
            </div>
            <Card className="relative border border-border bg-muted/50 flex flex-col items-center justify-center overflow-hidden">
              {/* Standard dashed technical grid lines */}
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none opacity-40 flex flex-col justify-around px-4 py-8"
              >
                <div className="border-b border-dashed border-muted-foreground/30 w-full" />
                <div className="border-b border-dashed border-muted-foreground/30 w-full" />
                <div className="border-b border-dashed border-muted-foreground/30 w-full" />
              </div>

              <CardContent className="relative z-10 flex flex-col items-center justify-center w-full">
                <PatternVisual
                  type={pattern.svgType}
                  className="w-full max-w-lg h-48"
                />
              </CardContent>
            </Card>

            {/* Psychology & Context */}
            <Card className="border border-border bg-muted/50">
              <CardContent className="space-y-1">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {t("learn.pattern_dialog.psychology")}
                </CardTitle>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t(`${patternKey}.psychology`)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Section: Validation Rules */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">
                {t("learn.pattern_dialog.validation")}
              </h3>
            </div>
            <Card className="border border-border bg-muted/50">
              <CardContent className="space-y-2.5">
                {rulesList.map((rule, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 text-xs leading-relaxed"
                  >
                    <span className="font-mono text-[10px] font-semibold text-muted-foreground bg-muted/70 border border-border size-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="text-foreground/90">{rule}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Section: Trading Plan */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">
                {t("dialog.trading_plan")}
              </h3>
            </div>

            {/* Execution Strategy Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Entry Trigger */}
              <Card className="border border-border bg-muted/50">
                <CardContent className="space-y-1">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                    {t("learn.pattern_dialog.entry_trigger")}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {t(
                      `${patternKey}.${isCandle ? "entry_trigger" : "neckline_rule"}`,
                    )}
                  </p>
                </CardContent>
              </Card>

              {/* Stop Loss */}
              <Card
                className={cn(
                  "border",
                  BADGE.negative.border,
                  BADGE.negative.bg,
                )}
              >
                <CardContent className="space-y-1">
                  <CardTitle
                    className={cn(
                      "text-xs font-bold uppercase tracking-wider",
                      PALETTE.negative.text,
                    )}
                  >
                    {t("learn.pattern_dialog.stop_loss")}
                  </CardTitle>
                  <p className="text-xs text-foreground/90 leading-snug">
                    {t(
                      `${patternKey}.${isCandle ? "stop_loss" : "stop_loss_placement"}`,
                    )}
                  </p>
                </CardContent>
              </Card>

              {/* Target / Volume */}
              <Card
                className={cn(
                  "border",
                  BADGE.positive.border,
                  BADGE.positive.bg,
                )}
              >
                <CardContent className="space-y-1">
                  <CardTitle
                    className={cn(
                      "text-xs font-bold uppercase tracking-wider",
                      PALETTE.positive.text,
                    )}
                  >
                    {t(
                      `learn.pattern_dialog.${isCandle ? "volume_rule" : "target_projection"}`,
                    )}
                  </CardTitle>
                  <p className="text-xs text-foreground/90 leading-snug">
                    {t(
                      `${patternKey}.${isCandle ? "volume_rule" : "target_calculation"}`,
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* False Breakout Trap (for Chart Patterns) */}
            {!isCandle && (
              <Card
                className={cn(
                  "border text-xs",
                  BADGE.warning.border,
                  BADGE.warning.bg,
                )}
              >
                <CardContent className="space-y-1">
                  <CardTitle
                    className={cn(
                      "font-bold uppercase tracking-wider text-xs",
                      PALETTE.warning.text,
                    )}
                  >
                    {t("learn.pattern_dialog.false_breakout")}
                  </CardTitle>
                  <p className="text-muted-foreground leading-relaxed">
                    {t(`${patternKey}.false_breakout_warning`)}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Pro Trader Edge Callout */}
            <Card className="border border-border bg-muted/50">
              <CardContent className="space-y-1">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {t("learn.pattern_dialog.pro_tip")}
                </CardTitle>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t(`${patternKey}.pro_tip`)}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
