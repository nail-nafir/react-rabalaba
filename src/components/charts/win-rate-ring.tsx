import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";

const POS = "var(--color-emerald-400)";
const NEG = "var(--color-rose-400)";

// All recharts inputs are hoisted/memoized — identity churn on data/domain/
// margin restarts mount animations whose effect cleanup calls setState, which
// can cascade into "Maximum update depth exceeded" (see sparkline.tsx).
const SIZE = 112; // matches the old h-28 w-28 ring
const DOMAIN: [number, number] = [0, 100];
const MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };
/** Full-circle track behind the arc. */
const TRACK = { fill: "var(--color-zinc-400)", fillOpacity: 0.15 };

interface WinRateRingProps {
  /** Win rate in [0..1]. */
  value: number;
  /** Small caption under the percentage (e.g. trade count). */
  label: string;
}

/**
 * Backtest win-rate donut: a radial bar sweeping clockwise from 12 o'clock,
 * green when the rate is >= 50%, red below, with the rate overlaid in the
 * center.
 */
export const WinRateRing = memo(function WinRateRing({
  value,
  label,
}: WinRateRingProps) {
  const { t } = useTranslation();
  const pct = Math.min(1, Math.max(0, value));
  const data = useMemo(
    () => [{ v: pct * 100, fill: pct >= 0.5 ? POS : NEG }],
    [pct],
  );

  return (
    <div className="pointer-events-none relative flex h-28 w-28 shrink-0 select-none items-center justify-center">
      <RadialBarChart
        width={SIZE}
        height={SIZE}
        data={data}
        startAngle={90}
        endAngle={-270}
        innerRadius={42}
        outerRadius={52}
        margin={MARGIN}
        accessibilityLayer={false}
      >
        <PolarAngleAxis
          type="number"
          domain={DOMAIN}
          tick={false}
          axisLine={false}
        />
        <RadialBar dataKey="v" barSize={10} cornerRadius={5} background={TRACK} />
      </RadialBarChart>
      <div className="absolute flex flex-col items-center">
        <span className="text-[9px] font-semibold tracking-wide text-muted-foreground">
          {t("dialog.bt_success_rate")}
        </span>
        <span className="text-xl font-bold text-mono-data">
          {Math.round(value * 100)}%
        </span>
        <span className="px-2 text-center text-[9px] leading-tight text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  );
});
