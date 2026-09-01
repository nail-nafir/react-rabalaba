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
import { cn } from "@/lib/utils";
import { PatternVisual } from "./pattern-visual";
import { Sparkles, CheckCircle2, Lightbulb, Target } from "lucide-react";
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
  const checklist = t(`${strategyKey}.action_checklist`, {
    returnObjects: true,
  });

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] border border-border text-foreground flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header styled identically to terminal detail dialogs */}
        <DialogHeader className="shrink-0 bg-popover p-6 pb-4 border-b border-border space-y-3">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "font-bold tracking-wider uppercase text-[10px] rounded-md",
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
                "font-bold tracking-wider uppercase text-[10px] rounded-md",
                BADGE.neutral.bg,
                BADGE.neutral.text,
                BADGE.neutral.border,
              )}
            >
              {t(`learn.common.difficulty.${strategy.difficulty}`)}
            </Badge>
          </div>

          <div className="space-y-1">
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground uppercase">
              {t(`${strategyKey}.title`)}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              {t(`${strategyKey}.summary`)}
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
              {t("learn.strategies_ui.schematic")}
            </div>
            <PatternVisual
              type={strategy.svgType}
              className="relative z-10 w-full max-w-lg h-48"
            />
          </div>
          {/* Key Principles */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {t("learn.strategies_ui.principles")}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Array.isArray(principles) ? (principles as string[]) : []).map(
                (principle, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg border border-border/60 bg-muted/20 text-xs text-muted-foreground leading-relaxed flex items-start gap-2"
                  >
                    <span className="font-bold text-primary text-[10px] bg-primary/10 size-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{principle}</span>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Formula & Rule Setup Box */}
          <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" />
              {t("learn.strategies_ui.formula")}
            </div>
            <p className="text-xs font-bold text-foreground">
              {t(`${strategyKey}.formula_or_setup`)}
            </p>
          </div>

          {/* Step-by-Step Action Checklist */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <CheckCircle2
                className={cn("h-3.5 w-3.5", PALETTE.positive.text)}
              />
              {t("learn.strategies_ui.checklist")}
            </h4>
            <div className="space-y-2">
              {(Array.isArray(checklist) ? (checklist as string[]) : []).map(
                (step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card text-xs text-foreground"
                  >
                    <span
                      className={cn(
                        "size-5 rounded-full font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5",
                        BADGE.positive.bg,
                        PALETTE.positive.text,
                      )}
                    >
                      ✓
                    </span>
                    <span className="leading-snug">{step}</span>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Pro Tip */}
          <div
            className={cn(
              "p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed",
              BADGE.warning.border,
              BADGE.warning.bg,
            )}
          >
            <Lightbulb
              className={cn("h-4 w-4 shrink-0 mt-0.5", PALETTE.warning.text)}
            />
            <div>
              <span className={cn("font-bold mr-1", PALETTE.warning.text)}>
                {t("learn.strategies_ui.pro_tip")}
              </span>
              <span className="text-foreground/90 font-medium italic">
                "{t(`${strategyKey}.pro_tip`)}"
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
