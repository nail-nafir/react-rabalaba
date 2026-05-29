import { cn } from '@/lib/utils';

interface PercentageChangeProps {
  value: number;
  className?: string;
}

export function PercentageChange({ value, className }: PercentageChangeProps) {
  const isPositive = value > 0;
  const isNeutral = value === 0;

  return (
    <span
      className={cn(
        'text-mono-data font-medium tabular-nums',
        isPositive ? 'text-emerald-400' : isNeutral ? 'text-zinc-400' : 'text-rose-400',
        className
      )}
    >
      {isPositive ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  );
}
