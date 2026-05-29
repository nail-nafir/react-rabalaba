import { cn } from '@/lib/utils';
import type { TrendDirection } from '@/types/market';
import { TREND_DISPLAY } from '@/constants/signals';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TrendIndicatorProps {
  trend: TrendDirection;
  showLabel?: boolean;
  className?: string;
}

const TREND_ICONS = {
  bullish: TrendingUp,
  bearish: TrendingDown,
  sideways: Minus,
};

export function TrendIndicator({ trend, showLabel = true, className }: TrendIndicatorProps) {
  const display = TREND_DISPLAY[trend];
  const Icon = TREND_ICONS[trend];

  return (
    <span className={cn('inline-flex items-center gap-1', display.text, className)}>
      <Icon className="h-3.5 w-3.5" />
      {showLabel && (
        <span className="text-xs font-medium">{display.label}</span>
      )}
    </span>
  );
}
