import { cn } from "@/lib/utils";

interface FearGreedBarProps {
  value: number;
  label?: string;
  change?: number;
  className?: string;
}

export function FearGreedBar({ value, label, change, className }: FearGreedBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  const getColor = () => {
    if (clampedValue <= 20) return "#f43f5e";
    if (clampedValue <= 40) return "#f97316";
    if (clampedValue <= 60) return "#f59e0b";
    if (clampedValue <= 80) return "#84cc16";
    return "#10b981";
  };

  const getLabel = () => {
    if (label) return label;
    if (clampedValue <= 20) return "Extreme Fear";
    if (clampedValue <= 40) return "Fear";
    if (clampedValue <= 60) return "Neutral";
    if (clampedValue <= 80) return "Greed";
    return "Extreme Greed";
  };

  const color = getColor();
  const currentLabel = getLabel();

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-baseline justify-between mb-2 w-full">
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-[10px] font-bold tabular-nums leading-none"
            style={{ color }}
          >
            {clampedValue}
          </span>
          <span
            className="text-[10px] font-bold uppercase tracking-widest leading-none"
            style={{ color }}
          >
            {currentLabel}
          </span>
        </div>
        {change !== undefined && (
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest leading-none",
              change > 0 ? "text-emerald-400" : change < 0 ? "text-rose-400" : "",
            )}
            style={change === 0 ? { color } : undefined}
          >
            {change > 0 ? `+${change}` : change}
          </span>
        )}
      </div>

      <div className="relative h-2.5 w-full rounded-md overflow-hidden mb-2">
        <div className="absolute inset-0 bg-linear-to-r from-rose-500 via-amber-500 to-emerald-500 opacity-30" />
        <div
          className="absolute top-0 bottom-0 w-1.5 bg-foreground z-20 transition-all duration-700 ease-out"
          style={{ left: `${clampedValue}%`, transform: "translateX(-50%)" }}
        />
        <div
          className="absolute top-0 bottom-0 left-0 transition-all duration-700 ease-out opacity-40 z-10"
          style={{ width: `${clampedValue}%`, backgroundColor: color }}
        />
      </div>

      <div className="flex justify-between text-[7px] font-bold text-muted-foreground uppercase tracking-widest px-0.5">
        <span>Fear</span>
        <span>Neutral</span>
        <span>Greed</span>
      </div>
    </div>
  );
}
