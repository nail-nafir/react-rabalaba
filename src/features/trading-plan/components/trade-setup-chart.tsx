import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatPrice, formatDateTime, formatDayMonth, formatRatio } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TradingPlan, AssetType, SignalDirection } from "@/types/asset";
import type { NormalizedYahooCandle } from "@/services/adapters/yahoo-candles";
import {
  buildTradeSetupModel,
  priceToRatio,
  priceTicks,
  dateTickIndices,
  MAX_CANDLES,
  type LevelKey,
  type LevelKind,
} from "../lib/trade-setup-model";

const VB_W = 760;
const VB_H = 380;
const PAD_T = 12;
const PAD_B = 6;
const PAD_X = 8;
const AXIS_B = 14; // bottom band for the date axis labels
const CHART_TOP = PAD_T;
const CHART_H = VB_H - PAD_T - PAD_B - AXIS_B;
const CHART_BOTTOM = CHART_TOP + CHART_H;
const CHART_LEFT = PAD_X;

/** Width of a combined level pill ([KEY | price]) for the given strings. */
const pillWidth = (key: string, price: string) =>
  key.length * 7 + 12 + (price.length * 6.6 + 12);

/** color language: entry = neutral, risk(SL) = rose, profit(TP) = emerald */
const LEVEL_COLOR: Record<LevelKind, string> = {
  entry: "text-muted-foreground",
  risk: "text-rose-400",
  profit: "text-emerald-400",
};

interface TradeSetupChartProps {
  candles: NormalizedYahooCandle[];
  plan: TradingPlan;
  signal: SignalDirection;
  assetType: AssetType;
  currentPrice: number;
}

