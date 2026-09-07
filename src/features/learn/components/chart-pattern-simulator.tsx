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
import { LineChart } from "lucide-react";

interface ChartPatternPreset {
  id: string;
  bias: "bullish" | "bearish";
  defaultHeight: number;
  defaultNeckline: number;
}

const PRESETS: ChartPatternPreset[] = [
  {
    id: "head_and_shoulders",
    bias: "bearish",
    defaultHeight: 25,
    defaultNeckline: 100,
  },
  {
    id: "inverse_head_and_shoulders",
    bias: "bullish",
    defaultHeight: 25,
    defaultNeckline: 100,
  },
  {
    id: "double_top",
    bias: "bearish",
    defaultHeight: 20,
    defaultNeckline: 100,
  },
  {
    id: "double_bottom",
    bias: "bullish",
    defaultHeight: 20,
    defaultNeckline: 100,
  },
  {
    id: "bull_flag",
    bias: "bullish",
    defaultHeight: 30,
    defaultNeckline: 100,
  },
  {
    id: "ascending_triangle",
    bias: "bullish",
    defaultHeight: 22,
    defaultNeckline: 100,
  },
  {
    id: "bear_flag",
    bias: "bearish",
    defaultHeight: 30,
    defaultNeckline: 100,
  },
  {
    id: "bull_pennant",
    bias: "bullish",
    defaultHeight: 26,
    defaultNeckline: 100,
  },
  {
    id: "bear_pennant",
    bias: "bearish",
    defaultHeight: 26,
    defaultNeckline: 100,
  },
  {
    id: "descending_triangle",
    bias: "bearish",
    defaultHeight: 22,
    defaultNeckline: 100,
  },
  {
    id: "falling_wedge",
    bias: "bullish",
    defaultHeight: 24,
    defaultNeckline: 100,
  },
  {
    id: "rising_wedge",
    bias: "bearish",
    defaultHeight: 24,
    defaultNeckline: 100,
  },
  {
    id: "triple_top",
    bias: "bearish",
    defaultHeight: 20,
    defaultNeckline: 100,
  },
  {
    id: "triple_bottom",
    bias: "bullish",
    defaultHeight: 20,
    defaultNeckline: 100,
  },
  {
    id: "cup_and_handle",
    bias: "bullish",
    defaultHeight: 24,
    defaultNeckline: 100,
  },
  {
    id: "inverse_cup_and_handle",
    bias: "bearish",
    defaultHeight: 24,
    defaultNeckline: 100,
  },
];

interface ChartPatternSimulatorProps {
  isDialog?: boolean;
  className?: string;
}

