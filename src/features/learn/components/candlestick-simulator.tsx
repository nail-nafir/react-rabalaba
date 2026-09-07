import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterGroup } from "@/components/shared/filter-group";
import { BADGE, PALETTE } from "@/constants/taxonomy/palette";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface Preset {
  id: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

const PRESETS: Preset[] = [
  {
    id: "hammer",
    open: 40,
    high: 43,
    low: 10,
    close: 42,
  },
  {
    id: "shooting_star",
    open: 20,
    high: 50,
    low: 18,
    close: 19,
  },
  {
    id: "dragonfly",
    open: 45,
    high: 45,
    low: 12,
    close: 45,
  },
  {
    id: "bull_marubozu",
    open: 12,
    high: 48,
    low: 12,
    close: 48,
  },
  {
    id: "bear_marubozu",
    open: 48,
    high: 48,
    low: 12,
    close: 12,
  },
  {
    id: "spinning_top",
    open: 28,
    high: 46,
    low: 14,
    close: 32,
  },
  {
    id: "hanging_man",
    open: 38,
    high: 41,
    low: 8,
    close: 34,
  },
  {
    id: "inverted_hammer",
    open: 28,
    high: 50,
    low: 25,
    close: 30,
  },
  {
    id: "gravestone",
    open: 25,
    high: 50,
    low: 25,
    close: 25,
  },
  {
    id: "long_legged",
    open: 30,
    high: 50,
    low: 10,
    close: 30,
  },
];

interface CandlestickSimulatorProps {
  isDialog?: boolean;
  className?: string;
}

export const CandlestickSimulator: React.FC<CandlestickSimulatorProps> = ({
  isDialog = false,
  className,
}) => {
  const { t } = useTranslation();

  const [selectedPresetId, setSelectedPresetId] = useState<string>("hammer");
  const [open, setOpen] = useState(40);
  const [high, setHigh] = useState(43);
  const [low, setLow] = useState(10);
  const [close, setClose] = useState(42);

  const presetOptions = useMemo(
    () =>
      PRESETS.map((p) => ({
        value: p.id,
        label: t(`learn.candlestick_simulator.presets.${p.id}`),
      })),
    [t],
  );

  const handlePresetSelect = (id: string) => {
    setSelectedPresetId(id);
    const p = PRESETS.find((item) => item.id === id);
    if (p) {
      setOpen(p.open);
      setHigh(p.high);
      setLow(p.low);
      setClose(p.close);
    }
  };

  // Safe handler to ensure High >= Max(Open, Close) and Low <= Min(Open, Close)
  const handleOpenChange = (v: number) => {
    setOpen(v);
    if (v > high) setHigh(v);
    if (v < low) setLow(v);
  };

  const handleCloseChange = (v: number) => {
    setClose(v);
    if (v > high) setHigh(v);
    if (v < low) setLow(v);
  };

  const handleHighChange = (v: number) => {
    const maxBody = Math.max(open, close);
    setHigh(Math.max(v, maxBody));
  };

  const handleLowChange = (v: number) => {
    const minBody = Math.min(open, close);
    setLow(Math.min(v, minBody));
  };

  // Candle metrics computation
  const analysis = useMemo(() => {
    const isBullish = close > open;
    const isBearish = close < open;
    const isDoji = Math.abs(close - open) <= 1;

    const totalRange = Math.max(1, high - low);
    const bodyHeight = Math.abs(close - open);
    const upperShadow = high - Math.max(open, close);
    const lowerShadow = Math.min(open, close) - low;

    const bodyPercent = (bodyHeight / totalRange) * 100;
    const upperWickPercent = (upperShadow / totalRange) * 100;
    const lowerWickPercent = (lowerShadow / totalRange) * 100;

    // Pattern recognition heuristic
    let detectedKey = isBullish
      ? "bullish"
      : isBearish
        ? "bearish"
        : "neutral_doji";
    let bias: "positive" | "negative" | "neutral" | "warning" = isBullish
      ? "positive"
      : isBearish
        ? "negative"
        : "neutral";
    let psychologyKey = isBullish ? "bullish" : "bearish";

    if (bodyPercent <= 5) {
      if (lowerWickPercent > 65 && upperWickPercent < 10) {
        detectedKey = "dragonfly";
        bias = "positive";
        psychologyKey = "dragonfly";
      } else if (upperWickPercent > 65 && lowerWickPercent < 10) {
        detectedKey = "gravestone";
        bias = "negative";
        psychologyKey = "gravestone";
      } else {
        detectedKey = "long_legged";
        bias = "neutral";
        psychologyKey = "long_legged";
      }
    } else if (
      lowerShadow >= bodyHeight * 2 &&
      upperShadow <= bodyHeight * 0.4
    ) {
      detectedKey = isBullish ? "bullish_hammer" : "bearish_hammer";
      bias = isBullish ? "positive" : "warning";
      psychologyKey = "hammer";
    } else if (
      upperShadow >= bodyHeight * 2 &&
      lowerShadow <= bodyHeight * 0.4
    ) {
      detectedKey = "shooting_star";
      bias = "negative";
      psychologyKey = "shooting_star";
    } else if (bodyPercent >= 85) {
      detectedKey = isBullish ? "bullish_marubozu" : "bearish_marubozu";
      bias = isBullish ? "positive" : "negative";
      psychologyKey = "marubozu";
    } else if (
      upperWickPercent >= 30 &&
      lowerWickPercent >= 30 &&
      bodyPercent < 40
    ) {
      detectedKey = "spinning_top";
      bias = "warning";
      psychologyKey = "spinning_top";
    }

    return {
      isBullish,
      isBearish,
      isDoji,
      bodyHeight,
      upperShadow,
      lowerShadow,
      totalRange,
      bodyPercent,
      upperWickPercent,
      lowerWickPercent,
      detectedKey,
      bias,
      psychologyKey,
    };
  }, [open, high, low, close]);

  // SVG Scaling parameters
  const mapY = (val: number) => 195 - (val / 50) * 170;

  const yHigh = mapY(high);
  const yLow = mapY(low);
  const yOpen = mapY(open);
  const yClose = mapY(close);
  const yBodyTop = Math.min(yOpen, yClose);
  const yBodyBottom = Math.max(yOpen, yClose);
  const bodyHeightPx = Math.max(2, yBodyBottom - yBodyTop);

  const candleColor = analysis.isBullish
    ? PALETTE.positive.fill
    : analysis.isBearish
      ? PALETTE.negative.fill
      : PALETTE.neutral.fill;
  const muted = PALETTE.neutral.fill;

  const content = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Visual SVG Candle Renderer */}
        <Card className="lg:col-span-5 h-full relative border border-border bg-muted/50 flex flex-col items-center justify-between p-4 overflow-hidden">
          {/* Header with Preset Selector */}
          {isDialog && (
            <div className="relative z-10 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground truncate">
                {t("learn.candlestick_simulator.select_preset")}
              </span>
              <FilterGroup
                value={selectedPresetId}
                options={presetOptions}
                onChange={handlePresetSelect}
                variant="select"
                className="w-full sm:w-48 shrink-0"
              />
            </div>
          )}

          {/* Standard dashed technical grid lines */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-40 flex flex-col justify-around px-4 py-8"
          >
            <div className="border-b border-dashed border-muted-foreground/30 w-full" />
            <div className="border-b border-dashed border-muted-foreground/30 w-full" />
            <div className="border-b border-dashed border-muted-foreground/30 w-full" />
          </div>

          <div className="relative z-10 flex-1 w-full flex items-center justify-center min-h-55">
            <svg viewBox="0 0 320 220" className="w-full h-full max-w-85">
              {/* Reference levels */}
              <line
                x1="65"
                y1={yHigh}
                x2="255"
                y2={yHigh}
                stroke={muted}
                strokeOpacity="0.1"
                strokeDasharray="3 3"
              />
              <text
                x="260"
                y={yHigh + 3}
                fill={muted}
                fontSize="8"
                fontWeight="bold"
                textAnchor="start"
              >
                {t("learn.visual.high_value", { value: high })}
              </text>

              <line
                x1="65"
                y1={yOpen}
                x2="255"
                y2={yOpen}
                stroke={muted}
                strokeOpacity="0.1"
                strokeDasharray="3 3"
              />
              <text
                x="60"
                y={yOpen + 3}
                fill={muted}
                fontSize="8"
                fontWeight="bold"
                textAnchor="end"
              >
                {t("learn.visual.open_value", { value: open })}
              </text>

              <line
                x1="65"
                y1={yClose}
                x2="255"
                y2={yClose}
                stroke={muted}
                strokeOpacity="0.1"
                strokeDasharray="3 3"
              />
              <text
                x="60"
                y={yClose + 3}
                fill={candleColor}
                fontSize="8"
                fontWeight="bold"
                textAnchor="end"
              >
                {t("learn.visual.close_value", { value: close })}
              </text>

              <line
                x1="65"
                y1={yLow}
                x2="255"
                y2={yLow}
                stroke={muted}
                strokeOpacity="0.1"
                strokeDasharray="3 3"
              />
              <text
                x="260"
                y={yLow + 3}
                fill={muted}
                fontSize="8"
                fontWeight="bold"
                textAnchor="start"
              >
                {t("learn.visual.low_value", { value: low })}
              </text>

              {/* Candle Wick (Line) */}
              <line
                x1="160"
                y1={yHigh}
                x2="160"
                y2={yLow}
                stroke={candleColor}
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* Candle Real Body */}
              <rect
                x="136"
                y={yBodyTop}
                width="48"
                height={bodyHeightPx}
                fill={candleColor}
                stroke={candleColor}
                strokeWidth="1.5"
                rx="3"
              />

              {/* Anatomy Callouts */}
              {analysis.upperShadow > 1 && (
                <text
                  x="172"
                  y={(yHigh + yBodyTop) / 2 + 3}
                  fill={muted}
                  fontSize="7"
                  fontStyle="italic"
                  textAnchor="start"
                >
                  {t("learn.visual.upper_wick_value", {
                    value: analysis.upperShadow,
                  })}
                </text>
              )}
              <text
                x="160"
                y={yBodyTop + bodyHeightPx / 2 + 3}
                fill="currentColor"
                fontSize="9"
                fontWeight="black"
                textAnchor="middle"
              >
                {analysis.bodyHeight}
              </text>
              {analysis.lowerShadow > 1 && (
                <text
                  x="172"
                  y={(yLow + yBodyBottom) / 2 + 3}
                  fill={muted}
                  fontSize="7"
                  fontStyle="italic"
                  textAnchor="start"
                >
                  {t("learn.visual.lower_wick_value", {
                    value: analysis.lowerShadow,
                  })}
                </text>
              )}
            </svg>
          </div>

          {/* Pattern Badge banner */}
          <div className="relative z-10 mt-3 flex flex-col items-center gap-1.5 w-full text-center">
            {(() => {
              const colors =
                analysis.bias === "positive"
                  ? BADGE.positive
                  : analysis.bias === "negative"
                    ? BADGE.negative
                    : BADGE.warning;

              return (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-md whitespace-nowrap",
                    colors.bg,
                    colors.text,
                    colors.border,
                  )}
                >
                  {t(
                    `learn.candlestick_simulator.detected.${analysis.detectedKey}`,
                  )}
                </Badge>
              );
            })()}
            <p className="text-[11px] text-muted-foreground max-w-xs italic min-h-9 sm:min-h-8 flex items-center justify-center text-center">
              "
              {t(
                `learn.candlestick_simulator.psychology.${analysis.psychologyKey}`,
              )}
              "
            </p>
          </div>
        </Card>

        {/* Right Column: Sliders & Metrics Breakdown */}
        <div className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border border-border bg-muted/50">
              <CardContent className="space-y-1">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {t("learn.candlestick_simulator.metrics.body")}
                </CardTitle>
                <div className="text-lg font-bold text-foreground">
                  {analysis.bodyPercent.toFixed(1)}%
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {t("learn.candlestick_simulator.metrics.spread", {
                    count: analysis.bodyHeight,
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border bg-muted/50">
              <CardContent className="space-y-1">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {t("learn.candlestick_simulator.metrics.upper_wick")}
                </CardTitle>
                <div className="text-lg font-bold text-foreground">
                  {analysis.upperWickPercent.toFixed(1)}%
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {t("learn.candlestick_simulator.metrics.selling_rejection")}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border bg-muted/50">
              <CardContent className="space-y-1">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {t("learn.candlestick_simulator.metrics.lower_wick")}
                </CardTitle>
                <div className="text-lg font-bold text-foreground">
                  {analysis.lowerWickPercent.toFixed(1)}%
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {t("learn.candlestick_simulator.metrics.buying_support")}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border bg-muted/50">
              <CardContent className="space-y-1">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {t("learn.candlestick_simulator.metrics.total_range")}
                </CardTitle>
                <div className="text-lg font-bold text-foreground">
                  {analysis.totalRange}{" "}
                  {t("learn.candlestick_simulator.points_unit")}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {t("learn.candlestick_simulator.metrics.range_calculation", {
                    high,
                    low,
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Sliders */}
          <Card className="p-4 border border-border bg-muted/50 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                {t("learn.candlestick_simulator.controls")}
              </h3>
              <span className="text-[11px] text-muted-foreground">
                {t("learn.candlestick_simulator.controls_hint")}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Open Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-foreground font-semibold">
                    {t("learn.candlestick_simulator.open")}
                  </span>
                  <span className="text-xs font-bold text-primary">{open}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={open}
                  onChange={(e) => handleOpenChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>1</span>
                  <span>50</span>
                </div>
              </div>

              {/* Close Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-foreground font-semibold">
                    {t("learn.candlestick_simulator.close")}
                  </span>
                  <span className="text-xs font-bold text-primary">
                    {close}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={close}
                  onChange={(e) => handleCloseChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>1</span>
                  <span>50</span>
                </div>
              </div>

              {/* High Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-foreground font-semibold">
                    {t("learn.candlestick_simulator.high")}
                  </span>
                  <span className="text-xs font-bold text-primary">{high}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={high}
                  onChange={(e) => handleHighChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>1</span>
                  <span>50</span>
                </div>
              </div>

              {/* Low Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-foreground font-semibold">
                    {t("learn.candlestick_simulator.low")}
                  </span>
                  <span className="text-xs font-bold text-primary">{low}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={low}
                  onChange={(e) => handleLowChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>1</span>
                  <span>50</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Pro Tip Callout */}
          <Card className="border border-border bg-muted/50">
            <CardContent className="space-y-1">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                {t("learn.candlestick_simulator.golden_rule")}
              </CardTitle>
              <p className="text-xs text-muted-foreground leading-relaxed min-h-10 flex items-center">
                {t("learn.candlestick_simulator.golden_rule_description")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  if (isDialog) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Card className={cn("border border-border", className)}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-lg font-bold uppercase tracking-tight text-foreground">
                {t("learn.candlestick_simulator.title")}
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              {t("learn.candlestick_simulator.description")}
            </CardDescription>
          </div>

          <FilterGroup
            value={selectedPresetId}
            options={presetOptions}
            onChange={handlePresetSelect}
            variant="select"
            className="w-full sm:w-64"
          />
        </div>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
};
