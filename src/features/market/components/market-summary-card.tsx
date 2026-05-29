import { cn } from "@/lib/utils";
import { MiniSparkline } from "@/components/charts/mini-sparkline";
import { PercentageChange } from "@/components/shared/percentage-change";
import { TrendIndicator } from "@/components/shared/trend-indicator";
import type { TrendDirection } from "@/types/market";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MarketSummaryCardProps {
  name: string;
  value: string;
  change: number;
  trend: TrendDirection;
  sparkline?: number[];
  className?: string;
}

export function MarketSummaryCard({
  name,
  value,
  change,
  trend,
  sparkline,
  className,
}: MarketSummaryCardProps) {
  return (
    <Card
      className={cn(
        "group flex flex-col min-w-50 shadow-sm bg-muted border border-border hover:shadow-md transition-all duration-200",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {name}
        </CardTitle>
        <TrendIndicator trend={trend} />
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        <div className="text-2xl font-bold text-mono-data tracking-tight mb-2 text-foreground">
          {value}
        </div>

        <div className="flex items-center justify-between mt-auto pt-2">
          <PercentageChange value={change} className="text-xs font-semibold" />
          {sparkline && sparkline.length > 1 && (
            <MiniSparkline data={sparkline} width={60} height={20} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
