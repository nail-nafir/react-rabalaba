import { memo, useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

const UP_COLOR = "var(--color-emerald-400)";
const DOWN_COLOR = "var(--color-rose-400)";

interface SparklineProps {
  /** Raw close series from the query cache (nulls = missing candles). */
  values: (number | null)[] | undefined;
  width?: number | string;
  height?: number | string;
  className?: string;
  strokeWidth?: number;
  /** Uniform chart inset; a number (not an object) so the prop stays identity-stable. */
  margin?: number;
  animationDuration?: number;
  animationBegin?: number;
}

/**
 * Price sparkline whose Recharts inputs stay stable across unrelated renders.
 * Fixed-size table cells skip ResizeObserver; flexible cards stay responsive.
 */
export const Sparkline = memo(function Sparkline({
  values,
  width = "100%",
  height = "100%",
  className,
  strokeWidth = 1,
  margin = 0,
  animationDuration = 900,
  animationBegin = 100,
}: SparklineProps) {
  const gradientId = `spark-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const model = useMemo(() => {
    const points = (values ?? [])
      .filter((point): point is number => Number.isFinite(point))
      .slice(-30);
    if (points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const pad = (max - min || 1) * 0.1;
    return {
      data: points.map((value) => ({ value })),
      domain: [min - pad, max + pad] as [number, number],
      color: points[points.length - 1] >= points[0] ? UP_COLOR : DOWN_COLOR,
    };
  }, [values]);

  const chartMargin = useMemo(
    () => ({ top: margin, right: margin, bottom: margin, left: margin }),
    [margin],
  );
  const responsiveDimension = useMemo(
    () => ({
      width: typeof width === "number" ? width : 320,
      height: typeof height === "number" ? height : 32,
    }),
    [height, width],
  );

  if (!model) return null;

  const fixedSize = typeof width === "number" && typeof height === "number";
  const chart = (
    <AreaChart
      width={typeof width === "number" ? width : undefined}
      height={typeof height === "number" ? height : undefined}
      data={model.data}
      margin={chartMargin}
      accessibilityLayer={false}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={model.color} stopOpacity={0.45} />
          <stop offset="100%" stopColor={model.color} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <YAxis hide domain={model.domain} />
      <Area
        type="monotone"
        dataKey="value"
        stroke={model.color}
        strokeWidth={strokeWidth}
        fill={`url(#${gradientId})`}
        dot={false}
        activeDot={false}
        isAnimationActive="auto"
        animationDuration={animationDuration}
        animationBegin={animationBegin}
      />
    </AreaChart>
  );

  return (
    <div
      className={cn("pointer-events-none select-none", className)}
      style={{ width, height }}
    >
      {fixedSize ? (
        chart
      ) : (
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={responsiveDimension}
          debounce={100}
        >
          {chart}
        </ResponsiveContainer>
      )}
    </div>
  );
});