export function TradeSetupChart({
  candles,
  plan,
  signal,
  assetType,
  currentPrice,
}: TradeSetupChartProps) {
  const { t, i18n } = useTranslation();
  const [hoveredCandle, setHoveredCandle] = useState<number | null>(null);
  const [hoveredLevel, setHoveredLevel] = useState<LevelKey | null>(null);

  const model = useMemo(
    () => buildTradeSetupModel(candles, plan, signal, currentPrice),
    [candles, plan, signal, currentPrice],
  );

  const view = useMemo(
    () =>
      candles
        .slice(-MAX_CANDLES)
        .filter((c) => c.high >= model.priceMin && c.low <= model.priceMax),
    [candles, model.priceMin, model.priceMax],
  );

  // Right price column auto-sizes to the widest level pill, so candles fill the
  // rest of the width (minimal empty space on the right, mirroring the left).
  const axisW =
    Math.max(
      40,
      ...model.levels.map((l) =>
        pillWidth(l.key.toUpperCase(), formatPrice(l.price, assetType)),
      ),
    ) + 6;
  const PROJ_X = VB_W - PAD_X - axisW;

  const y = (price: number) =>
    CHART_TOP +
    (1 - priceToRatio(price, model.priceMin, model.priceMax)) * CHART_H;

  // Precompute candle geometry.
  const slot = view.length > 0 ? (PROJ_X - CHART_LEFT) / view.length : 0;
  const candleGeo = view.map((c, i) => {
    const cx = CHART_LEFT + (i + 0.5) * slot;
    const up = c.close >= c.open;
    const yo = y(c.open);
    const yc = y(c.close);
    return {
      cx,
      up,
      bodyTop: Math.min(yo, yc),
      bodyH: Math.max(1, Math.abs(yo - yc)),
      bodyW: Math.max(1, slot * 0.62),
      yHigh: y(c.high),
      yLow: y(c.low),
      candle: c,
    };
  });

  const zone = (from: number, to: number) => {
    const top = Math.min(y(from), y(to));
    return { top, height: Math.abs(y(from) - y(to)) };
  };
  const profit = zone(model.profitZone.from, model.profitZone.to);
  const risk = zone(model.riskZone.from, model.riskZone.to);

  const hovered = hoveredCandle != null ? candleGeo[hoveredCandle] : null;

  return (
    <div className="space-y-3">
      <div className="relative w-full">
        <Card className="overflow-hidden border border-border">
          <CardContent>
            <svg
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              className="block h-auto w-full"
              role="img"
            >
              {/* price axis: horizontal gridlines + right-gutter labels */}
              {priceTicks(model.priceMin, model.priceMax).map((p, i) => {
                const py = y(p);
                return (
                  <g key={`price-tick-${i}`}>
                    <line
                      x1={CHART_LEFT}
                      y1={py}
                      x2={PROJ_X}
                      y2={py}
                      className="stroke-border"
                      strokeWidth={1}
                      opacity={0.5}
                    />
                    <text
                      x={PROJ_X + 4}
                      y={py}
                      dominantBaseline="central"
                      textAnchor="start"
                      className="fill-muted-foreground"
                      fontSize={11}
                    >
                      {formatPrice(p, assetType)}
                    </text>
                  </g>
                );
              })}

              {/* date axis: vertical gridlines + bottom labels */}
              {dateTickIndices(view.length).map((idx, i, arr) => {
                const cx = candleGeo[idx].cx;
                const anchor =
                  i === 0 ? "start" : i === arr.length - 1 ? "end" : "middle";
                return (
                  <g key={`date-tick-${idx}`}>
                    <line
                      x1={cx}
                      y1={CHART_TOP}
                      x2={cx}
                      y2={CHART_BOTTOM}
                      className="stroke-border"
                      strokeWidth={1}
                      opacity={0.5}
                    />
                    <text
                      x={cx}
                      y={CHART_BOTTOM + 12}
                      textAnchor={anchor}
                      className="fill-muted-foreground"
                      fontSize={11}
                    >
                      {formatDayMonth(view[idx].timestamp, i18n.language)}
                    </text>
                  </g>
                );
              })}

              {/* profit / risk zone shading */}
              <rect
                x={CHART_LEFT}
                y={profit.top}
                width={PROJ_X - CHART_LEFT}
                height={profit.height}
                className="fill-emerald-400/10"
              />
              <rect
                x={CHART_LEFT}
                y={risk.top}
                width={PROJ_X - CHART_LEFT}
                height={risk.height}
                className="fill-rose-400/10"
              />

              {/* candles */}
              {candleGeo.map((g, i) => (
                <g
                  key={i}
                  className={g.up ? "text-emerald-400" : "text-rose-400"}
                  opacity={
                    hoveredCandle == null || hoveredCandle === i ? 1 : 0.45
                  }
                >
                  <line
                    x1={g.cx}
                    y1={g.yHigh}
                    x2={g.cx}
                    y2={g.yLow}
                    className="stroke-current"
                    strokeWidth={1}
                  />
                  <rect
                    x={g.cx - g.bodyW / 2}
                    y={g.bodyTop}
                    width={g.bodyW}
                    height={g.bodyH}
                    className="fill-current"
                  />
                </g>
              ))}

              {/* level lines + labels */}
              {model.levels.map((lvl) => {
                const ly = y(lvl.price);
                const active = hoveredLevel === lvl.key;
                return (
                  <g
                    key={lvl.key}
                    className={cn(LEVEL_COLOR[lvl.kind], "cursor-default")}
                    onMouseEnter={() => setHoveredLevel(lvl.key)}
                    onMouseLeave={() => setHoveredLevel(null)}
                  >
                    {/* invisible thick hit-line */}
                    <line
                      x1={CHART_LEFT}
                      y1={ly}
                      x2={PROJ_X}
                      y2={ly}
                      stroke="transparent"
                      strokeWidth={12}
                    />
                    <line
                      x1={CHART_LEFT}
                      y1={ly}
                      x2={PROJ_X}
                      y2={ly}
                      className="stroke-current"
                      strokeWidth={active ? 2 : 1}
                      strokeDasharray={lvl.kind === "entry" ? "1 0" : "5 4"}
                      opacity={active ? 1 : 0.85}
                    />
                    {/* combined level + price badge with a divider */}
                    {(() => {
                      const key = lvl.key.toUpperCase();
                      const price = formatPrice(lvl.price, assetType);
                      const keyW = key.length * 7 + 12;
                      const priceW = price.length * 6.6 + 12;
                      const bw = keyW + priceW;
                      const bh = 18;
                      const bx = VB_W - PAD_X - bw;
                      const divX = bx + keyW;
                      return (
                        <>
                          <rect
                            x={bx}
                            y={ly - bh / 2}
                            width={bw}
                            height={bh}
                            rx={3}
                            className="fill-background stroke-current"
                            strokeWidth={1}
                            opacity={active ? 1 : 0.95}
                          />
                          <text
                            x={bx + keyW / 2}
                            y={ly}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="fill-current"
                            fontSize={11}
                            fontWeight={700}
                            style={{ letterSpacing: "0.05em" }}
                          >
                            {key}
                          </text>
                          <line
                            x1={divX}
                            y1={ly - bh / 2 + 3}
                            x2={divX}
                            y2={ly + bh / 2 - 3}
                            className="stroke-current"
                            strokeWidth={1}
                            opacity={0.5}
                          />
                          <text
                            x={divX + priceW / 2}
                            y={ly}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="fill-current"
                            fontSize={12}
                            fontWeight={600}
                          >
                            {price}
                          </text>
                        </>
                      );
                    })()}
                  </g>
                );
              })}

              {/* candle hover hit areas */}
              {candleGeo.map((g, i) => (
                <rect
                  key={`hit-${i}`}
                  x={g.cx - slot / 2}
                  y={CHART_TOP}
                  width={slot}
                  height={CHART_H}
                  fill="transparent"
                  onMouseEnter={() => setHoveredCandle(i)}
                  onMouseLeave={() => setHoveredCandle(null)}
                />
              ))}
            </svg>
          </CardContent>
        </Card>

        {/* candle tooltip */}
        {hovered && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-border bg-card px-2 py-1.5 text-[10px]"
            style={{
              left: `${Math.min(85, Math.max(15, (hovered.cx / VB_W) * 100))}%`,
              top: `${(hovered.yHigh / VB_H) * 100}%`,
            }}
          >
            <div className="mb-1 whitespace-nowrap border-b border-border pb-1 font-medium text-muted-foreground">
              {formatDateTime(hovered.candle.timestamp, i18n.language)}
            </div>
            {(() => {
              const c = hovered.candle;
              const up = c.close >= c.open;
              const chg =
                c.open !== 0 ? ((c.close - c.open) / c.open) * 100 : 0;
              const closeColor = up ? "text-emerald-400" : "text-rose-400";
              return (
                <>
                  <div className="flex flex-col gap-0.5 text-mono-data">
                    <Ohlc label="Open" value={formatPrice(c.open, assetType)} />
                    <Ohlc
                      label="High"
                      value={formatPrice(c.high, assetType)}
                      valueClassName="text-emerald-400"
                    />
                    <Ohlc
                      label="Low"
                      value={formatPrice(c.low, assetType)}
                      valueClassName="text-rose-400"
                    />
                    <Ohlc
                      label="Close"
                      value={formatPrice(c.close, assetType)}
                      valueClassName={closeColor}
                    />
                  </div>
                  <div className="mt-1 flex justify-between gap-3 border-t border-border pt-1 text-mono-data">
                    <span className="text-muted-foreground">Change</span>
                    <span className={closeColor}>
                      {chg >= 0 ? "+" : ""}
                      {chg.toFixed(2)}%
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* numeric panel: R:R · Entry · SL · TP1 · TP2 · TP3 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Card className="overflow-hidden border border-border transition-colors hover:border-primary/50">
          <CardContent className="flex flex-col gap-1.5">
            <span className="text-[10px] text-muted-foreground">
              {t("dialog.risk_reward")}
            </span>
            <span className="text-base font-bold leading-none text-mono-data">
              1 : {formatRatio(model.riskReward)}
            </span>
          </CardContent>
        </Card>
        {model.levels.map((lvl) => (
          <Card
            key={lvl.key}
            onMouseEnter={() => setHoveredLevel(lvl.key)}
            onMouseLeave={() => setHoveredLevel(null)}
            className={cn(
              "overflow-hidden border transition-colors",
              hoveredLevel === lvl.key ? "border-primary/50" : "border-border",
            )}
          >
            <CardContent className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-1">
                <span className={cn("text-[10px]", LEVEL_COLOR[lvl.kind])}>
                  {lvl.kind === "profit"
                    ? `${t("dialog.take_profit")} ${lvl.key.slice(2)}`
                    : t(`dialog.${lvl.labelKey}`)}
                </span>
                {lvl.kind === "entry" ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-md text-[10px] font-semibold uppercase tracking-wider",
                      model.signal === "short"
                        ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                        : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                    )}
                  >
                    {model.signal}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-md text-[10px] font-semibold uppercase tracking-wider",
                      lvl.kind === "risk"
                        ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                        : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                    )}
                  >
                    {lvl.kind === "risk" ? "-" : "+"}
                    {lvl.rMultiple.toFixed(1)}R
                  </Badge>
                )}
              </div>
              <span className="text-base font-bold leading-none text-mono-data">
                {formatPrice(lvl.price, assetType)}
              </span>
              {lvl.kind !== "entry" && (
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    LEVEL_COLOR[lvl.kind],
                  )}
                >
                  {lvl.pctFromCurrent >= 0 ? "+" : ""}
                  {lvl.pctFromCurrent.toFixed(2)}%
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Ohlc({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <span className="flex justify-between gap-3 whitespace-nowrap">
      <span className="text-muted-foreground">{label}</span>
      <span className={valueClassName}>{value}</span>
    </span>
  );
}
