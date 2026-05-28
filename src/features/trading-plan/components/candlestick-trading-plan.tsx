import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { UnifiedAsset } from "@/types/asset";
import { useTranslation } from "react-i18next";
import {
  formatPrice as formatPriceUtil,
  formatDateTime as formatDateTimeUtil,
} from "@/lib/formatters";
import { normalizeYahooCandles } from "@/services/adapters/yahoo-candles";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CandlestickTradingPlanProps {
  asset: UnifiedAsset | null | undefined;
  tradingPlan: {
    entry: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    takeProfit3?: number;
    riskRewardRatio: number;
  } | null;
  signal: "long" | "short" | "neutral";
  className?: string;
}

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: number;
}

interface ActiveCandle extends Candle {
  index: number;
}

export function CandlestickTradingPlan({
  asset,
  tradingPlan,
  signal,
  className,
}: CandlestickTradingPlanProps) {
  const { t } = useTranslation();
  const [activeCandle, setActiveCandle] = useState<ActiveCandle | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // 1. Zipping OHLCV data & taking last 90 candles
  const candles = useMemo(() => {
    if (!asset?.quoteIndicators || !asset?.timestamps) return [];

    // Use the same normalization as the signal engine so chart candles,
    // indicators, and the visual plan all refer to the same candle indexes.
    return normalizeYahooCandles(asset.quoteIndicators, asset.timestamps).slice(
      -120,
    );
  }, [asset]);

  // SVG parameters
  const width = 640;
  const height = 360;
  const paddingTop = 25;
  const paddingBottom = 25;
  const paddingLeft = 15;
  const paddingRight = 100; // generous space for professional price axis labels

  const xMin = paddingLeft;
  const xMax = width - paddingRight;
  const yMin = paddingTop;
  const yMax = height - paddingBottom;

  // 2. Compute dynamic price levels (including TP3 fallback)
  const calculatedTradingPlan = useMemo(() => {
    if (!tradingPlan) return null;

    const riskAmount = Math.abs(tradingPlan.entry - tradingPlan.stopLoss);
    const tp3 =
      tradingPlan.takeProfit3 ??
      (signal === "long"
        ? tradingPlan.entry + riskAmount * 3.5
        : tradingPlan.entry - riskAmount * 3.5);

    return {
      ...tradingPlan,
      takeProfit3: tp3,
    };
  }, [tradingPlan, signal]);

  // 3. Auto-scale both candles and Trading Plan levels
  const { minPrice, maxPrice } = useMemo(() => {
    if (candles.length === 0) return { minPrice: 0, maxPrice: 100 };

    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);

    const pricesToFit = [...highs, ...lows];

    if (calculatedTradingPlan) {
      pricesToFit.push(
        calculatedTradingPlan.entry,
        calculatedTradingPlan.stopLoss,
        calculatedTradingPlan.takeProfit1,
        calculatedTradingPlan.takeProfit2,
        calculatedTradingPlan.takeProfit3,
      );
    }

    const absMax = Math.max(...pricesToFit);
    const absMin = Math.min(...pricesToFit);

    // Add 12% padding for a premium, spacious look
    const range = absMax - absMin || 1;
    const padding = range * 0.12;

    return {
      minPrice: Math.max(0, absMin - padding),
      maxPrice: absMax + padding,
    };
  }, [candles, calculatedTradingPlan]);

  // Scales
  const yScale = (price: number) => {
    return yMax - ((price - minPrice) / (maxPrice - minPrice)) * (yMax - yMin);
  };

  const candleCount = candles.length;
  const drawWidth = xMax - xMin;
  const colWidth = drawWidth / (candleCount || 1);
  const candleWidth = colWidth * 0.72; // perfect spacing gap between candles

  const xScale = (index: number) => {
    return xMin + (index + 0.5) * colWidth;
  };

  // Gridline prices
  const gridlinePrices = useMemo(() => {
    const prices = [];
    const steps = 4;
    for (let i = 1; i < steps; i++) {
      prices.push(minPrice + (maxPrice - minPrice) * (i / steps));
    }
    return prices;
  }, [minPrice, maxPrice]);

  // Mouse interactivity to select nearest candle
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (candles.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xRaw = e.clientX - rect.left;
    const yRaw = e.clientY - rect.top;

    // 1. Calculate the scale factor between the actual rendered size and the SVG viewbox (640x360)
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;

    // 2. Map screen coordinates to internal SVG coordinates
    const x = xRaw * scaleX;
    const y = yRaw * scaleY;

    // 3. Convert SVG X to candle index
    const innerX = x - xMin;

    // Check if mouse is within the horizontal chart area
    if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
      const index = Math.max(
        0,
        Math.min(
          candles.length - 1,
          Math.floor((innerX / drawWidth) * candles.length),
        ),
      );

      setActiveCandle({
        ...candles[index],
        index,
      });
    } else {
      setActiveCandle(null);
    }

    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setActiveCandle(null);
  };

  // Fix background scroll leak by manually handling wheel events
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const dialogContent = e.currentTarget.closest('[role="dialog"]');
    if (dialogContent) {
      dialogContent.scrollTop += e.deltaY;
    }
  };

  // Formatter helpers using shared library utilities
  const formatPrice = (price: number) =>
    formatPriceUtil(price, asset?.assetType);
  const formatDateTime = formatDateTimeUtil;

  return (
    <TooltipProvider delay={0}>
      <div
        className={cn(
          "relative w-full rounded-xl border border-border p-2 select-none touch-auto",
          className,
        )}
        style={{ cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        <div className="relative overflow-hidden h-full w-full">
          {activeCandle && (
            <div
              className="absolute z-50 pointer-events-none"
              style={{
                left: `${(xScale(activeCandle.index) / width) * 100}%`,
                top: `${(mousePos.y / height) * 100}%`,
                transform: "translateX(-50%)",
                cursor: "crosshair",
              }}
            >
              <Tooltip open={true}>
                <TooltipTrigger>
                  <div className="w-1 h-1" style={{ cursor: "crosshair" }} />
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  sideOffset={10}
                  className="bg-muted p-3 text-mono-data rounded-xl"
                  style={{ cursor: "crosshair" }}
                >
                  <div className="space-y-1.5" style={{ cursor: "crosshair" }}>
                    <div className="text-[10px] text-muted-foreground font-semibold border-b border-muted-foreground pb-1 mb-1">
                      {formatDateTime(activeCandle.timestamp)}
                    </div>
                    <div className="space-y-0.5 text-xs">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Open:</span>
                        <span className="font-medium">
                          {formatPrice(activeCandle.open)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">High:</span>
                        <span className="font-medium text-emerald-400">
                          {formatPrice(activeCandle.high)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Low:</span>
                        <span className="font-medium text-rose-400">
                          {formatPrice(activeCandle.low)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Close:</span>
                        <span className="font-medium">
                          {formatPrice(activeCandle.close)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 border-t border-muted-foreground pt-1 mt-1">
                        <span className="text-muted-foreground">
                          {t("table.change")}:
                        </span>
                        <span
                          className={cn(
                            "font-bold",
                            activeCandle.close >= activeCandle.open
                              ? "text-emerald-400"
                              : "text-rose-400",
                          )}
                        >
                          {activeCandle.open > 0
                            ? `${(((activeCandle.close - activeCandle.open) / activeCandle.open) * 100).toFixed(2)}%`
                            : "0.00%"}
                        </span>
                      </div>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-auto block"
            style={{ cursor: "crosshair" }}
          >
            {" "}
            <defs>
              {/* Soft background glows for Zones */}
              <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
              </linearGradient>
              <linearGradient id="invalidGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.01" />
              </linearGradient>
              <linearGradient id="glowLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.1" />
              </linearGradient>

              {/* Glowing filter for professional touch */}
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            {/* 1. Gridlines */}
            {gridlinePrices.map((gp, idx) => (
              <g key={`grid-${idx}`}>
                <line
                  x1={xMin}
                  y1={yScale(gp)}
                  x2={xMax}
                  y2={yScale(gp)}
                  stroke="currentColor"
                  className="text-border/20"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
                <text
                  x={xMin + 5}
                  y={yScale(gp) - 4}
                  className="text-[9px] fill-muted-foreground/60 font-mono-data"
                >
                  {formatPrice(gp)}
                </text>
              </g>
            ))}
            {/* 2. Trading Plan Visual Areas (Profit & Invalidation Zones) */}
            {calculatedTradingPlan && (
              <>
                {signal === "long" ? (
                  <>
                    {/* Profit Target Zone */}
                    <rect
                      x={xMin}
                      y={yScale(calculatedTradingPlan.takeProfit3)}
                      width={drawWidth}
                      height={
                        yScale(calculatedTradingPlan.entry) -
                        yScale(calculatedTradingPlan.takeProfit3)
                      }
                      fill="url(#profitGrad)"
                    />
                    {/* Invalidation Zone */}
                    <rect
                      x={xMin}
                      y={yScale(calculatedTradingPlan.stopLoss)}
                      width={drawWidth}
                      height={yMax - yScale(calculatedTradingPlan.stopLoss)}
                      fill="url(#invalidGrad)"
                    />
                  </>
                ) : (
                  <>
                    {/* Profit Target Zone (Short: TP is below entry) */}
                    <rect
                      x={xMin}
                      y={yScale(calculatedTradingPlan.entry)}
                      width={drawWidth}
                      height={
                        yScale(calculatedTradingPlan.takeProfit3) -
                        yScale(calculatedTradingPlan.entry)
                      }
                      fill="url(#profitGrad)"
                    />
                    {/* Invalidation Zone (Short: SL is above entry) */}
                    <rect
                      x={xMin}
                      y={yMin}
                      width={drawWidth}
                      height={yScale(calculatedTradingPlan.stopLoss) - yMin}
                      fill="url(#invalidGrad)"
                    />
                  </>
                )}
              </>
            )}
            {/* 3. Render Candlesticks */}
            {candles.map((c, i) => {
              const isBullish = c.close >= c.open;
              const x = xScale(i);
              const yHigh = yScale(c.high);
              const yLow = yScale(c.low);
              const yOpen = yScale(c.open);
              const yClose = yScale(c.close);

              const bodyY = Math.min(yOpen, yClose);
              const bodyHeight = Math.max(1.5, Math.abs(yOpen - yClose));
              const color = isBullish ? "#10b981" : "#ef4444";

              return (
                <g key={`candle-${i}`} className="transition-all duration-200">
                  {/* Wick line */}
                  <line
                    x1={x}
                    y1={yHigh}
                    x2={x}
                    y2={yLow}
                    stroke={color}
                    strokeWidth="1.2"
                  />
                  {/* Candle Body */}
                  <rect
                    x={x - candleWidth / 2}
                    y={bodyY}
                    width={candleWidth}
                    height={bodyHeight}
                    fill={color}
                    stroke={color}
                    strokeWidth="1"
                    className={cn(
                      "transition-all duration-150",
                      activeCandle?.index === i
                        ? "opacity-100 scale-y-105"
                        : "opacity-85",
                    )}
                  />
                </g>
              );
            })}
            {/* 4. Active Hover Cursor Line */}
            {activeCandle && (
              <line
                x1={xScale(activeCandle.index)}
                y1={yMin}
                x2={xScale(activeCandle.index)}
                y2={yMax}
                stroke="#64748b"
                strokeWidth="0.8"
                strokeDasharray="2 3"
                className="opacity-60"
              />
            )}
            {/* 5. Trading Plan Horizontal Guidelines & Axis Labels */}
            {calculatedTradingPlan && (
              <>
                {/* Take Profit 3 (Target 3) */}
                <line
                  x1={xMin}
                  y1={yScale(calculatedTradingPlan.takeProfit3)}
                  x2={xMax}
                  y2={yScale(calculatedTradingPlan.takeProfit3)}
                  stroke="#059669"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                />
                <g
                  transform={`translate(${xMax + 4}, ${yScale(calculatedTradingPlan.takeProfit3) - 8})`}
                >
                  <rect
                    width="90"
                    height="16"
                    rx="4"
                    fill="#059669"
                    fillOpacity="0.2"
                    stroke="#059669"
                    strokeWidth="0.8"
                  />
                  <text
                    x="5"
                    y="11"
                    className="text-[8px] font-bold fill-emerald-400 font-mono-data"
                  >
                    TP3: {formatPrice(calculatedTradingPlan.takeProfit3)}
                  </text>
                </g>

                {/* Take Profit 2 (Target 2) */}
                <line
                  x1={xMin}
                  y1={yScale(calculatedTradingPlan.takeProfit2)}
                  x2={xMax}
                  y2={yScale(calculatedTradingPlan.takeProfit2)}
                  stroke="#10b981"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <g
                  transform={`translate(${xMax + 4}, ${yScale(calculatedTradingPlan.takeProfit2) - 8})`}
                >
                  <rect
                    width="90"
                    height="16"
                    rx="4"
                    fill="#10b981"
                    fillOpacity="0.2"
                    stroke="#10b981"
                    strokeWidth="0.8"
                  />
                  <text
                    x="5"
                    y="11"
                    className="text-[8px] font-bold fill-emerald-400 font-mono-data"
                  >
                    TP2: {formatPrice(calculatedTradingPlan.takeProfit2)}
                  </text>
                </g>

                {/* Take Profit 1 (Target 1) */}
                <line
                  x1={xMin}
                  y1={yScale(calculatedTradingPlan.takeProfit1)}
                  x2={xMax}
                  y2={yScale(calculatedTradingPlan.takeProfit1)}
                  stroke="#34d399"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <g
                  transform={`translate(${xMax + 4}, ${yScale(calculatedTradingPlan.takeProfit1) - 8})`}
                >
                  <rect
                    width="90"
                    height="16"
                    rx="4"
                    fill="#34d399"
                    fillOpacity="0.2"
                    stroke="#34d399"
                    strokeWidth="0.8"
                  />
                  <text
                    x="5"
                    y="11"
                    className="text-[8px] font-bold fill-emerald-400 font-mono-data"
                  >
                    TP1: {formatPrice(calculatedTradingPlan.takeProfit1)}
                  </text>
                </g>

                {/* Entry Price */}
                <line
                  x1={xMin}
                  y1={yScale(calculatedTradingPlan.entry)}
                  x2={xMax}
                  y2={yScale(calculatedTradingPlan.entry)}
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <g
                  transform={`translate(${xMax + 4}, ${yScale(calculatedTradingPlan.entry) - 8})`}
                >
                  <rect
                    width="90"
                    height="16"
                    rx="4"
                    fill="#38bdf8"
                    fillOpacity="0.2"
                    stroke="#38bdf8"
                    strokeWidth="0.8"
                  />
                  <text
                    x="5"
                    y="11"
                    className="text-[8px] font-bold fill-sky-400 font-mono-data"
                  >
                    ENTRY: {formatPrice(calculatedTradingPlan.entry)}
                  </text>
                </g>

                {/* Stop Loss / Invalidation Price */}
                <line
                  x1={xMin}
                  y1={yScale(calculatedTradingPlan.stopLoss)}
                  x2={xMax}
                  y2={yScale(calculatedTradingPlan.stopLoss)}
                  stroke="#f43f5e"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <g
                  transform={`translate(${xMax + 4}, ${yScale(calculatedTradingPlan.stopLoss) - 8})`}
                >
                  <rect
                    width="90"
                    height="16"
                    rx="4"
                    fill="#f43f5e"
                    fillOpacity="0.2"
                    stroke="#f43f5e"
                    strokeWidth="0.8"
                  />
                  <text
                    x="5"
                    y="11"
                    className="text-[8px] font-bold fill-rose-400 font-mono-data"
                  >
                    SL: {formatPrice(calculatedTradingPlan.stopLoss)}
                  </text>
                </g>
              </>
            )}
          </svg>
        </div>
      </div>
    </TooltipProvider>
  );
}
