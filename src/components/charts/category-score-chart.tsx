import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  LabelList,
  Rectangle,
  ReferenceLine,
  XAxis,
  YAxis,
  type BarShapeProps,
  type LabelProps,
  type YAxisTickContentProps,
} from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { PALETTE, SCORE_CATEGORIES, CATEGORY_LABEL_KEYS } from "@/constants";
import type { Outlook } from "@/features/engine/signals";

const POS = PALETTE.positive.fill;
const NEG = PALETTE.negative.fill;
const FLAT = PALETTE.neutral.fill;

/** ±0.05 dead zone on the raw [-1..1] score, in the chart's [-100..100] units. */
const tone = (v: number): "pos" | "neg" | "flat" =>
  v > 5 ? "pos" : v < -5 ? "neg" : "flat";

const BAR_FILL: Record<ReturnType<typeof tone>, string> = {
  pos: POS,
  neg: NEG,
  flat: FLAT,
};
const LABEL_CLASS: Record<ReturnType<typeof tone>, string> = {
  pos: "fill-emerald-400",
  neg: "fill-rose-400",
  flat: "fill-zinc-400",
};

// All recharts inputs are hoisted/memoized — identity churn on data/domain/
// margin restarts mount animations whose effect cleanup calls setState, which
// can cascade into "Maximum update depth exceeded" (see sparkline.tsx).
const EMPTY_CONFIG: ChartConfig = {};
/** Right gutter reserved for the value column, clear of the bar track. */
const VALUE_GUTTER = 36;
const MARGIN = { top: 0, right: VALUE_GUTTER + 4, bottom: 0, left: 0 };
const DOMAIN: [number, number] = [-100, 100];
/** Full-width track behind each bar. */
const TRACK = { fill: FLAT, fillOpacity: 0.15, radius: 4 };

function renderBar(props: BarShapeProps) {
  return <Rectangle {...props} fill={BAR_FILL[tone(props.payload?.v ?? 0)]} />;
}

/** Category tick, left-aligned, sized like the technical-indicator card
 *  labels (10px) and colored like the flat (0%) value tone. */
function renderCategoryTick(props: YAxisTickContentProps) {
  return (
    <text
      x={0}
      y={props.y}
      textAnchor="start"
      dominantBaseline="central"
      fontSize={12}
      className="fill-zinc-400"
    >
      {String(props.payload?.value ?? "")}
    </text>
  );
}

/** Signed %, right-aligned in the right gutter that MARGIN reserves. Note:
 *  recharts' parentViewBox is the FULL chart box (margins included), not the
 *  plot area, so the right edge is parentViewBox.width itself. */
function renderValueLabel(props: LabelProps) {
  const vb = (props.viewBox ?? {}) as { y?: number; height?: number };
  const pvb = (props.parentViewBox ?? {}) as { x?: number; width?: number };
  const v = typeof props.value === "number" ? props.value : 0;
  const pct = Math.round(v);
  return (
    <text
      x={(pvb.x ?? 0) + (pvb.width ?? 0) - 4}
      y={(vb.y ?? 0) + (vb.height ?? 0) / 2}
      textAnchor="end"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
      className={cn("tabular-nums", LABEL_CLASS[tone(v)])}
    >
      {pct > 0 ? `+${pct}` : pct}%
    </text>
  );
}

interface CategoryScoreChartProps {
  scores: Outlook["categoryScores"];
}

/**
 * Per-category alignment (trend / momentum / volatility / volume) as a
 * diverging horizontal bar chart over the signed [-100..+100] score.
 */
export const CategoryScoreChart = memo(function CategoryScoreChart({
  scores,
}: CategoryScoreChartProps) {
  const { t } = useTranslation();

  const data = useMemo(
    () =>
      SCORE_CATEGORIES.map((key) => ({
        name: t(CATEGORY_LABEL_KEYS[key]),
        v: scores[key] * 100,
      })),
    [scores, t],
  );

  return (
    <ChartContainer
      config={EMPTY_CONFIG}
      className="pointer-events-none aspect-auto h-32 w-full select-none"
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={MARGIN}
        accessibilityLayer={false}
      >
        <XAxis type="number" hide domain={DOMAIN} />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={80}
          tick={renderCategoryTick}
        />
        <ReferenceLine x={0} stroke="var(--border)" />
        <Bar
          dataKey="v"
          barSize={8}
          radius={4}
          shape={renderBar}
          background={TRACK}
        >
          <LabelList dataKey="v" content={renderValueLabel} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
});
