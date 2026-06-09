import { PieChart, Pie, Cell } from "recharts";

interface DominanceChartProps {
  btc: number;
  eth: number;
  others: number;
  width?: number;
  height?: number;
}

export function DominanceChart({
  btc,
  eth,
  others,
  width = 80,
  height = 80,
}: DominanceChartProps) {
  const getHex = (val: number) => {
    if (val <= 20) return "#f43f5e";
    if (val <= 40) return "#f97316";
    if (val <= 60) return "#f59e0b";
    if (val <= 80) return "#84cc16";
    return "#10b981";
  };

  const data = [
    { name: "BTC", value: btc, color: getHex(btc) },
    { name: "ETH", value: eth, color: getHex(eth) },
    { name: "Others", value: others, color: "var(--muted-foreground)" },
  ].filter((d) => d.value > 0);

  const innerRadius = Math.round(width * 0.28);
  const outerRadius = Math.round(width * 0.42);

  return (
    <PieChart width={width} height={height}>
      <Pie
        data={[{ value: 100 }]}
        cx="50%"
        cy="50%"
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        dataKey="value"
        strokeWidth={0}
        fill="var(--muted-foreground)"
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
