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
import { BADGE, PALETTE } from "@/constants/taxonomy/palette";
import { TIER_COLORS } from "@/constants/taxonomy/colors";
import { cn } from "@/lib/utils";
import { PatternVisual } from "./pattern-visual";
import {
  Target,
  ShieldAlert,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import type { CandlestickPattern, ChartPattern } from "../types/learn";

export interface PatternDetailDialogProps {
  pattern: CandlestickPattern | ChartPattern;
  trigger: ReactElement;
}

const getWinRateColor = (winRate: number): string => {
  if (winRate >= 65) return TIER_COLORS.A.text; // text-emerald-400
  if (winRate >= 55) return TIER_COLORS.B.text; // text-amber-400
  return TIER_COLORS.C.text; // text-rose-400
};

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
        <DialogHeader className="shrink-0 bg-popover p-6 pb-4 border-b border-border space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
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
              <Badge
                variant="outline"
                className={cn(
                  "font-bold tracking-wider uppercase text-[10px] rounded-md",
                  diffBadge.bg,
                  diffBadge.text,
                  diffBadge.border,
                )}
              >
                {t(`learn.common.difficulty.${pattern.difficulty}`)}
              </Badge>
              {"nativeName" in pattern && pattern.nativeName && (
                <span className="text-xs text-muted-foreground">
                  {pattern.nativeName}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "text-xs font-bold",
                  getWinRateColor(pattern.winRate),
                )}
              >
                {pattern.winRate}% {t("learn.common.win_rate")}
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

          <div className="space-y-1">
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground uppercase">
              {t(`${patternKey}.name`)}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              {t(`${patternKey}.description`)}
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Scrollable Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Visual Schematic Diagram Box */}
          <div className="relative p-4 rounded-xl border border-border bg-muted/20 flex flex-col items-center justify-center overflow-hidden">
            {/* Standard dashed technical grid lines */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none opacity-40 flex flex-col justify-around px-4 py-8"
            >
              <div className="border-b border-dashed border-muted-foreground/30 w-full" />
              <div className="border-b border-dashed border-muted-foreground/30 w-full" />
              <div className="border-b border-dashed border-muted-foreground/30 w-full" />
            </div>

            <div className="relative z-10 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              {t("learn.pattern_dialog.schematic")}
            </div>
            <PatternVisual
              type={pattern.svgType}
              className="relative z-10 w-full max-w-lg h-48"
            />
          </div>

          {/* Psychology & Context */}
          <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {t("learn.pattern_dialog.psychology")}
            </h4>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t(`${patternKey}.psychology`)}
            </p>
          </div>

          {/* Rules & Checklists */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <CheckCircle2
                className={cn("h-3.5 w-3.5", PALETTE.positive.text)}
              />
              {t("learn.pattern_dialog.validation")}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {rulesList.map((rule, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2.5 rounded-lg border border-border/60 bg-muted/20 text-xs text-muted-foreground leading-relaxed"
                >
                  <span className="font-bold text-primary text-[10px] bg-primary/10 size-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Execution Strategy Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Entry Trigger */}
            <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase">
                <Target className="h-3.5 w-3.5" />
                {t("learn.pattern_dialog.entry_trigger")}
              </div>
              <p className="text-xs text-foreground/90 leading-snug">
                {t(
                  `${patternKey}.${isCandle ? "entry_trigger" : "neckline_rule"}`,
                )}
              </p>
            </div>

            {/* Stop Loss */}
            <div
              className={cn(
                "p-3.5 rounded-xl border space-y-1",
                BADGE.negative.border,
                BADGE.negative.bg,
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-1.5 text-xs font-bold uppercase",
                  PALETTE.negative.text,
                )}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                {t("learn.pattern_dialog.stop_loss")}
              </div>
              <p className="text-xs text-foreground/90 leading-snug">
                {t(
                  `${patternKey}.${isCandle ? "stop_loss" : "stop_loss_placement"}`,
                )}
              </p>
            </div>

            {/* Target / Volume */}
            <div
              className={cn(
                "p-3.5 rounded-xl border space-y-1",
                BADGE.positive.border,
                BADGE.positive.bg,
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-1.5 text-xs font-bold uppercase",
                  PALETTE.positive.text,
                )}
              >
                <Volume2 className="h-3.5 w-3.5" />
                {t(
                  `learn.pattern_dialog.${isCandle ? "volume_rule" : "target_projection"}`,
                )}
              </div>
              <p className="text-xs text-foreground/90 leading-snug">
                {t(
                  `${patternKey}.${isCandle ? "volume_rule" : "target_calculation"}`,
                )}
              </p>
            </div>
          </div>

          {/* False Breakout Trap (for Chart Patterns) */}
          {!isCandle && (
            <div
              className={cn(
                "p-4 rounded-xl border space-y-1 text-xs",
                BADGE.warning.border,
                BADGE.warning.bg,
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-1.5 font-bold uppercase",
                  PALETTE.warning.text,
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {t("learn.pattern_dialog.false_breakout")}
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {t(`${patternKey}.false_breakout_warning`)}
              </p>
            </div>
          )}

          {/* Pro Trader Edge Callout */}
          <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex items-start gap-3 text-xs leading-relaxed">
            <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-primary mr-1">
                {t("learn.pattern_dialog.pro_tip")}
              </span>
              <span className="text-foreground/90 font-medium italic">
                "{t(`${patternKey}.pro_tip`)}"
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
