import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { PALETTE } from "@/constants";

const EMPTY_CONFIG: ChartConfig = {};
const DOMAIN: [number, number] = [0, 100];
const MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };
const MINI_BAR_DIMENSION = { width: 64, height: 8 } as const;

interface StrengthBarProps {
  value: number;
  showValue?: boolean;
  barWidth?: string;
  barHeight?: string;
  className?: string;
}

/** Signal-strength meter (0-100) as a single horizontal Recharts bar. */
export const StrengthBar = memo(function StrengthBar({
  value,
  showValue = true,
  barWidth = "flex-1",
  barHeight = "h-2",
  className,
}: StrengthBarProps) {
  const { t } = useTranslation();
  const clamped = Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : 0;
  const tone =
    clamped >= 80
      ? PALETTE.positive
      : clamped >= 60
        ? PALETTE.warning
        : PALETTE.negative;
  const data = useMemo(() => [{ value: clamped }], [clamped]);

  return (
    <div
      role="meter"
      aria-label={t("table.strength")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn(
        "pointer-events-none flex select-none items-center gap-2",
        className,
      )}
    >
      <ChartContainer
        config={EMPTY_CONFIG}
        initialDimension={MINI_BAR_DIMENSION}
        className={cn(
          "aspect-auto rounded-lg bg-zinc-400/20",
          barHeight,
          barWidth,
        )}
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
            dataKey="value"
            fill={tone.fill}
            radius={4}
            isAnimationActive="auto"
            animationDuration={700}
          />
        </BarChart>
      </ChartContainer>
      {showValue && (
        <span className={cn("shrink-0 text-xs font-semibold", tone.text)}>
          {clamped}%
        </span>
      )}
    </div>
  );
});
