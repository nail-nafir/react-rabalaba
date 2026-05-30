import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatPrice, formatDateTime, formatRatio } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import type { TradingPlan, AssetType, SignalDirection } from "@/types/asset";
import type { NormalizedYahooCandle } from "@/services/adapters/yahoo-candles";
import {
  buildTradeSetupModel,
  priceToRatio,
  type LevelKey,
  type LevelKind,
} from "../lib/trade-setup-model";

const VB_W = 760;
const VB_H = 300;
const PAD_T = 24;
const PAD_B = 18;
const PAD_X = 8;
const CHART_TOP = PAD_T;
const CHART_H = VB_H - PAD_T - PAD_B;
const CHART_LEFT = PAD_X;
const CHART_RIGHT = VB_W - PAD_X;
const CHART_W = CHART_RIGHT - CHART_LEFT;
const PROJ_X = CHART_LEFT + CHART_W * 0.78; // start of the (narrow) projection zone
const MAX_CANDLES = 120;

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
  const { t } = useTranslation();
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
              {/* profit / risk zone shading */}
              <rect
                x={CHART_LEFT}
                y={profit.top}
                width={CHART_W}
                height={profit.height}
                className="fill-emerald-400/10"
              />
              <rect
                x={CHART_LEFT}
                y={risk.top}
                width={CHART_W}
                height={risk.height}
                className="fill-rose-400/10"
              />

              {/* projection divider */}
              <line
                x1={PROJ_X}
                y1={CHART_TOP}
                x2={PROJ_X}
                y2={CHART_TOP + CHART_H}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray="2 3"
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
                      x2={CHART_RIGHT}
                      y2={ly}
                      stroke="transparent"
                      strokeWidth={12}
                    />
                    <line
                      x1={CHART_LEFT}
                      y1={ly}
                      x2={CHART_RIGHT}
                      y2={ly}
                      className="stroke-current"
                      strokeWidth={active ? 2 : 1}
                      strokeDasharray={lvl.kind === "entry" ? "1 0" : "5 4"}
                      opacity={active ? 1 : 0.85}
                    />
                    {/* badge centered on the line */}
                    {(() => {
                      const label = lvl.key.toUpperCase();
                      const bw = label.length * 6 + 12;
                      const bh = 15;
                      return (
                        <>
                          <rect
                            x={PROJ_X + 6}
                            y={ly - bh / 2}
                            width={bw}
                            height={bh}
                            rx={3}
                            className="fill-current"
                            opacity={active ? 1 : 0.9}
                          />
                          <text
                            x={PROJ_X + 6 + bw / 2}
                            y={ly}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="fill-background"
                            fontSize={9}
                            fontWeight={700}
                            style={{ letterSpacing: "0.05em" }}
                          >
                            {label}
                          </text>
                        </>
                      );
                    })()}
                    {/* price badge (masks the line behind it) */}
                    {(() => {
                      const price = formatPrice(lvl.price, assetType);
                      const pbw = price.length * 5.6 + 12;
                      const pbh = 15;
                      const pbx = CHART_RIGHT - 4 - pbw;
                      return (
                        <>
                          <rect
                            x={pbx}
                            y={ly - pbh / 2}
                            width={pbw}
                            height={pbh}
                            rx={3}
                            className="fill-background stroke-current"
                            strokeWidth={1}
                            opacity={active ? 1 : 0.95}
                          />
                          <text
                            x={pbx + pbw / 2}
                            y={ly}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="fill-current"
                            fontSize={10}
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
            <div className="mb-1 border-b border-border pb-1 font-medium text-muted-foreground">
              {formatDateTime(hovered.candle.timestamp)}
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

      {/* numeric panel: row1 = R:R · Entry · Stop Loss, row2 = TP1 · TP2 · TP3 */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="overflow-hidden border border-border transition-colors hover:border-primary/50">
          <CardContent className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
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
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    LEVEL_COLOR[lvl.kind],
                  )}
                >
                  {lvl.kind === "profit"
                    ? `${t("dialog.take_profit")} ${lvl.key.slice(2)}`
                    : t(`dialog.${lvl.labelKey}`)}
                </span>
                {lvl.kind === "entry" ? (
                  <span
                    className={cn(
                      "shrink-0 rounded px-1 py-px text-[9px] font-bold uppercase",
                      model.signal === "short"
                        ? "bg-rose-400/15 text-rose-400"
                        : "bg-emerald-400/15 text-emerald-400",
                    )}
                  >
                    {model.signal}
                  </span>
                ) : (
                  <span
                    className={cn(
                      "shrink-0 rounded px-1 py-px text-[9px] font-bold",
                      lvl.kind === "risk"
                        ? "bg-rose-400/15 text-rose-400"
                        : "bg-emerald-400/15 text-emerald-400",
                    )}
                  >
                    {lvl.kind === "risk" ? "-" : "+"}
                    {lvl.rMultiple.toFixed(1)}R
                  </span>
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
