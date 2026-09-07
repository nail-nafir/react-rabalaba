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
import { PatternVisual } from "./pattern-visual";
import { BarChart3, CheckCircle2, Target } from "lucide-react";
import type { TradingStrategy } from "../types/learn";

export interface StrategyDetailDialogProps {
  strategy: TradingStrategy;
  trigger: ReactElement;
}

export const StrategyDetailDialog: React.FC<StrategyDetailDialogProps> = ({
  strategy,
  trigger,
}) => {
  const { t } = useTranslation();
  const strategyKey = `learn.strategies.items.${strategy.id}`;
  const principles = t(`${strategyKey}.key_principles`, {
    returnObjects: true,
  });
  const principlesList = Array.isArray(principles)
    ? (principles as string[])
    : [];

  const checklist = t(`${strategyKey}.action_checklist`, {
    returnObjects: true,
  });
  const checklistList = Array.isArray(checklist) ? (checklist as string[]) : [];

  const diffBadge = (() => {
    switch (strategy.difficulty) {
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

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] border border-border text-foreground flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header styled identically to pattern detail dialog */}
        <DialogHeader className="shrink-0 bg-popover p-4 pb-0">
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground uppercase pr-6">
            {t(`${strategyKey}.title`)}
          </DialogTitle>

          <div className="space-y-0.5 mt-1">
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              {t(`${strategyKey}.summary`)}
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
              {t(`learn.common.difficulty.${strategy.difficulty}`)}
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
              {t(`learn.common.strategy_categories.${strategy.category}`)}
            </Badge>
          </div>

          <Separator className="mt-4" />
        </DialogHeader>

        {/* Scrollable Content Body */}
        <div className="flex-1 min-h-0 flex flex-col space-y-6 p-4 overflow-y-auto">
          {/* Section: Schematic Visual Diagram */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">
                {t("learn.strategies_ui.schematic")}
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
                  type={strategy.svgType}
                  className="w-full max-w-lg h-48"
                />
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Section: Key Principles */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">
                {t("learn.strategies_ui.principles")}
              </h3>
            </div>
            <Card className="border border-border bg-muted/50">
              <CardContent className="space-y-2.5">
                {principlesList.map((principle, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 text-xs leading-relaxed"
                  >
                    <span className="font-mono text-[10px] font-semibold text-muted-foreground bg-muted/70 border border-border size-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="text-foreground/90">{principle}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Section: Execution Setup & Checklist */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">
                {t("dialog.trading_plan")}
              </h3>
            </div>

            {/* Formula / Rule Setup Card */}
            <Card className="border border-border bg-muted/50">
              <CardContent className="space-y-1">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {t("learn.strategies_ui.formula")}
                </CardTitle>
                <p className="text-xs text-foreground/90 leading-relaxed">
                  {t(`${strategyKey}.formula_or_setup`)}
                </p>
              </CardContent>
            </Card>

            {/* Step-by-Step Action Checklist Card */}
            <Card className="border border-border bg-muted/50">
              <CardContent className="space-y-2.5">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                  {t("learn.strategies_ui.checklist")}
                </CardTitle>
                {checklistList.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 text-xs leading-relaxed"
                  >
                    <span
                      className={cn(
                        "size-5 rounded-full font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 border",
                        BADGE.positive.border,
                        BADGE.positive.bg,
                        PALETTE.positive.text,
                      )}
                    >
                      ✓
                    </span>
                    <span className="text-foreground/90">{step}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Pro Tip Callout Card */}
            <Card className="border border-border bg-muted/50">
              <CardContent className="space-y-1">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {t("learn.strategies_ui.pro_tip")}
                </CardTitle>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t(`${strategyKey}.pro_tip`)}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
