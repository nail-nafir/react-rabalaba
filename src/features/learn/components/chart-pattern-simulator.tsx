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
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FilterGroup } from "@/components/shared/filter-group";
import { BADGE, PALETTE } from "@/constants/taxonomy/palette";
import { cn } from "@/lib/utils";
import { Sliders, LineChart, ShieldCheck, Target, Zap } from "lucide-react";

interface ChartPatternPreset {
  id: string;
  bias: "bullish" | "bearish";
  defaultHeight: number;
  defaultNeckline: number;
}

const PRESETS: ChartPatternPreset[] = [
  {
    id: "head-and-shoulders",
    bias: "bearish",
    defaultHeight: 25,
    defaultNeckline: 100,
  },
  {
    id: "inverse-head-and-shoulders",
    bias: "bullish",
    defaultHeight: 25,
    defaultNeckline: 100,
  },
  {
    id: "double-top",
    bias: "bearish",
    defaultHeight: 20,
    defaultNeckline: 100,
  },
  {
    id: "double-bottom",
    bias: "bullish",
    defaultHeight: 20,
    defaultNeckline: 100,
  },
  {
    id: "bull-flag",
    bias: "bullish",
    defaultHeight: 30,
    defaultNeckline: 100,
  },
  {
    id: "ascending-triangle",
    bias: "bullish",
    defaultHeight: 22,
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

  const [selectedPresetId, setSelectedPresetId] =
    useState<string>("head-and-shoulders");
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
  }, [
    currentPreset,
    patternHeight,
    necklinePrice,
    volumeMult,
    entryMode,
  ]);

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
      {isDialog && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-3 rounded-xl border border-border">
          <span className="text-xs font-semibold text-foreground">
            {t("learn.chart_simulator.select_preset")}
          </span>
          <FilterGroup
            value={selectedPresetId}
            options={presetOptions}
            onChange={handlePresetSelect}
            variant="select"
            className="w-full sm:w-72"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Live Geometry Canvas (SVG) */}
        <div className="lg:col-span-5 h-full flex flex-col justify-between items-center p-5 bg-card/60 border border-border/70 rounded-xl relative overflow-hidden">
          {/* Background subtle grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-size-[16px_16px] pointer-events-none" />

          <div className="flex-1 w-full flex items-center justify-center min-h-55 relative">
            <svg viewBox="0 0 320 200" className="w-full h-full max-w-85">
              {/* 1. HEAD & SHOULDERS */}
              {selectedPresetId === "head-and-shoulders" &&
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
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <text
                        x="25"
                        y={yNeckline - 6}
                        fill="#f59e0b"
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
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <line
                        x1="225"
                        y1={yNeckline}
                        x2="225"
                        y2={yTP}
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <text
                        x="145"
                        y={(yHead + yNeckline) / 2 + 3}
                        fill="#38bdf8"
                        fontSize="8"
                        fontWeight="bold"
                      >
                        H ({patternHeight})
                      </text>
                      <text
                        x="230"
                        y={(yNeckline + yTP) / 2 + 3}
                        fill="#38bdf8"
                        fontSize="8"
                        fontWeight="bold"
                      >
                        -H (${patternHeight})
                      </text>

                      {/* Dynamic Price Path */}
                      <path
                        d={`M 30,${yNeckline + 15} L 60,${yShoulder} L 95,${yNeckline} L 140,${yHead} L 180,${yNeckline} L 210,${yShoulder} L 225,${yNeckline} L 245,${yTP}`}
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Anatomy Labels */}
                      <text
                        x="60"
                        y={yShoulder - 6}
                        fill="#a1a1aa"
                        fontSize="7"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {t("learn.visual.left_shoulder")}
                      </text>
                      <text
                        x="140"
                        y={yHead - 6}
                        fill="#f43f5e"
                        fontSize="9"
                        fontWeight="black"
                        textAnchor="middle"
                      >
                        {t("learn.visual.head")}
                      </text>
                      <text
                        x="210"
                        y={yShoulder - 6}
                        fill="#a1a1aa"
                        fontSize="7"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {t("learn.visual.right_shoulder")}
                      </text>

                      {/* Target TP Marker */}
                      <circle cx="245" cy={yTP} r="4" fill="#f43f5e" />
                      <text
                        x="252"
                        y={yTP + 3}
                        fill="#f43f5e"
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
              {selectedPresetId === "inverse-head-and-shoulders" &&
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
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <text
                        x="25"
                        y={yNeckline - 6}
                        fill="#f59e0b"
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
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <line
                        x1="225"
                        y1={yTP}
                        x2="225"
                        y2={yNeckline}
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <text
                        x="145"
                        y={(yNeckline + yHead) / 2 + 3}
                        fill="#38bdf8"
                        fontSize="8"
                        fontWeight="bold"
                      >
                        H ({patternHeight})
                      </text>
                      <text
                        x="230"
                        y={(yNeckline + yTP) / 2 + 3}
                        fill="#38bdf8"
                        fontSize="8"
                        fontWeight="bold"
                      >
                        +H (${patternHeight})
                      </text>

                      {/* Price Path */}
                      <path
                        d={`M 30,${yNeckline - 15} L 60,${yShoulder} L 95,${yNeckline} L 140,${yHead} L 180,${yNeckline} L 210,${yShoulder} L 225,${yNeckline} L 245,${yTP}`}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Anatomy Labels */}
                      <text
                        x="60"
                        y={yShoulder + 12}
                        fill="#a1a1aa"
                        fontSize="7"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {t("learn.visual.left_shoulder")}
                      </text>
                      <text
                        x="140"
                        y={yHead + 14}
                        fill="#10b981"
                        fontSize="9"
                        fontWeight="black"
                        textAnchor="middle"
                      >
                        {t("learn.visual.head")}
                      </text>
                      <text
                        x="210"
                        y={yShoulder + 12}
                        fill="#a1a1aa"
                        fontSize="7"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {t("learn.visual.right_shoulder")}
                      </text>

                      {/* Target TP Marker */}
                      <circle cx="245" cy={yTP} r="4" fill="#10b981" />
                      <text
                        x="252"
                        y={yTP + 3}
                        fill="#10b981"
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
              {selectedPresetId === "double-top" &&
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
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <text
                        x="25"
                        y={yNeckline - 6}
                        fill="#f59e0b"
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
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <line
                        x1="225"
                        y1={yNeckline}
                        x2="225"
                        y2={yTP}
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <text
                        x="140"
                        y={(yPeak + yNeckline) / 2 + 3}
                        fill="#38bdf8"
                        fontSize="8"
                        fontWeight="bold"
                      >
                        H ({patternHeight})
                      </text>
                      <text
                        x="230"
                        y={(yNeckline + yTP) / 2 + 3}
                        fill="#38bdf8"
                        fontSize="8"
                        fontWeight="bold"
                      >
                        -H (${patternHeight})
                      </text>

                      {/* Path */}
                      <path
                        d={`M 30,${yNeckline + 15} L 75,${yPeak} L 135,${yNeckline} L 195,${yPeak} L 225,${yNeckline} L 250,${yTP}`}
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      <text
                        x="75"
                        y={yPeak - 6}
                        fill="#f43f5e"
                        fontSize="8"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {t("learn.visual.peak_1")}
                      </text>
                      <text
                        x="195"
                        y={yPeak - 6}
                        fill="#f43f5e"
                        fontSize="8"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {t("learn.visual.peak_2")}
                      </text>

                      <circle cx="250" cy={yTP} r="4" fill="#f43f5e" />
                      <text
                        x="252"
                        y={yTP + 3}
                        fill="#f43f5e"
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
              {selectedPresetId === "double-bottom" &&
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
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <text
                        x="25"
                        y={yNeckline - 6}
                        fill="#f59e0b"
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
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <line
                        x1="225"
                        y1={yTP}
                        x2="225"
                        y2={yNeckline}
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <text
                        x="140"
                        y={(yNeckline + yTrough) / 2 + 3}
                        fill="#38bdf8"
                        fontSize="8"
                        fontWeight="bold"
                      >
                        H ({patternHeight})
                      </text>
                      <text
                        x="230"
                        y={(yNeckline + yTP) / 2 + 3}
                        fill="#38bdf8"
                        fontSize="8"
                        fontWeight="bold"
                      >
                        +H (${patternHeight})
                      </text>

                      {/* Path */}
                      <path
                        d={`M 30,${yNeckline - 15} L 75,${yTrough} L 135,${yNeckline} L 195,${yTrough} L 225,${yNeckline} L 250,${yTP}`}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      <text
                        x="75"
                        y={yTrough + 14}
                        fill="#10b981"
                        fontSize="8"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {t("learn.visual.bottom_1")}
                      </text>
                      <text
                        x="195"
                        y={yTrough + 14}
                        fill="#10b981"
                        fontSize="8"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {t("learn.visual.bottom_2")}
                      </text>

                      <circle cx="250" cy={yTP} r="4" fill="#10b981" />
                      <text
                        x="252"
                        y={yTP + 3}
                        fill="#10b981"
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
              {selectedPresetId === "bull-flag" &&
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
                        stroke="#10b981"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                      <text
                        x="50"
                        y={(yPoleBase + yPoleTop) / 2}
                        fill="#10b981"
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
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />
                      <line
                        x1="90"
                        y1={yPoleTop + flagDepth}
                        x2="175"
                        y2={yPoleTop + flagDepth + 30}
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />

                      {/* Zigzag in Flag & Breakout */}
                      <path
                        d={`M 95,${yPoleTop} L 115,${yPoleTop + flagDepth + 8} L 135,${yPoleTop + 15} L 155,${yPoleTop + flagDepth + 23} L 175,${yPoleTop + 30} L 245,${yTP}`}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      <line
                        x1="220"
                        y1={yPoleTop + 20}
                        x2="220"
                        y2={yTP}
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <text
                        x="225"
                        y={(yPoleTop + 20 + yTP) / 2}
                        fill="#38bdf8"
                        fontSize="8"
                        fontWeight="bold"
                      >
                        +H
                      </text>

                      <circle cx="245" cy={yTP} r="4" fill="#10b981" />
                      <text
                        x="248"
                        y={yTP + 3}
                        fill="#10b981"
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
              {selectedPresetId === "ascending-triangle" &&
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
                        stroke="#f43f5e"
                        strokeWidth="2"
                        strokeDasharray="3 3"
                      />
                      <text
                        x="35"
                        y={yResistance - 6}
                        fill="#f43f5e"
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
                        stroke="#10b981"
                        strokeWidth="2"
                      />

                      {/* Height & Projections */}
                      <line
                        x1="45"
                        y1={yResistance}
                        x2="45"
                        y2={yBase - 10}
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <line
                        x1="225"
                        y1={yTP}
                        x2="225"
                        y2={yResistance}
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <text
                        x="50"
                        y={(yResistance + yBase) / 2}
                        fill="#38bdf8"
                        fontSize="8"
                        fontWeight="bold"
                      >
                        H ({patternHeight})
                      </text>
                      <text
                        x="230"
                        y={(yResistance + yTP) / 2 + 3}
                        fill="#38bdf8"
                        fontSize="8"
                        fontWeight="bold"
                      >
                        +H (${patternHeight})
                      </text>

                      {/* Waves */}
                      <path
                        d={`M 40,${yBase - 10} L 75,${yResistance} L 115,${yResistance + (yBase - yResistance) * 0.6} L 150,${yResistance} L 180,${yResistance + (yBase - yResistance) * 0.25} L 205,${yResistance} L 245,${yTP}`}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      <circle cx="245" cy={yTP} r="4" fill="#10b981" />
                      <text
                        x="248"
                        y={yTP + 3}
                        fill="#10b981"
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
            </svg>
          </div>

          {/* Volume Quality Indicator */}
          <div className="mt-3 flex flex-col items-center gap-1.5 w-full text-center">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-md",
                stats.volumeBadge.bg,
                stats.volumeBadge.text,
                stats.volumeBadge.border,
              )}
            >
              {t(`learn.chart_simulator.volume_quality.${stats.volumeKey}`)}
            </Badge>
            <p className="text-[11px] text-muted-foreground max-w-xs italic">
              "{t(`learn.chart_simulator.presets.${currentPreset.id}.description`)}"
            </p>
          </div>
        </div>

        {/* Right Column: Sliders & Live Quant Metrics */}
        <div className="lg:col-span-7 space-y-6">
          {/* 4 Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
              <div className="text-[10px] uppercase font-bold text-primary">
                {t("learn.chart_simulator.target")}
              </div>
              <div className="text-lg font-bold text-foreground mt-0.5">
                ${stats.targetPrice.toFixed(2)}
              </div>
              <div className="text-[9px] text-muted-foreground">
                {stats.isBull ? "+" : "-"}
                {stats.targetPercent.toFixed(1)}%{" "}
                {t("learn.chart_simulator.from_breakout")}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">
                {t("learn.chart_simulator.pattern_height")}
              </div>
              <div className="text-lg font-bold text-foreground mt-0.5">
                {patternHeight} pts
              </div>
              <div className="text-[9px] text-muted-foreground">
                {t("learn.chart_simulator.formation_depth")}
              </div>
            </div>

            <div
              className={cn(
                "p-3 rounded-lg border",
                BADGE.negative.border,
                BADGE.negative.bg,
              )}
            >
              <div
                className={cn(
                  "text-[10px] uppercase font-bold",
                  PALETTE.negative.text,
                )}
              >
                {t("learn.chart_simulator.stop_loss")}
              </div>
              <div
                className={cn(
                  "text-lg font-bold mt-0.5",
                  PALETTE.negative.text,
                )}
              >
                ${stats.stopLossPrice.toFixed(2)}
              </div>
              <div className="text-[9px] text-muted-foreground">
                {stats.stopPercent.toFixed(1)}%{" "}
                {t("learn.chart_simulator.risk_distance")}
              </div>
            </div>

            <div
              className={cn(
                "p-3 rounded-lg border",
                BADGE.positive.border,
                BADGE.positive.bg,
              )}
            >
              <div
                className={cn(
                  "text-[10px] uppercase font-bold",
                  PALETTE.positive.text,
                )}
              >
                {t("learn.chart_simulator.risk_reward")}
              </div>
              <div
                className={cn(
                  "text-lg font-bold mt-0.5",
                  PALETTE.positive.text,
                )}
              >
                1 : {stats.riskRewardRatio.toFixed(2)}
              </div>
              <div className="text-[9px] text-muted-foreground">
                {stats.riskRewardRatio >= 2
                  ? t("learn.chart_simulator.ratio_good")
                  : t("learn.chart_simulator.ratio_low")}
              </div>
            </div>
          </div>

          <Separator />

          {/* Interactive Sliders & Execution Switches */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-primary" />
                {t("learn.chart_simulator.controls")}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t("learn.chart_simulator.controls_hint")}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Pattern Height Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground">
                    {t("learn.chart_simulator.height_control")}
                  </span>
                  <span className="font-bold text-foreground">
                    {patternHeight} pts
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
              </div>

              {/* Neckline Price Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground">
                    {t("learn.chart_simulator.neckline_control")}
                  </span>
                  <span className="font-bold text-foreground">
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
              </div>
            </div>

            {/* Toggles: Entry Mode & Volume Quality */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Entry Mode Toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  <span>{t("learn.chart_simulator.entry_mode")}</span>
                </label>
                <div className="flex gap-1.5">
                  <Button
                    variant={entryMode === "retest" ? "default" : "outline"}
                    size="xs"
                    className="flex-1 text-[10px] font-bold h-8 cursor-pointer"
                    onClick={() => setEntryMode("retest")}
                  >
                    {t("learn.chart_simulator.retest")}
                  </Button>
                  <Button
                    variant={entryMode === "breakout" ? "default" : "outline"}
                    size="xs"
                    className="flex-1 text-[10px] font-bold h-8 cursor-pointer"
                    onClick={() => setEntryMode("breakout")}
                  >
                    {t("learn.chart_simulator.breakout")}
                  </Button>
                </div>
              </div>

              {/* Volume Simulator Toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <span>{t("learn.chart_simulator.volume_control")}</span>
                </label>
                <div className="flex gap-1.5">
                  {[
                    { mult: 0.8, key: "low" },
                    { mult: 1.5, key: "normal" },
                    { mult: 2.5, key: "surge" },
                  ].map((v) => (
                    <Button
                      key={v.mult}
                      variant={volumeMult === v.mult ? "default" : "outline"}
                      size="xs"
                      className="flex-1 text-[10px] font-bold h-8 cursor-pointer"
                      onClick={() => setVolumeMult(v.mult)}
                    >
                      {t(`learn.chart_simulator.volume_options.${v.key}`)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Pro Tip Callout */}
          <div className="flex items-start gap-3 p-3.5 rounded-lg border border-primary/20 bg-primary/5 text-xs text-foreground leading-relaxed">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-primary mr-1">
                {t("learn.chart_simulator.golden_rule")}
              </span>
              {t(`learn.chart_simulator.presets.${currentPreset.id}.pro_tip`)}
            </div>
          </div>
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
            className="w-full sm:w-72"
          />
        </div>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
};
