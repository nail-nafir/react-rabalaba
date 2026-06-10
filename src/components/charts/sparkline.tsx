import { memo, useId, useMemo } from "react";
import { AreaChart, Area, YAxis } from "recharts";
import { cn } from "@/lib/utils";

const UP_COLOR = "var(--color-emerald-400)";
const DOWN_COLOR = "var(--color-rose-400)";

interface SparklineProps {
  /** Raw close series from the query cache (nulls = missing candles). */
  values: (number | null)[] | undefined;
  width: number;
  height: number;
  className?: string;
  strokeWidth?: number;
  /** Uniform chart inset; a number (not an object) so the prop stays identity-stable. */
  margin?: number;
  animationDuration?: number;
  animationBegin?: number;
}

/**
 * Price sparkline whose recharts inputs (data, domain, margin) keep a stable
 * identity across re-renders. Recharts restarts the mount animation whenever
 * `data`/axis identity changes, and recharts 3.x fires setState from the
 * animation effect's cleanup — so feeding it fresh arrays every render lets a
 * re-render burst (e.g. opening a dialog) cascade into React's "Maximum update
 * depth exceeded". Memoizing on the source array limits the animation to mount
 * and real data changes.
 */
export const Sparkline = memo(function Sparkline({
  values,
  width,
  height,
  className,
  strokeWidth = 1,
  margin = 0,
  animationDuration = 900,
  animationBegin = 100,
}: SparklineProps) {
  const gradientId = `spark-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const model = useMemo(() => {
    const points = (values ?? [])
      .filter((p): p is number => p !== null)
      .slice(-30);
    if (points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const pad = (max - min || 1) * 0.1;
    return {
      data: points.map((v) => ({ v })),
      domain: [min - pad, max + pad] as [number, number],
      color: points[points.length - 1] >= points[0] ? UP_COLOR : DOWN_COLOR,
    };
  }, [values]);

  const chartMargin = useMemo(
    () => ({ top: margin, right: margin, bottom: margin, left: margin }),
    [margin],
  );

  if (!model) return null;

  return (
    <div className={cn("pointer-events-none select-none", className)}>
      <AreaChart
        width={width}
        height={height}
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
          dataKey="v"
          stroke={model.color}
          strokeWidth={strokeWidth}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={false}
          isAnimationActive
          animationDuration={animationDuration}
          animationBegin={animationBegin}
        />
      </AreaChart>
    </div>
  );
});
