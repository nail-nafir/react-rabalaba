import { cn } from "@/lib/utils";

interface SignalStrengthMeterProps {
  value: number; // 0-100 technical alignment, NOT a probability of profit
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function SignalStrengthMeter({
  value,
  size = "md",
  showLabel = true,
  className,
}: SignalStrengthMeterProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  const getColor = () => {
    if (clampedValue >= 80) return "text-emerald-400";
    if (clampedValue >= 60) return "text-amber-400";
    return "text-rose-400";
  };

  const getBarColor = () => {
    if (clampedValue >= 80) return "bg-emerald-400";
    if (clampedValue >= 60) return "bg-amber-400";
    return "bg-rose-400";
  };

  const sizeClasses = {
    sm: "h-1",
    md: "h-1.5",
    lg: "h-2",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("flex-1 rounded-md bg-muted/50", sizeClasses[size])}>
        <div
          className={cn(
            "h-full rounded-md transition-all duration-500",
            getBarColor(),
          )}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      {showLabel && (
        <span
          className={cn("text-mono-data text-xs font-semibold", getColor())}
        >
          {clampedValue}%
        </span>
      )}
    </div>
  );
}
