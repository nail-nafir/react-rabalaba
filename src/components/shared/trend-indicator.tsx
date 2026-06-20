import { cn } from '@/lib/utils';
import type { TrendDirection } from '@/types/market';
import { TREND_DISPLAY } from '@/constants';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TrendIndicatorProps {
  trend: TrendDirection;
  showLabel?: boolean;
  className?: string;
  meta?: string;
  showBar?: boolean;
}

const TREND_ICONS = {
  bullish: TrendingUp,
  bearish: TrendingDown,
  sideways: Minus,
};

export function TrendIndicator({
  trend,
  showLabel = true,
  className,
  meta,
  showBar = true,
}: TrendIndicatorProps) {
  const display = TREND_DISPLAY[trend];
  const Icon = TREND_ICONS[trend];

  const miniBar = (pct: number) => {
    const barColor = pct >= 60 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-rose-500";
    return (
      <span className="inline-flex items-center gap-1.5 ml-1.5">
        <span className="relative h-1.5 w-10 rounded-full bg-muted overflow-hidden">
          <span
            className={cn("absolute inset-y-0 left-0 rounded-full transition-all", barColor)}
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className="text-[10px] font-bold tabular-nums text-mono-data">{meta}</span>
      </span>
    );
  };

  return (
    <span className={cn('inline-flex items-center gap-1', display.text, className)}>
      <Icon className="h-3.5 w-3.5" />
      {showLabel && (
        <span className="text-xs font-medium">
          {display.label}
          {meta && (showBar ? (
            miniBar(parseInt(meta))
          ) : (
            <span className="text-[10px] font-bold tabular-nums text-mono-data ml-1.5">
              {meta}%
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
