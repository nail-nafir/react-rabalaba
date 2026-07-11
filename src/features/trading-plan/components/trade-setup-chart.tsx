import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  formatPrice,
  formatClock,
  formatDayMonth,
  formatRatio,
  formatVolume,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { PALETTE, SIGNAL_COLORS, SIGNAL_LABEL_KEYS } from "@/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import type { TradingPlan, AssetType, SignalDirection } from "@/types/asset";
import type { NormalizedYahooCandle } from "@/services/adapters/yahoo-candles";
import {
  buildTradeSetupModel,
  priceToRatio,
  priceTicks,
  dateTickIndices,
  mapMarkerToCandle,
  MAX_CANDLES,
  type LevelKey,
  type LevelKind,
  type ChartMarker,
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

// Per-cell width estimates. Emphasis cells render bold uppercase with
// letter-spacing, so wide glyphs (M/W) and the tracking push the text wider
// than a plain char count — bump the per-char estimate and padding so the text
// keeps clear of the cell dividers instead of crowding them.
const CELL_PAD = 16; // horizontal padding inside a cell (8px per side)
const EMPHASIS_CHAR_W = 7.6;
const NORMAL_CHAR_W = 6.6;

/** Tightest zoom: fewer raw candles than this and the bars lose meaning. */
const MIN_SPAN = 12;

/** Widest zoom: bars keep their native interval (no re-bucketing), so this
 *  caps how many can draw at once — beyond it they'd be sub-pixel slivers. */
const MAX_VISIBLE = 360;

/** Index of the candle whose timestamp is closest to `ts` (epoch seconds). */
const nearestIdx = (candles: { timestamp: number }[], ts: number) => {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < candles.length; i++) {
    const dist = Math.abs(candles[i].timestamp - ts);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
};

/** Width of a combined level pill ([KEY | price]) for the given strings. */
const pillWidth = (key: string, price: string) =>
  key.length * EMPHASIS_CHAR_W + CELL_PAD + (price.length * NORMAL_CHAR_W + CELL_PAD);

/** color language: entry = neutral, risk(SL) = rose, profit(TP) = emerald */
const LEVEL_COLOR: Record<LevelKind, string> = {
  entry: PALETTE.neutral.text,
  risk: PALETTE.negative.text,
  profit: PALETTE.positive.text,
};

/** Shared geometry for the combined chart pills (level badges + markers). */
const PILL_H = 18;

/** One segment of a chart pill. `emphasis` = the bold key cell (e.g. "ENTRY"). */
interface PillCell {
  text: string;
  emphasis?: boolean;
}

/** Width of a single pill cell — matches the level-badge measurements exactly. */
const pillCellWidth = (text: string, emphasis = false) =>
  text.length * (emphasis ? EMPHASIS_CHAR_W : NORMAL_CHAR_W) + CELL_PAD;

/** Total width of a multi-cell pill. */
const pillCellsWidth = (cells: PillCell[]) =>
  cells.reduce((w, c) => w + pillCellWidth(c.text, c.emphasis), 0);

/**
 * The combined badge used on the chart: a rounded box of divider-separated
 * cells. Single source of truth so level badges and entry/close markers share
 * identical fill, stroke, fonts, weights, letter-spacing and divider styling.
 * Color is inherited from the parent `<g>` via `currentColor`.
 */
function ChartPill({
  cells,
  x,
  cy,
  opacity = 0.95,
}: {
  cells: PillCell[];
  /** Left edge of the pill. */
  x: number;
  /** Vertical center of the pill. */
  cy: number;
  opacity?: number;
}) {
  const widths = cells.map((c) => pillCellWidth(c.text, c.emphasis));
  const bw = widths.reduce((a, b) => a + b, 0);
  // Left edge of each cell relative to `x`, computed purely (no mutation).
  const offsets = widths.map((_, i) =>
    widths.slice(0, i).reduce((a, b) => a + b, 0),
  );
  return (
    <>
      <rect
        x={x}
        y={cy - PILL_H / 2}
        width={bw}
        height={PILL_H}
        rx={3}
        className="fill-background stroke-current"
        strokeWidth={1}
        opacity={opacity}
      />
      {cells.map((c, i) => {
        const cw = widths[i];
        const cellX = x + offsets[i];
        return (
          <g key={i}>
            {i > 0 && (
              <line
                x1={cellX}
                y1={cy - PILL_H / 2 + 3}
                x2={cellX}
                y2={cy + PILL_H / 2 - 3}
                className="stroke-current"
                strokeWidth={1}
                opacity={0.5}
              />
            )}
            <text
              x={cellX + cw / 2}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-current"
              fontSize={c.emphasis ? 11 : 12}
              fontWeight={c.emphasis ? 700 : 600}
              style={c.emphasis ? { letterSpacing: "0.05em" } : undefined}
            >
              {c.text}
            </text>
          </g>
        );
      })}
    </>
  );
}

interface TradeSetupChartProps {
  candles: NormalizedYahooCandle[];
  plan: TradingPlan;
  signal: SignalDirection;
  assetType: AssetType;
  currentPrice: number;
  /** Optional entry/close annotations plotted on the candles (journal view). */
  markers?: ChartMarker[];
}

export function TradeSetupChart({
  candles,
  plan,
  signal,
  assetType,
  currentPrice,
  markers,
}: TradeSetupChartProps) {
  const { t, i18n } = useTranslation();
  const [hoveredCandle, setHoveredCandle] = useState<number | null>(null);
  const [hoveredLevel, setHoveredLevel] = useState<LevelKey | null>(null);
  // Free cursor Y (viewBox space) for the horizontal crosshair + price pill.
  // null on touch (no hover) and when the cursor is off the plot.
  const [hoverY, setHoverY] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // ── Zoomable viewport ──────────────────────────────────────────────
  // The chart owns a window into the raw `candles` series: wheel = zoom
  // (anchored on the cursor), drag / horizontal scroll = pan, double-click =
  // reset. Bars always keep their native interval (e.g. 1h) — zoom only
  // changes how many are visible, never their shape — so the count is capped
  // at MAX_VISIBLE and longer histories are reached by panning.

  // Trade bounds (entry→close markers), when they fall fully inside the data —
  // the default frame centers on them; otherwise it shows the latest bars.
  const focus = useMemo(() => {
    const entry = markers?.find((m) => m.kind === "entry");
    const close = markers?.find((m) => m.kind === "close");
    if (!entry || !close || candles.length === 0) return null;
    const lo = candles[0].timestamp;
    const hi = candles[candles.length - 1].timestamp;
    return entry.timestamp >= lo && close.timestamp <= hi
      ? { start: entry.timestamp, end: close.timestamp }
      : null;
  }, [markers, candles]);

  const defaultViewport = useMemo(() => {
    const len = candles.length;
    if (len === 0) return { start: 0, span: 0 };
    if (!focus) {
      const span = Math.min(MAX_CANDLES, len);
      return { start: len - span, span };
    }
    const entryIdx = nearestIdx(candles, focus.start);
    const closeIdx = nearestIdx(candles, focus.end);
    const tradeSpan = closeIdx - entryIdx + 1;
    if (tradeSpan <= MAX_VISIBLE * 0.8) {
      // Whole trade fits at native bars: frame it centered at ≤ ~80% width.
      const span = Math.min(
        len,
        Math.max(MAX_CANDLES, Math.ceil(tradeSpan / 0.8)),
      );
      const center = (entryIdx + closeIdx) / 2;
      const start = Math.min(
        Math.max(Math.round(center - span / 2), 0),
        len - span,
      );
      return { start, span };
    }
    // Trade longer than one frame can hold at native bars: anchor on the
    // close (+ a little aftermath); the entry reads as the off-screen edge
    // chevron and is reached by panning back.
    const span = Math.min(len, MAX_VISIBLE);
    const start = Math.min(
      Math.max(Math.round(closeIdx + span * 0.1) - span, 0),
      len - span,
    );
    return { start, span };
  }, [candles, focus]);

  // null = follow the default frame; set once the user zooms/pans. A new data
  // series (other symbol / window mode) snaps back to the default frame — the
  // "adjust state during render" pattern.
  const [viewport, setViewport] = useState<{
    start: number;
    span: number;
  } | null>(null);
  const dataKey = candles.length
    ? `${candles[0].timestamp}:${candles[candles.length - 1].timestamp}:${candles.length}`
    : "empty";
  const [prevDataKey, setPrevDataKey] = useState(dataKey);
  if (prevDataKey !== dataKey) {
    setPrevDataKey(dataKey);
    setViewport(null);
  }

  const vp = viewport ?? defaultViewport;

  const view = useMemo(
    () => candles.slice(vp.start, vp.start + vp.span),
    [candles, vp.start, vp.span],
  );

  // The price domain refits to whatever is visible (plus every plan level).
  const model = useMemo(
    () => buildTradeSetupModel(view, plan, signal, currentPrice),
    [view, plan, signal, currentPrice],
  );

  // Interaction plumbing: handlers read live values through refs so the
  // native wheel listener (registered once, non-passive so preventDefault
  // stops the dialog from scrolling) never sees stale state.
  const chartRef = useRef<HTMLDivElement | null>(null);
  const vpRef = useRef(vp);
  const lenRef = useRef(candles.length);
  const projXRef = useRef(VB_W);
  const dragRef = useRef<{
    pointerId: number;
    lastX: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  useEffect(() => {
    vpRef.current = vp;
    lenRef.current = candles.length;
  });

  const applyViewport = useCallback((start: number, span: number) => {
    const len = lenRef.current;
    if (len === 0) return;
    const s = Math.min(
      Math.max(span, Math.min(MIN_SPAN, len)),
      Math.min(len, MAX_VISIBLE),
    );
    const st = Math.min(Math.max(start, 0), len - s);
    setViewport({ start: st, span: s });
    // Indices shift under the inspected candle when the window moves.
    setHoveredCandle(null);
  }, []);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (lenRef.current === 0) return;
      e.preventDefault();
      const cur = vpRef.current;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // Horizontal trackpad swipe → pan.
        let shift = Math.round((e.deltaX / 300) * cur.span);
        if (shift === 0) shift = e.deltaX > 0 ? 1 : -1;
        applyViewport(cur.start + shift, cur.span);
      } else {
        // Vertical wheel → zoom, keeping the candle under the cursor put.
        const rect = el.getBoundingClientRect();
        const vbX = ((e.clientX - rect.left) / rect.width) * VB_W;
        const frac = Math.min(
          Math.max((vbX - CHART_LEFT) / (projXRef.current - CHART_LEFT), 0),
          1,
        );
        const span = Math.round(cur.span * Math.exp(e.deltaY * 0.0015));
        const anchor = cur.start + frac * cur.span;
        applyViewport(Math.round(anchor - frac * span), span);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyViewport]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lenRef.current === 0) return;
    dragRef.current = {
      pointerId: e.pointerId,
      lastX: e.clientX,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = chartRef.current;

    // Free-cursor Y for the horizontal crosshair (desktop hover only). Uses
    // the SVG's own rect — the wrapper also spans the legend strip above it.
    if ((!drag || !drag.moved) && e.pointerType !== "touch") {
      const svg = svgRef.current;
      if (svg) {
        const r = svg.getBoundingClientRect();
        const vbY = Math.round(((e.clientY - r.top) / r.height) * VB_H);
        setHoverY(vbY >= CHART_TOP && vbY <= CHART_BOTTOM ? vbY : null);
      }
    }

    if (!drag || drag.pointerId !== e.pointerId || !el) return;
    // Movement threshold before the pan starts, so a tap (touch inspect)
    // isn't swallowed by an accidental 1-2px wiggle.
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) {
        return;
      }
      drag.moved = true;
      drag.lastX = e.clientX;
      setHoverY(null); // panning: no crosshair
    }
    const rect = el.getBoundingClientRect();
    const cur = vpRef.current;
    // px → fraction of the candle plot area → raw-candle shift.
    const plotPx = (rect.width * (projXRef.current - CHART_LEFT)) / VB_W;
    const shift = Math.round((-(e.clientX - drag.lastX) / plotPx) * cur.span);
    if (shift !== 0) {
      drag.lastX = e.clientX;
      applyViewport(cur.start + shift, cur.span);
    }
  };
  const onPointerLeave = () => {
    setHoverY(null);
    setHoveredCandle(null);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== e.pointerId) return;
    dragRef.current = null;
    // Touch has no hover: a clean tap (no drag) inspects the candle under it.
    if (!drag.moved && e.pointerType === "touch" && slot > 0) {
      const el = chartRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vbX = ((e.clientX - rect.left) / rect.width) * VB_W;
      const idx = Math.floor((vbX - CHART_LEFT) / slot);
      setHoveredCandle(idx >= 0 && idx < view.length ? idx : null);
    }
  };

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
  useEffect(() => {
    projXRef.current = PROJ_X;
  });

  const y = (price: number) =>
    CHART_TOP +
    (1 - priceToRatio(price, model.priceMin, model.priceMax)) * CHART_H;

  // Inverse of y(): the price at a chart Y — for the crosshair price pill.
  const priceFromY = (yc: number) => {
    const ratio = 1 - (yc - CHART_TOP) / CHART_H;
    return model.priceMin + ratio * (model.priceMax - model.priceMin);
  };

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

  // Crosshair geometry, computed once so the guide LINES (drawn behind the
  // candles) and the value PILLS (drawn last, on top of the level badges/axis
  // labels) share the same numbers. Horizontal position snaps to the candle;
  // the Y follows the free cursor (or the candle close on touch).
  const crosshair = hovered
    ? (() => {
        const crossY = hoverY ?? y(hovered.candle.close);
        const crossPrice =
          hoverY != null ? priceFromY(hoverY) : hovered.candle.close;
        const timeStr = `${formatDayMonth(
          hovered.candle.timestamp,
          i18n.language,
        )} ${formatClock(hovered.candle.timestamp)}`;
        const timeW = timeStr.length * NORMAL_CHAR_W + 10;
        const timeCx = Math.min(
          Math.max(hovered.cx, CHART_LEFT + timeW / 2),
          PROJ_X - timeW / 2,
        );
        return {
          cx: hovered.cx,
          crossY,
          priceStr: formatPrice(crossPrice, assetType),
          timeStr,
          timeW,
          timeCx,
        };
      })()
    : null;

  // OHLC legend strip (TradingView pattern): a FIXED line above the plot that
  // shows the inspected candle — or the latest visible one when idle — so the
  // reading position never moves and no candle is ever covered by a tooltip.
  const legendCandle = hovered?.candle ?? view[view.length - 1] ?? null;

  // Entry/close annotations resolved to the visible candle window. Out-of-range
  // markers are clamped to the chart edge (cx) and flagged so they render an
  // off-screen indicator. Computed inline (like candleGeo) as it depends on the
  // per-render `y`/`slot`.
  const markerGeo = mapMarkerToCandle(markers ?? [], view).map((m) => ({
    ...m,
    cx: m.outOfRange
      ? m.edge === "start"
        ? CHART_LEFT
        : PROJ_X
      : CHART_LEFT + (m.candleIndex + 0.5) * slot,
    py: y(m.price),
  }));

  // Label side per marker by price rank (top half above, bottom half below) so
  // nearby entry/close badges fan apart; deterministic on ties; single = below.
  const markerLabelAbove = (() => {
    const order = [...markerGeo.map((mk, idx) => ({ idx, py: mk.py }))]
      .sort((a, b) => a.py - b.py || a.idx - b.idx)
      .map((e) => e.idx);
    return (idx: number) =>
      markerGeo.length > 1 && order.indexOf(idx) < markerGeo.length / 2;
  })();

  return (
    <div className="space-y-3">
      <div
        ref={chartRef}
        className="relative w-full cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onDoubleClick={() => setViewport(null)}
      >
        {/* Back-to-default-frame affordance: appears once the user has
            zoomed/panned away (same action as double-clicking the chart). */}
        {viewport !== null && (
          <Button
            variant="outline"
            size="xs"
            onClick={() => setViewport(null)}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            aria-label={t("dialog.chart_restore")}
            className="absolute right-2 top-2 z-10 cursor-pointer bg-background/80 backdrop-blur-sm gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            <span>{t("dialog.chart_restore")}</span>
          </Button>
        )}
        <Card className="overflow-hidden border border-border bg-muted/50">
          {/* @container so the HTML legend can size its font in cqw to match
              the SVG text, which scales with the same width (viewBox 760). */}
          <CardContent className="@container">

            {legendCandle &&
              (() => {
                const up = legendCandle.close >= legendCandle.open;
                const chg =
                  legendCandle.open !== 0
                    ? ((legendCandle.close - legendCandle.open) /
                        legendCandle.open) *
                      100
                    : 0;
                const dirColor = up ? "text-emerald-400" : "text-rose-400";
                return (
                  <div
                    className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 leading-none"
                    style={{
                      // Line the strip up with the plot's left edge (CHART_LEFT
                      // inside the same-width SVG below), not the card padding.
                      paddingLeft: `${(CHART_LEFT / VB_W) * 100}%`,
                      // Match the SVG's fontSize=11: the SVG (w-full, viewBox
                      // 760) renders text at 11·W/760 px, and 100cqw == W here.
                      fontSize: `calc(100cqw / ${VB_W} * 11)`,
                    }}
                  >
                    <span className="whitespace-nowrap text-muted-foreground">
                      {formatDayMonth(legendCandle.timestamp, i18n.language)}{" "}
                      {formatClock(legendCandle.timestamp)}
                    </span>
                    {/* The candle's % change reads as an OHLV stat, not part of
                        the timestamp — lead the stats group with it so it sits a
                        full group-gap from the date (matches the share card). */}
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className={cn("whitespace-nowrap", dirColor)}>
                        {chg >= 0 ? "+" : ""}
                        {chg.toFixed(2)}%
                      </span>
                      <LegendStat
                        label="OPEN"
                        value={formatPrice(legendCandle.open, assetType)}
                      />
                      <LegendStat
                        label="HIGH"
                        value={formatPrice(legendCandle.high, assetType)}
                        valueClassName="text-emerald-400"
                      />
                      <LegendStat
                        label="LOW"
                        value={formatPrice(legendCandle.low, assetType)}
                        valueClassName="text-rose-400"
                      />
                      <LegendStat
                        label="CLOSE"
                        value={formatPrice(legendCandle.close, assetType)}
                        valueClassName={dirColor}
                      />
                      <LegendStat
                        label="VOLUME"
                        // Yahoo often has no volume for a crypto intraday
                        // candle (a genuine 24/7 zero is impossible), so show
                        // "—" for a missing bar instead of a misleading "0".
                        value={
                          legendCandle.volume > 0
                            ? formatVolume(legendCandle.volume)
                            : "—"
                        }
                      />
                    </span>
                  </div>
                );
              })()}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              className="block h-auto w-full"
              role="img"
            >
              {/* exchange-style brand watermark: RABALABA, big and faint,
                  centered behind the price action (bottom-most layer). */}
              <text
                x={(CHART_LEFT + PROJ_X) / 2}
                y={CHART_TOP + CHART_H / 2}
                textAnchor="middle"
                dominantBaseline="central"
                className="select-none"
                fontSize={54}
                fontWeight={900}
                letterSpacing="0.02em"
                opacity={0.07}
              >
                <tspan className="fill-foreground">RABALABA</tspan>
              </text>

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

              {/* crosshair guide lines (behind the candles; the value pills
                  draw last so they sit on top of everything). Both lines share
                  the same dashed style — no highlight band. */}
              {crosshair && (
                <g className="pointer-events-none">
                  <line
                    x1={crosshair.cx}
                    y1={CHART_TOP}
                    x2={crosshair.cx}
                    y2={CHART_BOTTOM}
                    className="stroke-muted-foreground"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    opacity={0.7}
                  />
                  <line
                    x1={CHART_LEFT}
                    y1={crosshair.crossY}
                    x2={PROJ_X}
                    y2={crosshair.crossY}
                    className="stroke-muted-foreground"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    opacity={0.7}
                  />
                </g>
              )}

              {/* candles */}
              {candleGeo.map((g, i) => (
                <g
                  key={i}
                  className={g.up ? PALETTE.positive.text : PALETTE.negative.text}
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
                      const cells: PillCell[] = [
                        { text: lvl.key.toUpperCase(), emphasis: true },
                        { text: formatPrice(lvl.price, assetType) },
                      ];
                      const bx = VB_W - PAD_X - pillCellsWidth(cells);
                      return (
                        <ChartPill
                          cells={cells}
                          x={bx}
                          cy={ly}
                          opacity={active ? 1 : 0.95}
                        />
                      );
                    })()}
                  </g>
                );
              })}

              {/* entry / close markers: arrow at (time, price) + level-style badge */}
              {markerGeo.map((m, i) => {
                // Match the level color language: entry neutral, close by P/L.
                const colorClass =
                  m.kind === "entry"
                    ? "text-muted-foreground"
                    : m.outcome === "loss"
                      ? "text-rose-400"
                      : "text-emerald-400";
                const arrowH = 7;
                const arrowHalf = 5;
                const word = m.kind === "entry" ? "ENTRY" : "CLOSED";
                // Keep the marker badge clean: just the action word, no date /
                // price cells (those read off the axis + level badges already).
                const cells: PillCell[] = [{ text: word, emphasis: true }];
                const bw = pillCellsWidth(cells);
                const clampCy = (v: number) =>
                  Math.min(
                    CHART_BOTTOM - PILL_H / 2,
                    Math.max(CHART_TOP + PILL_H / 2, v),
                  );

                // Out-of-range: clamp to the edge with an outward chevron so the
                // event still reads at its real price, flagged as off-screen.
                if (m.outOfRange) {
                  const atStart = m.edge === "start";
                  const baseX = atStart ? m.cx + arrowH : m.cx - arrowH;
                  const chevron = `${m.cx},${m.py} ${baseX},${m.py - arrowHalf} ${baseX},${m.py + arrowHalf}`;
                  const above = markerLabelAbove(i);
                  const labelCy = clampCy(
                    above ? m.py - PILL_H / 2 - 4 : m.py + PILL_H / 2 + 4,
                  );
                  const labelX = atStart ? CHART_LEFT : PROJ_X - bw;
                  const nearY = above
                    ? labelCy + PILL_H / 2
                    : labelCy - PILL_H / 2;
                  return (
                    <g key={`marker-${m.kind}-${i}`} className={colorClass}>
                      {/* dashed tail emphasizing the event lies off-screen */}
                      <line
                        x1={m.cx}
                        y1={m.py}
                        x2={baseX}
                        y2={m.py}
                        className="stroke-current"
                        strokeWidth={1}
                        strokeDasharray="3 2"
                        opacity={0.6}
                      />
                      {/* leader connecting the price point to the badge */}
                      <line
                        x1={m.cx}
                        y1={m.py}
                        x2={m.cx}
                        y2={nearY}
                        className="stroke-current"
                        strokeWidth={1}
                        opacity={0.6}
                      />
                      <polygon points={chevron} className="fill-current" />
                      <ChartPill
                        cells={cells}
                        x={labelX}
                        cy={labelCy}
                        opacity={1}
                      />
                    </g>
                  );
                }

                // In-range: label side by price rank (see markerLabelAbove).
                const pointsUp = !markerLabelAbove(i);
                const baseY = pointsUp ? m.py + arrowH : m.py - arrowH;
                const tri = `${m.cx},${m.py} ${m.cx - arrowHalf},${baseY} ${m.cx + arrowHalf},${baseY}`;
                const gap = 4;
                const labelCy = clampCy(
                  pointsUp
                    ? baseY + gap + PILL_H / 2
                    : baseY - gap - PILL_H / 2,
                );
                const labelX = Math.min(
                  PROJ_X - bw,
                  Math.max(CHART_LEFT, m.cx - bw / 2),
                );
                const nearY = pointsUp
                  ? labelCy - PILL_H / 2
                  : labelCy + PILL_H / 2;

                return (
                  <g key={`marker-${m.kind}-${i}`} className={colorClass}>
                    {/* leader line from the price point to the badge */}
                    <line
                      x1={m.cx}
                      y1={m.py}
                      x2={m.cx}
                      y2={nearY}
                      className="stroke-current"
                      strokeWidth={1}
                      opacity={0.6}
                    />
                    <polygon points={tri} className="fill-current" />
                    <ChartPill
                      cells={cells}
                      x={labelX}
                      cy={labelCy}
                      opacity={1}
                    />
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

              {/* crosshair value pills — drawn LAST so the price pill overrides
                  the level badges and the time pill overrides the date axis
                  labels (like a real trading terminal). */}
              {crosshair && (
                <g className="pointer-events-none">
                  <rect
                    x={PROJ_X}
                    y={crosshair.crossY - 9}
                    width={VB_W - PAD_X - PROJ_X}
                    height={18}
                    rx={2}
                    className="fill-foreground"
                  />
                  <text
                    x={PROJ_X + 4}
                    y={crosshair.crossY}
                    dominantBaseline="central"
                    textAnchor="start"
                    className="fill-background"
                    fontSize={11}
                  >
                    {crosshair.priceStr}
                  </text>
                  <rect
                    x={crosshair.timeCx - crosshair.timeW / 2}
                    y={CHART_BOTTOM + 1}
                    width={crosshair.timeW}
                    height={AXIS_B - 1}
                    rx={2}
                    className="fill-foreground"
                  />
                  <text
                    x={crosshair.timeCx}
                    y={CHART_BOTTOM + 1 + (AXIS_B - 1) / 2}
                    dominantBaseline="central"
                    textAnchor="middle"
                    className="fill-background"
                    fontSize={11}
                  >
                    {crosshair.timeStr}
                  </text>
                </g>
              )}
            </svg>
          </CardContent>
        </Card>
      </div>

      {/* numeric panel: R:R · Entry · SL · TP1 · TP2 · TP3 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="overflow-hidden border border-border bg-muted/50 transition-colors hover:border-primary">
          <CardContent className="flex flex-col gap-1.5">
            <span className="text-[10px] text-muted-foreground">
              Risk : Reward
            </span>
            <span className="text-base font-bold leading-none">
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
              "overflow-hidden border bg-muted/50 transition-colors",
              hoveredLevel === lvl.key ? "border-primary" : "border-border",
            )}
          >
            <CardContent className="flex flex-col gap-1.5">
              <div className="flex items-start justify-between gap-1">
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
                      SIGNAL_COLORS[model.signal].bg,
                      SIGNAL_COLORS[model.signal].text,
                      SIGNAL_COLORS[model.signal].border,
                    )}
                  >
                    {t(SIGNAL_LABEL_KEYS[model.signal])}
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
              <span className="text-base font-bold leading-none">
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

/** One legend-strip stat: muted single-letter label + mono value inline. */
function LegendStat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-muted-foreground">{label} </span>
      <span className={valueClassName}>{value}</span>
    </span>
  );
}
