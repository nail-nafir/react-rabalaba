import { useEffect, useState } from "react";

interface StrengthBarProps {
  value: number;
  showValue?: boolean;
  barWidth?: string;
  barHeight?: string;
  className?: string;
}

export function StrengthBar({
  value,
  showValue = true,
  barWidth = "flex-1",
  barHeight = "h-2",
  className,
}: StrengthBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const color =
    clamped >= 80
      ? "#10b981"
      : clamped >= 60
        ? "#f59e0b"
        : "#f43f5e";

  const [animatedWidth, setAnimatedWidth] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimatedWidth(clamped));
    return () => cancelAnimationFrame(raf);
  }, [clamped]);

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <div
        className={`relative rounded-sm bg-muted-foreground/30 overflow-hidden ${barHeight} ${barWidth}`}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-sm"
          style={{
            width: `${animatedWidth}%`,
            backgroundColor: color,
            transition: "width 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>
      {showValue && (
        <span
          className="text-mono-data text-xs font-semibold shrink-0"
          style={{ color }}
        >
          {clamped}%
        </span>
      )}
    </div>
  );
}