export const ChartPatternSimulator: React.FC<ChartPatternSimulatorProps> = ({
  isDialog = false,
  className,
}) => {
  const { t } = useTranslation();
  const green = PALETTE.positive.fill;
  const red = PALETTE.negative.fill;
  const warning = PALETTE.warning.fill;
  const muted = PALETTE.neutral.fill;

  const [selectedPresetId, setSelectedPresetId] =
    useState<string>("head_and_shoulders");
  const [patternHeight, setPatternHeight] = useState<number>(25);
  const [necklinePrice, setNecklinePrice] = useState<number>(100);
  const [volumeMult, setVolumeMult] = useState<number>(2.0);
  const [entryMode, setEntryMode] = useState<"breakout" | "retest">("retest");

  const currentPreset = useMemo(() => {
    return PRESETS.find((p) => p.id === selectedPresetId) || PRESETS[0];
  }, [selectedPresetId]);

  const presetOptions = useMemo(() => {
    return PRESETS.map((p) => ({
      value: p.id,
      label: t(`learn.chart_simulator.presets.${p.id}.name`),
    }));
  }, [t]);

  const handlePresetSelect = (id: string) => {
    setSelectedPresetId(id);
    const p = PRESETS.find((item) => item.id === id);
    if (p) {
      setPatternHeight(p.defaultHeight);
      setNecklinePrice(p.defaultNeckline);
    }
  };

  // Live Math calculations
  const stats = useMemo(() => {
    const isBull = currentPreset.bias === "bullish";
    const isBear = currentPreset.bias === "bearish";

    const targetPrice = isBull
      ? necklinePrice + patternHeight
      : necklinePrice - patternHeight;

    let entryPrice: number;
    let stopLossPrice: number;

    if (isBull) {
      if (entryMode === "breakout") {
        entryPrice = necklinePrice + patternHeight * 0.08;
        stopLossPrice = necklinePrice - patternHeight * 0.35;
      } else {
        // Retest
        entryPrice = necklinePrice + patternHeight * 0.02;
        stopLossPrice = necklinePrice - patternHeight * 0.2;
      }
    } else {
      if (entryMode === "breakout") {
        entryPrice = necklinePrice - patternHeight * 0.08;
        stopLossPrice = necklinePrice + patternHeight * 0.35;
      } else {
        // Retest
        entryPrice = necklinePrice - patternHeight * 0.02;
        stopLossPrice = necklinePrice + patternHeight * 0.2;
      }
    }

    const riskDistance = Math.abs(entryPrice - stopLossPrice);
    const rewardDistance = Math.abs(targetPrice - entryPrice);
    const riskRewardRatio =
      riskDistance > 0 ? rewardDistance / riskDistance : 0;
    const targetPercent =
      necklinePrice > 0 ? (patternHeight / necklinePrice) * 100 : 0;
    const stopPercent =
      necklinePrice > 0 ? (riskDistance / necklinePrice) * 100 : 0;

    // Volume trap validation
    let volumeKey = "strong";
    let volumeBadge = BADGE.positive;
    if (volumeMult < 1.0) {
      volumeKey = "weak";
      volumeBadge = BADGE.negative;
    } else if (volumeMult < 1.8) {
      volumeKey = "moderate";
      volumeBadge = BADGE.warning;
    }

    return {
      isBull,
      isBear,
      targetPrice,
      entryPrice,
      stopLossPrice,
      riskDistance,
      rewardDistance,
      riskRewardRatio,
      targetPercent,
      stopPercent,
      volumeKey,
      volumeBadge,
    };
  }, [currentPreset, patternHeight, necklinePrice, volumeMult, entryMode]);

  // Dynamic SVG Coordinate Scaling based on patternHeight & necklinePrice
  const svgMetrics = useMemo(() => {
    // Normalizing height into visual pixel scale (10 to 50 pts -> 18 to 68 px)
    const hPx = 18 + ((patternHeight - 10) / 40) * 50;

    // Baseline Neckline Y based on necklinePrice (50 to 200 -> Y between 120 and 80)
    const baseNecklineY = stats.isBull
      ? 80 + ((100 - Math.min(150, Math.max(70, necklinePrice))) / 80) * 20
      : 115 + ((100 - Math.min(150, Math.max(70, necklinePrice))) / 80) * 20;

    return {
      hPx,
      baseNecklineY,
    };
  }, [patternHeight, necklinePrice, stats.isBull]);

  const content = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Live Geometry Canvas (SVG) */}
        <Card className="lg:col-span-5 h-full relative border border-border bg-muted/50 flex flex-col items-center justify-between p-4 overflow-hidden">
          {/* Header with Preset Selector */}
          {isDialog && (
            <div className="relative z-10 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground truncate">
                {t("learn.chart_simulator.select_preset")}
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
            <svg viewBox="0 -10 320 220" className="w-full h-full max-w-85">
              {/* 1. HEAD & SHOULDERS */}
              {selectedPresetId === "head_and_shoulders" &&
                (() => {
                  const yNeckline = svgMetrics.baseNecklineY;
                  const yHead = Math.max(15, yNeckline - svgMetrics.hPx * 1.25);
                  const yShoulder = Math.max(
                    30,
                    yNeckline - svgMetrics.hPx * 0.65,
                  );
                  const yTP = Math.min(188, yNeckline + svgMetrics.hPx);

                  return (
                    <g>
                      {/* Neckline Level */}
                      <line
                        x1="20"
                        y1={yNeckline}
                        x2="260"
                        y2={yNeckline}
                        stroke={warning}
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <text
                        x="25"
                        y={yNeckline - 6}
                        fill={warning}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        {t("learn.visual.neckline_price", {
                          price: necklinePrice,
                        })}
                      </text>

                      {/* Measured Height Projection Lines */}
                      <line
                        x1="140"
                        y1={yHead}
                        x2="140"
                        y2={yNeckline}
                        stroke={muted}
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <line
                        x1="225"
                        y1={yNeckline}
                        x2="225"
                        y2={yTP}
                        stroke={muted}
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <text
                        x="145"
                        y={(yHead + yNeckline) / 2 + 3}
                        fill={muted}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        H ({patternHeight})
                      </text>
                      <text
                        x="230"
                        y={(yNeckline + yTP) / 2 + 3}
                        fill={muted}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        -H (${patternHeight})
                      </text>

                      {/* Dynamic Price Path */}
                      <path
                        d={`M 30,${yNeckline + 15} L 60,${yShoulder} L 95,${yNeckline} L 140,${yHead} L 180,${yNeckline} L 210,${yShoulder} L 225,${yNeckline} L 245,${yTP}`}
                        fill="none"
                        stroke={red}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Anatomy Labels */}
                      <text
                        x="60"
                        y={yShoulder - 6}
                        fill={muted}
                        fontSize="7"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {t("learn.visual.left_shoulder")}
                      </text>
                      <text
                        x="140"
                        y={yHead - 6}
                        fill={red}
                        fontSize="9"
                        fontWeight="black"
                        textAnchor="middle"
                      >
                        {t("learn.visual.head")}
                      </text>
                      <text
                        x="210"
                        y={yShoulder - 6}
                        fill={muted}
                        fontSize="7"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {t("learn.visual.right_shoulder")}
                      </text>

                      {/* Target TP Marker */}
                      <circle cx="245" cy={yTP} r="4" fill={red} />
                      <text
                        x="252"
                        y={yTP + 3}
                        fill={red}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        {t("learn.visual.target_price", {
                          price: stats.targetPrice.toFixed(0),
                        })}
                      </text>
                    </g>
                  );
                })()}

              {/* 2. INVERSE HEAD & SHOULDERS */}
              {selectedPresetId === "inverse_head_and_shoulders" &&
                (() => {
                  const yNeckline = svgMetrics.baseNecklineY;
                  const yHead = Math.min(
                    185,
                    yNeckline + svgMetrics.hPx * 1.25,
                  );
                  const yShoulder = Math.min(
                    165,
                    yNeckline + svgMetrics.hPx * 0.65,
                  );
                  const yTP = Math.max(15, yNeckline - svgMetrics.hPx);

                  return (
                    <g>
                      {/* Neckline Level */}
                      <line
                        x1="20"
                        y1={yNeckline}
                        x2="260"
                        y2={yNeckline}
                        stroke={warning}
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <text
                        x="25"
                        y={yNeckline - 6}
                        fill={warning}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        {t("learn.visual.neckline_price", {
                          price: necklinePrice,
                        })}
                      </text>

                      {/* Height & Projections */}
                      <line
                        x1="140"
                        y1={yNeckline}
                        x2="140"
                        y2={yHead}
                        stroke={muted}
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <line
                        x1="225"
                        y1={yTP}
                        x2="225"
                        y2={yNeckline}
                        stroke={muted}
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <text
                        x="145"
                        y={(yNeckline + yHead) / 2 + 3}
                        fill={muted}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        H ({patternHeight})
                      </text>
                      <text
                        x="230"
                        y={(yNeckline + yTP) / 2 + 3}
                        fill={muted}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        +H (${patternHeight})
                      </text>

                      {/* Price Path */}
                      <path
                        d={`M 30,${yNeckline - 15} L 60,${yShoulder} L 95,${yNeckline} L 140,${yHead} L 180,${yNeckline} L 210,${yShoulder} L 225,${yNeckline} L 245,${yTP}`}
                        fill="none"
                        stroke={green}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Anatomy Labels */}
                      <text
                        x="60"
                        y={yShoulder + 12}
                        fill={muted}
                        fontSize="7"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {t("learn.visual.left_shoulder")}
                      </text>
                      <text
                        x="140"
                        y={yHead + 14}
                        fill={green}
                        fontSize="9"
                        fontWeight="black"
                        textAnchor="middle"
                      >
                        {t("learn.visual.head")}
                      </text>
                      <text
                        x="210"
                        y={yShoulder + 12}
                        fill={muted}
                        fontSize="7"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {t("learn.visual.right_shoulder")}
                      </text>

                      {/* Target TP Marker */}
                      <circle cx="245" cy={yTP} r="4" fill={green} />
                      <text
                        x="252"
                        y={yTP + 3}
                        fill={green}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        {t("learn.visual.target_price", {
                          price: stats.targetPrice.toFixed(0),
                        })}
                      </text>
                    </g>
                  );
                })()}

              {/* 3. DOUBLE TOP ("M") */}
              {selectedPresetId === "double_top" &&
                (() => {
                  const yNeckline = svgMetrics.baseNecklineY;
                  const yPeak = Math.max(20, yNeckline - svgMetrics.hPx);
                  const yTP = Math.min(188, yNeckline + svgMetrics.hPx);

                  return (
                    <g>
                      {/* Neckline Level */}
                      <line
                        x1="20"
                        y1={yNeckline}
                        x2="260"
                        y2={yNeckline}
                        stroke={warning}
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <text
                        x="25"
                        y={yNeckline - 6}
                        fill={warning}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        {t("learn.visual.neckline_price", {
                          price: necklinePrice,
                        })}
                      </text>

                      {/* Height & Projections */}
                      <line
                        x1="135"
                        y1={yPeak}
                        x2="135"
                        y2={yNeckline}
                        stroke={muted}
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <line
                        x1="225"
                        y1={yNeckline}
                        x2="225"
                        y2={yTP}
                        stroke={muted}
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <text
                        x="140"
                        y={(yPeak + yNeckline) / 2 + 3}
                        fill={muted}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        H ({patternHeight})
                      </text>
                      <text
                        x="230"
                        y={(yNeckline + yTP) / 2 + 3}
                        fill={muted}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        -H (${patternHeight})
                      </text>

                      {/* Path */}
                      <path
                        d={`M 30,${yNeckline + 15} L 75,${yPeak} L 135,${yNeckline} L 195,${yPeak} L 225,${yNeckline} L 250,${yTP}`}
                        fill="none"
                        stroke={red}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      <text
                        x="75"
                        y={yPeak - 6}
                        fill={red}
                        fontSize="8"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {t("learn.visual.peak_1")}
                      </text>
                      <text
                        x="195"
                        y={yPeak - 6}
                        fill={red}
                        fontSize="8"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {t("learn.visual.peak_2")}
                      </text>

                      <circle cx="250" cy={yTP} r="4" fill={red} />
                      <text
                        x="252"
                        y={yTP + 3}
                        fill={red}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        {t("learn.visual.target_price", {
                          price: stats.targetPrice.toFixed(0),
                        })}
                      </text>
                    </g>
                  );
                })()}

              {/* 4. DOUBLE BOTTOM ("W") */}
              {selectedPresetId === "double_bottom" &&
                (() => {
                  const yNeckline = svgMetrics.baseNecklineY;
                  const yTrough = Math.min(180, yNeckline + svgMetrics.hPx);
                  const yTP = Math.max(15, yNeckline - svgMetrics.hPx);

                  return (
                    <g>
                      {/* Neckline Level */}
                      <line
                        x1="20"
                        y1={yNeckline}
                        x2="260"
                        y2={yNeckline}
                        stroke={warning}
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <text
                        x="25"
                        y={yNeckline - 6}
                        fill={warning}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        {t("learn.visual.neckline_price", {
                          price: necklinePrice,
                        })}
                      </text>

                      {/* Height & Projections */}
                      <line
                        x1="135"
                        y1={yNeckline}
                        x2="135"
                        y2={yTrough}
                        stroke={muted}
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <line
                        x1="225"
                        y1={yTP}
                        x2="225"
                        y2={yNeckline}
                        stroke={muted}
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <text
                        x="140"
                        y={(yNeckline + yTrough) / 2 + 3}
                        fill={muted}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        H ({patternHeight})
                      </text>
                      <text
                        x="230"
                        y={(yNeckline + yTP) / 2 + 3}
                        fill={muted}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        +H (${patternHeight})
                      </text>

                      {/* Path */}
                      <path
                        d={`M 30,${yNeckline - 15} L 75,${yTrough} L 135,${yNeckline} L 195,${yTrough} L 225,${yNeckline} L 250,${yTP}`}
                        fill="none"
                        stroke={green}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      <text
                        x="75"
                        y={yTrough + 14}
                        fill={green}
                        fontSize="8"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {t("learn.visual.bottom_1")}
                      </text>
                      <text
                        x="195"
                        y={yTrough + 14}
                        fill={green}
                        fontSize="8"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {t("learn.visual.bottom_2")}
                      </text>

                      <circle cx="250" cy={yTP} r="4" fill={green} />
                      <text
                        x="252"
                        y={yTP + 3}
                        fill={green}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        {t("learn.visual.target_price", {
                          price: stats.targetPrice.toFixed(0),
                        })}
                      </text>
                    </g>
                  );
                })()}

              {/* 5. BULL FLAG */}
              {selectedPresetId === "bull_flag" &&
                (() => {
                  const yPoleBase = Math.min(185, 105 + svgMetrics.hPx * 0.7);
                  const yPoleTop = Math.max(25, 105 - svgMetrics.hPx * 0.7);
                  const flagDepth = Math.max(18, svgMetrics.hPx * 0.45);
                  const yTP = Math.max(15, yPoleTop - svgMetrics.hPx * 0.65);

                  return (
                    <g>
                      {/* Flagpole */}
                      <line
                        x1="40"
                        y1={yPoleBase}
                        x2="95"
                        y2={yPoleTop}
                        stroke={green}
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                      <text
                        x="50"
                        y={(yPoleBase + yPoleTop) / 2}
                        fill={green}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        {t("learn.visual.pole_height")}
                      </text>

                      {/* Flag Channel Lines */}
                      <line
                        x1="90"
                        y1={yPoleTop}
                        x2="175"
                        y2={yPoleTop + 30}
                        stroke={warning}
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />
                      <line
                        x1="90"
                        y1={yPoleTop + flagDepth}
                        x2="175"
                        y2={yPoleTop + flagDepth + 30}
                        stroke={warning}
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />

                      {/* Zigzag in Flag & Breakout */}
                      <path
                        d={`M 95,${yPoleTop} L 115,${yPoleTop + flagDepth + 8} L 135,${yPoleTop + 15} L 155,${yPoleTop + flagDepth + 23} L 175,${yPoleTop + 30} L 245,${yTP}`}
                        fill="none"
                        stroke={green}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      <line
                        x1="220"
                        y1={yPoleTop + 20}
                        x2="220"
                        y2={yTP}
                        stroke={muted}
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <text
                        x="225"
                        y={(yPoleTop + 20 + yTP) / 2}
                        fill={muted}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        +H
                      </text>

                      <circle cx="245" cy={yTP} r="4" fill={green} />
                      <text
                        x="248"
                        y={yTP + 3}
                        fill={green}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        {t("learn.visual.target_price", {
                          price: stats.targetPrice.toFixed(0),
                        })}
                      </text>
                    </g>
                  );
                })()}

              {/* 6. ASCENDING TRIANGLE */}
              {selectedPresetId === "ascending_triangle" &&
                (() => {
                  const yResistance = 65;
                  const yBase = Math.min(
                    185,
                    yResistance + svgMetrics.hPx * 1.3,
                  );
                  const yTP = Math.max(15, yResistance - svgMetrics.hPx * 0.9);

                  return (
                    <g>
                      {/* Flat Upper Resistance */}
                      <line
                        x1="30"
                        y1={yResistance}
                        x2="255"
                        y2={yResistance}
                        stroke={red}
                        strokeWidth="2"
                        strokeDasharray="3 3"
                      />
                      <text
                        x="35"
                        y={yResistance - 6}
                        fill={red}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        {t("learn.visual.resistance_price", {
                          price: necklinePrice,
                        })}
                      </text>

                      {/* Ascending Trendline */}
                      <line
                        x1="30"
                        y1={yBase}
                        x2="200"
                        y2={yResistance}
                        stroke={green}
                        strokeWidth="2"
                      />

                      {/* Height & Projections */}
                      <line
                        x1="45"
                        y1={yResistance}
                        x2="45"
                        y2={yBase - 10}
                        stroke={muted}
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <line
                        x1="225"
                        y1={yTP}
                        x2="225"
                        y2={yResistance}
                        stroke={muted}
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <text
                        x="50"
                        y={(yResistance + yBase) / 2}
                        fill={muted}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        H ({patternHeight})
                      </text>
                      <text
                        x="230"
                        y={(yResistance + yTP) / 2 + 3}
                        fill={muted}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        +H (${patternHeight})
                      </text>

                      {/* Waves */}
                      <path
                        d={`M 40,${yBase - 10} L 75,${yResistance} L 115,${yResistance + (yBase - yResistance) * 0.6} L 150,${yResistance} L 180,${yResistance + (yBase - yResistance) * 0.25} L 205,${yResistance} L 245,${yTP}`}
                        fill="none"
                        stroke={green}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      <circle cx="245" cy={yTP} r="4" fill={green} />
                      <text
                        x="248"
                        y={yTP + 3}
                        fill={green}
                        fontSize="8"
                        fontWeight="bold"
                      >
                        {t("learn.visual.target_price", {
                          price: stats.targetPrice.toFixed(0),
                        })}
                      </text>
                    </g>
                  );
                })()}

              {selectedPresetId === "bear_flag" && (
                <g>
                  <path d="M 30 35 L 75 110" fill="none" stroke={red} strokeWidth="2.5" />
                  <path d="M 75 110 L 140 75 L 205 105" fill="none" stroke={red} strokeWidth="2" />
                  <line x1="75" y1="95" x2="205" y2="130" stroke={warning} strokeWidth="1.5" strokeDasharray="3 3" />
                  <path d="M 205 105 L 245 130" fill="none" stroke={red} strokeWidth="2.5" />
                  <circle cx="245" cy="130" r="4" fill={red} />
                  <text x="198" y="52" fill={red} fontSize="8" fontWeight="bold">{t("learn.visual.breakout")}</text>
                </g>
              )}

              {(selectedPresetId === "bull_pennant" || selectedPresetId === "bear_pennant") && (
                <g>
                  <path
                    d={selectedPresetId === "bull_pennant" ? "M 25 120 L 80 35" : "M 25 25 L 80 115"}
                    fill="none"
                    stroke={selectedPresetId === "bull_pennant" ? green : red}
                    strokeWidth="2.5"
                  />
                  <path d="M 80 35 L 175 70 L 80 115 Z" fill="none" stroke={warning} strokeWidth="1.5" />
                  <path d={selectedPresetId === "bull_pennant" ? "M 175 70 L 245 30" : "M 175 70 L 245 115"} fill="none" stroke={selectedPresetId === "bull_pennant" ? green : red} strokeWidth="2.5" />
                  <circle cx="245" cy={selectedPresetId === "bull_pennant" ? 30 : 115} r="4" fill={selectedPresetId === "bull_pennant" ? green : red} />
                </g>
              )}

              {selectedPresetId === "descending_triangle" && (
                <g>
                  <line x1="30" y1="110" x2="220" y2="110" stroke={green} strokeWidth="2" strokeDasharray="3 3" />
                  <line x1="30" y1="35" x2="220" y2="92" stroke={red} strokeWidth="2" />
                  <path d="M 40 45 L 75 110 L 110 66 L 145 110 L 180 86 L 220 110 L 245 135" fill="none" stroke={red} strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="245" cy="135" r="4" fill={red} />
                  <text x="35" y="125" fill={green} fontSize="8" fontWeight="bold">{t("learn.visual.flat_support")}</text>
                </g>
              )}

              {(selectedPresetId === "falling_wedge" || selectedPresetId === "rising_wedge") && (
                <g>
                  <line
                    x1="35"
                    y1={selectedPresetId === "falling_wedge" ? 35 : 105}
                    x2="205"
                    y2={selectedPresetId === "falling_wedge" ? 85 : 55}
                    stroke={warning}
                    strokeWidth="2"
                  />
                  <line
                    x1="35"
                    y1={selectedPresetId === "falling_wedge" ? 75 : 135}
                    x2="205"
                    y2={selectedPresetId === "falling_wedge" ? 105 : 85}
                    stroke={warning}
                    strokeWidth="2"
                  />
                  <path
                    d={selectedPresetId === "falling_wedge" ? "M 40 40 L 70 82 L 100 55 L 130 98 L 160 76 L 185 102 L 245 30" : "M 40 105 L 70 65 L 100 92 L 130 52 L 160 76 L 185 48 L 245 120"}
                    fill="none"
                    stroke={selectedPresetId === "falling_wedge" ? green : red}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="245" cy={selectedPresetId === "falling_wedge" ? 30 : 120} r="4" fill={selectedPresetId === "falling_wedge" ? green : red} />
                </g>
              )}

              {(selectedPresetId === "triple_top" || selectedPresetId === "triple_bottom") && (
                <g>
                  <line x1="30" y1="105" x2="220" y2="105" stroke={warning} strokeWidth="1.5" strokeDasharray="3 3" />
                  <path
                    d={selectedPresetId === "triple_top" ? "M 30 120 L 65 45 L 100 105 L 135 48 L 170 105 L 205 48 L 245 135" : "M 30 25 L 65 105 L 100 45 L 135 105 L 170 48 L 205 105 L 245 15"}
                    fill="none"
                    stroke={selectedPresetId === "triple_top" ? red : green}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="245" cy={selectedPresetId === "triple_top" ? 135 : 15} r="4" fill={selectedPresetId === "triple_top" ? red : green} />
                </g>
              )}

              {(selectedPresetId === "cup_and_handle" ||
                selectedPresetId === "inverse_cup_and_handle") &&
                (() => {
                  const isInverse = selectedPresetId === "inverse_cup_and_handle";
                  return (
                    <g>
                      <path
                        d={isInverse
                          ? "M 25 100 L 55 98 Q 105 15 165 98 L 190 95"
                          : "M 25 40 L 55 42 Q 105 125 165 42 L 190 45"}
                        fill="none"
                        stroke={isInverse ? red : green}
                        strokeWidth="2.5"
                      />
                      <path
                        d={isInverse
                          ? "M 165 98 Q 190 60 215 75 L 230 62"
                          : "M 165 42 Q 190 80 215 65 L 230 78"}
                        fill="none"
                        stroke={warning}
                        strokeWidth="2"
                      />
                      <line
                        x1="25"
                        y1={isInverse ? 100 : 40}
                        x2="190"
                        y2={isInverse ? 100 : 40}
                        stroke={isInverse ? green : red}
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />
                      <path
                        d={isInverse ? "M 230 62 L 250 120" : "M 230 78 L 250 20"}
                        fill="none"
                        stroke={isInverse ? red : green}
                        strokeWidth="2.5"
                      />
                      <circle
                        cx="250"
                        cy={isInverse ? 120 : 20}
                        r="4"
                        fill={isInverse ? red : green}
                      />
                    </g>
                  );
                })()}
            </svg>
          </div>

          {/* Volume Quality Indicator */}
          <div className="relative z-10 mt-3 flex flex-col items-center gap-1.5 w-full text-center">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-md whitespace-nowrap",
                stats.volumeBadge.bg,
                stats.volumeBadge.text,
                stats.volumeBadge.border,
              )}
            >
              {t(`learn.chart_simulator.volume_quality.${stats.volumeKey}`)}
            </Badge>
            <p className="text-[11px] text-muted-foreground max-w-xs italic min-h-9 sm:min-h-8 flex items-center justify-center text-center">
              "
              {t(
                `learn.chart_simulator.presets.${currentPreset.id}.description`,
              )}
              "
            </p>
          </div>
        </Card>

        {/* Right Column: Sliders & Live Quant Metrics */}
        <div className="lg:col-span-7 space-y-6">
          {/* 4 Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border border-border bg-muted/50">
              <CardContent className="space-y-1">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground truncate">
                  {t("learn.chart_simulator.target")}
                </CardTitle>
                <div className="text-lg font-bold text-foreground">
                  ${stats.targetPrice.toFixed(2)}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {stats.isBull ? "+" : "-"}
                  {stats.targetPercent.toFixed(1)}%{" "}
                  {t("learn.chart_simulator.from_breakout")}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border bg-muted/50">
              <CardContent className="space-y-1">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground truncate">
                  {t("learn.chart_simulator.pattern_height")}
                </CardTitle>
                <div className="text-lg font-bold text-foreground">
                  {patternHeight} {t("learn.chart_simulator.points_unit")}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {t("learn.chart_simulator.formation_depth")}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border bg-muted/50">
              <CardContent className="space-y-1">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground truncate">
                  {t("learn.chart_simulator.stop_loss")}
                </CardTitle>
                <div className="text-lg font-bold text-foreground">
                  ${stats.stopLossPrice.toFixed(2)}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {stats.stopPercent.toFixed(1)}%{" "}
                  {t("learn.chart_simulator.risk_distance")}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border bg-muted/50">
              <CardContent className="space-y-1">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground truncate">
                  {t("learn.chart_simulator.risk_reward")}
                </CardTitle>
                <div className="text-lg font-bold text-foreground">
                  1 : {stats.riskRewardRatio.toFixed(2)}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {stats.riskRewardRatio >= 2
                    ? t("learn.chart_simulator.ratio_good")
                    : t("learn.chart_simulator.ratio_low")}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Sliders & Execution Switches */}
          <Card className="p-4 border border-border bg-muted/50 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                {t("learn.chart_simulator.controls")}
              </h3>
              <span className="text-[11px] text-muted-foreground">
                {t("learn.chart_simulator.controls_hint")}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Pattern Height Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-foreground font-semibold">
                    {t("learn.chart_simulator.height_control")}
                  </span>
                  <span className="text-xs font-bold text-primary">
                    {patternHeight} {t("learn.chart_simulator.points_unit")}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={patternHeight}
                  onChange={(e) => setPatternHeight(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>10 {t("learn.chart_simulator.points_unit")}</span>
                  <span>50 {t("learn.chart_simulator.points_unit")}</span>
                </div>
              </div>

              {/* Neckline Price Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-foreground font-semibold">
                    {t("learn.chart_simulator.neckline_control")}
                  </span>
                  <span className="text-xs font-bold text-primary">
                    ${necklinePrice}
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={necklinePrice}
                  onChange={(e) => setNecklinePrice(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>$50</span>
                  <span>$200</span>
                </div>
              </div>

              {/* Entry Mode Toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>{t("learn.chart_simulator.entry_mode")}</span>
                </label>
                <div className="flex gap-1.5">
                  {(["retest", "breakout"] as const).map((mode) => {
                    const isSelected = entryMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        className={cn(
                          "flex-1 h-7 rounded-md border text-[11px] font-semibold flex items-center justify-center transition-all duration-150 cursor-pointer select-none",
                          isSelected
                            ? "border-primary bg-primary/15 text-primary font-bold ring-1 ring-primary/40 shadow-xs"
                            : "border-border bg-card hover:border-primary/50 hover:bg-muted/40 hover:text-foreground text-muted-foreground",
                        )}
                        onClick={() => setEntryMode(mode)}
                      >
                        {mode === "retest"
                          ? t("learn.chart_simulator.retest")
                          : t("learn.chart_simulator.breakout")}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Volume Simulator Toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>{t("learn.chart_simulator.volume_control")}</span>
                </label>
                <div className="flex gap-1.5">
                  {[
                    { mult: 0.8, key: "low" },
                    { mult: 1.5, key: "normal" },
                    { mult: 2.5, key: "surge" },
                  ].map((v) => {
                    const isSelected = volumeMult === v.mult;
                    return (
                      <button
                        key={v.mult}
                        type="button"
                        className={cn(
                          "flex-1 h-7 rounded-md border text-[11px] font-semibold flex items-center justify-center transition-all duration-150 cursor-pointer select-none",
                          isSelected
                            ? "border-primary bg-primary/15 text-primary font-bold ring-1 ring-primary/40 shadow-xs"
                            : "border-border bg-card hover:border-primary/50 hover:bg-muted/40 hover:text-foreground text-muted-foreground",
                        )}
                        onClick={() => setVolumeMult(v.mult)}
                      >
                        {t(`learn.chart_simulator.volume_options.${v.key}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>

          {/* Pro Tip Callout */}
          <Card className="border border-border bg-muted/50">
            <CardContent className="space-y-1">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                {t("learn.chart_simulator.golden_rule")}
              </CardTitle>
              <p className="text-xs text-muted-foreground leading-relaxed min-h-10 flex items-center">
                {t(`learn.chart_simulator.presets.${currentPreset.id}.pro_tip`)}
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
              <LineChart className={cn("h-4 w-4", PALETTE.positive.text)} />
              <CardTitle className="text-lg font-bold uppercase tracking-tight text-foreground">
                {t("learn.chart_simulator.title")}
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              {t("learn.chart_simulator.description")}
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
