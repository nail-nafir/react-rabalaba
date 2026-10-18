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
import { cn } from "@/lib/utils";
import { DashedGrid, PatternVisual } from "./pattern-visual";
import { PatternDetailDialog } from "./pattern-detail-dialog";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { BookOpen } from "lucide-react";
import {
  BIAS_COLORS,
  DIFFICULTY_COLORS,
  type CandlestickPattern,
  type ChartPattern,
} from "../types/learn";

interface PatternCardProps {
  pattern: CandlestickPattern | ChartPattern;
}

const COMPACT_SIGNAL_BADGE_CLASSNAME =
  "rounded-md text-[10px] font-bold uppercase tracking-wider";

export const PatternCard: React.FC<PatternCardProps> = ({ pattern }) => {
  const { t } = useTranslation();
  const patternParam = useDialogParam("pattern");

  const patternKey = `learn.patterns.${pattern.category.startsWith("candlestick") ? "candlestick" : "chart"}.${pattern.id}`;
  const colors = BIAS_COLORS[pattern.bias];
  const diffBadge = DIFFICULTY_COLORS[pattern.difficulty];

  return (
    <Card
      className="relative h-full flex flex-col cursor-pointer border border-border hover:bg-muted/50 hover:border-primary group"
      onClick={(e) => {
        // The card body opens the guide too; the button and the portaled dialog handle their own clicks.
        if (
          e.target instanceof Element &&
          e.currentTarget.contains(e.target) &&
          !e.target.closest("button")
        ) {
          patternParam.open(pattern.id);
        }
      }}
    >
      {/* Header */}
      <CardHeader className="space-y-4 flex flex-col w-full">
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
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
            <Badge
              variant="outline"
              className={cn(
                COMPACT_SIGNAL_BADGE_CLASSNAME,
                diffBadge.bg,
                diffBadge.text,
                diffBadge.border,
              )}
            >
              {t(`learn.common.difficulty.${pattern.difficulty}`)}
            </Badge>
          </div>
        </div>

        <div className="space-y-1.5 w-full">
          <CardTitle className="text-lg font-bold tracking-tight uppercase leading-7 line-clamp-2 min-h-14 group-hover:text-primary transition-colors">
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
      <CardContent className="flex-1 w-full flex flex-col items-center space-y-6 pb-0">
        {/* Inner Card Box */}
        <Card className="relative overflow-hidden w-full transition-all duration-300 select-none border shadow-none bg-muted/50 border-border hover:bg-muted/60">
          <DashedGrid className="opacity-30 px-2 py-4" />
          <CardContent className="relative z-10 flex flex-col items-center justify-center p-4 h-40">
            <PatternVisual type={pattern.svgType} className="w-full h-full" />
          </CardContent>
        </Card>
      </CardContent>

      {/* Footer */}
      <CardFooter>
        <PatternDetailDialog
          pattern={pattern}
          open={patternParam.value === pattern.id}
          onOpenChange={(next) =>
            next ? patternParam.open(pattern.id) : patternParam.close()
          }
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
