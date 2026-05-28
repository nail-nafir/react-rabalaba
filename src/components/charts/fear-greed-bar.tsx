import { cn } from "@/lib/utils";

interface FearGreedBarProps {
  value: number; // 0-100
  label?: string;
  className?: string;
}

export function FearGreedBar({ value, label, className }: FearGreedBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  const getColor = () => {
    if (clampedValue <= 20) return "#ef4444"; // Extreme Fear
    if (clampedValue <= 40) return "#f97316"; // Fear
    if (clampedValue <= 60) return "#eab308"; // Neutral
    if (clampedValue <= 80) return "#84cc16"; // Greed
    return "#22c55e"; // Extreme Greed
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
    <div className={cn("w-full space-y-3", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-3xl font-bold tracking-tighter text-foreground tabular-nums">
          {clampedValue}
        </span>
        <span
          className="text-[10px] font-bold uppercase tracking-widest text-right leading-none"
          style={{ color }}
        >
          {currentLabel}
        </span>
      </div>

      <div className="relative h-2.5 w-full rounded-md bg-muted/20 overflow-hidden border border-border">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-linear-to-r from-red-500 via-yellow-500 to-emerald-500 opacity-30" />

        {/* Indicator Line */}
        <div
          className="absolute top-0 bottom-0 w-1.5 bg-foreground shadow-[0_0_8px_rgba(255,255,255,0.4)] z-20 transition-all duration-700 ease-out"
          style={{ left: `${clampedValue}%`, transform: "translateX(-50%)" }}
        />

        {/* Active Zone Fill */}
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
