import React, { useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { FilterGroup } from "@/components/shared/filter-group";
import { CandlestickSimulator } from "./candlestick-simulator";
import { ChartPatternSimulator } from "./chart-pattern-simulator";
import { SlidersHorizontal } from "lucide-react";

export type SimulatorMode = "candlestick" | "chart";

export interface LearnSimulatorDialogProps {
  defaultMode?: SimulatorMode;
}

export const LearnSimulatorDialog: React.FC<LearnSimulatorDialogProps> = ({
  defaultMode = "candlestick",
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
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] sm:w-[calc(100%-3rem)] sm:max-w-312 max-h-[85vh] border border-border text-foreground flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header styled identically to pattern detail dialog */}
        <DialogHeader className="shrink-0 bg-popover p-4 pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-6">
            <div className="space-y-0.5">
              <DialogTitle className="text-lg font-bold tracking-tight text-foreground uppercase">
                {t("learn.simulator_dialog.title")}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
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
          <Separator className="mt-4" />
        </DialogHeader>

        {/* Scrollable Content Body */}
        <div className="flex-1 min-h-0 flex flex-col space-y-6 p-4 overflow-y-auto">
          {mode === "candlestick" ? (
            <CandlestickSimulator />
          ) : (
            <ChartPatternSimulator />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
