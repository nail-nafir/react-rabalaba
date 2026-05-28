import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface MiniSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export function MiniSparkline({
  data,
  width = 80,
  height = 32,
  color,
  className,
}: MiniSparklineProps) {
  const pathData = useMemo(() => {
    if (!data || data.length < 2) return '';

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;

    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return { x, y };
    });

    const d = points.reduce((acc, point, i) => {
      if (i === 0) return `M ${point.x} ${point.y}`;
      return `${acc} L ${point.x} ${point.y}`;
    }, '');

    return d;
  }, [data, width, height]);

  // Determine color based on trend (last vs first)
  const isPositive = data.length >= 2 && data[data.length - 1] >= data[0];
  const strokeColor = color || (isPositive ? '#10b981' : '#f43f5e');

  if (!data || data.length < 2) {
    return <div className={cn('bg-muted/20 rounded', className)} style={{ width, height }} />;
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`sparkline-grad-${strokeColor}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.2" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Fill area */}
      <path
        d={`${pathData} L ${width - 2} ${height} L 2 ${height} Z`}
        fill={`url(#sparkline-grad-${strokeColor})`}
      />
      {/* Line */}
      <path
        d={pathData}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
