import { useMemo } from "react";
import { PieChart, Pie, Cell } from "recharts";

interface DominanceChartProps {
  btc: number;
  eth: number;
  others: number;
  width?: number;
  height?: number;
}

const getColor = (val: number) => {
  if (val <= 20) return "var(--color-rose-400)";
  if (val <= 40) return "var(--color-orange-400)";
  if (val <= 60) return "var(--color-amber-400)";
  if (val <= 80) return "var(--color-lime-400)";
  return "var(--color-emerald-400)";
};

// Hoisted so the background ring keeps a stable data identity — recharts
// re-runs its mount animation (with setState in effect cleanup) whenever a
// pie's `data` reference changes.
const BACKGROUND_RING = [{ value: 100 }];

export function DominanceChart({
  btc,
  eth,
  others,
  width = 80,
  height = 80,
}: DominanceChartProps) {
  const data = useMemo(
    () =>
      [
        { name: "BTC", value: btc, color: getColor(btc) },
        { name: "ETH", value: eth, color: getColor(eth) },
        { name: "Others", value: others, color: "var(--color-zinc-400)" },
      ].filter((d) => d.value > 0),
    [btc, eth, others],
  );

  const innerRadius = Math.round(width * 0.28);
  const outerRadius = Math.round(width * 0.42);

  return (
    <PieChart width={width} height={height}>
      <Pie
        data={BACKGROUND_RING}
        cx="50%"
        cy="50%"
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        dataKey="value"
        strokeWidth={0}
        fill="var(--color-zinc-400)"
        opacity={0.3}
      />
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        dataKey="value"
        strokeWidth={0}
      >
        {data.map((entry, i) => (
          <Cell
            key={i}
            fill={entry.color}
            opacity={entry.name === "Others" ? 0.3 : 1}
          />
        ))}
      </Pie>
    </PieChart>
  );
}
