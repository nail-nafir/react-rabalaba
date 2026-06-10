import { memo, useMemo } from "react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

/** Strength tiers: weak < 60 ≤ medium < 80 ≤ strong. */
const TONE = {
  strong: { fill: "var(--color-emerald-400)", text: "text-emerald-400" },
  medium: { fill: "var(--color-amber-400)", text: "text-amber-400" },
  weak: { fill: "var(--color-rose-400)", text: "text-rose-400" },
} as const;
const toneOf = (v: number): keyof typeof TONE =>
  v >= 80 ? "strong" : v >= 60 ? "medium" : "weak";

// All recharts inputs are hoisted/memoized — identity churn on data/domain/
// margin restarts mount animations whose effect cleanup calls setState, which
// can cascade into "Maximum update depth exceeded" (see sparkline.tsx).
const EMPTY_CONFIG: ChartConfig = {};
const DOMAIN: [number, number] = [0, 100];
const MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };
/** Full-width track behind the bar. */
const TRACK = { fill: "var(--color-zinc-400)", fillOpacity: 0.3, radius: 4 };

interface StrengthBarProps {
  value: number;
  showValue?: boolean;
  barWidth?: string;
  barHeight?: string;
  className?: string;
}

/** Signal-strength meter (0-100) as a single horizontal recharts bar. */
export const StrengthBar = memo(function StrengthBar({
  value,
  showValue = true,
  barWidth = "flex-1",
  barHeight = "h-2",
  className,
}: StrengthBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const tone = TONE[toneOf(clamped)];
  const data = useMemo(() => [{ v: clamped }], [clamped]);

  return (
    <div className={cn("pointer-events-none flex select-none items-center gap-2", className)}>
      <ChartContainer
        config={EMPTY_CONFIG}
        className={cn("aspect-auto", barHeight, barWidth)}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={MARGIN}
          barCategoryGap={0}
          accessibilityLayer={false}
        >
          <XAxis type="number" hide domain={DOMAIN} />
          <YAxis type="category" hide />
          <Bar
            dataKey="v"
            fill={tone.fill}
            radius={4}
            background={TRACK}
            animationDuration={700}
          />
        </BarChart>
      </ChartContainer>
      {showValue && (
        <span
          className={cn(
            "text-mono-data text-xs font-semibold shrink-0",
            tone.text,
          )}
        >
          {clamped}%
        </span>
      )}
    </div>
  );
});
