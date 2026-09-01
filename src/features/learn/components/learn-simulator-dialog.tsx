import React, { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FilterGroup } from "@/components/shared/filter-group";
import { CandlestickSimulator } from "./candlestick-simulator";
import { ChartPatternSimulator } from "./chart-pattern-simulator";
import { Sparkles, SlidersHorizontal } from "lucide-react";

export type SimulatorMode = "candlestick" | "chart";

export interface LearnSimulatorDialogProps {
  defaultMode?: SimulatorMode;
  trigger?: ReactElement;
}

export const LearnSimulatorDialog: React.FC<LearnSimulatorDialogProps> = ({
  defaultMode = "candlestick",
  trigger,
}) => {
  const { t } = useTranslation();

  const [mode, setMode] = useState<SimulatorMode>(defaultMode);

  const modeOptions = [
    {
      value: "candlestick" as const,
      label: t("learn.simulator_dialog.modes.candlestick"),
    },
    {
      value: "chart" as const,
      label: t("learn.simulator_dialog.modes.chart"),
    },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button
            size="lg"
            className="font-bold transition-all text-xs cursor-pointer items-center gap-1.5 tracking-tight"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {t("learn.simulator_dialog.trigger")}
            </span>
            <span className="sm:hidden">
              {t("learn.simulator_dialog.trigger_short")}
            </span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl lg:max-w-6xl w-[96vw] max-h-[92vh] border border-border text-foreground flex flex-col gap-0 p-0 overflow-hidden shadow-2xl">
        {/* Dialog Header */}
        <DialogHeader className="shrink-0 bg-popover/90 backdrop-blur-md p-5 sm:p-6 pb-4 border-b border-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <DialogTitle className="text-lg font-bold uppercase tracking-tight text-foreground">
                  {t("learn.simulator_dialog.title")}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                {t("learn.simulator_dialog.description")}
              </DialogDescription>
            </div>

            {/* Mode Switcher */}
            <FilterGroup
              value={mode}
              options={modeOptions}
              onChange={(m) => setMode(m as SimulatorMode)}
              className="shrink-0"
            />
          </div>
        </DialogHeader>

        {/* Dialog Body (Scrollable) */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {mode === "candlestick" ? (
            <CandlestickSimulator isDialog />
          ) : (
            <ChartPatternSimulator isDialog />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
