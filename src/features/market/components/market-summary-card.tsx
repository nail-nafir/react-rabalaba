import { cn } from "@/lib/utils";
import { MiniSparkline } from "@/components/charts/mini-sparkline";
import { PercentageChange } from "@/components/shared/percentage-change";
import { TrendIndicator } from "@/components/shared/trend-indicator";
import type { TrendDirection } from "@/types/market";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MarketSummaryCardProps {
  name: string;
  value: string;
  change: number;
  trend: TrendDirection;
  sparkline?: number[];
  className?: string;
}

const TREND_STYLES: Record<TrendDirection, string> = {
  bullish: "bg-emerald-500/10 text-emerald-400",
  bearish: "bg-red-500/10 text-red-400",
  neutral: "bg-zinc-500/10 text-zinc-400",
};

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
        <Badge
          variant="outline"
          className={cn(
            "font-bold uppercase tracking-wider text-[10px] border-transparent rounded-md",
            TREND_STYLES[trend],
          )}
        >
          {trend}
        </Badge>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        <div className="text-2xl font-bold text-mono-data tracking-tight mb-2 text-foreground">
          {value}
        </div>

        <div className="flex items-center justify-between mt-auto pt-2">
          <div className="flex items-center gap-2">
            <TrendIndicator trend={trend} showLabel={false} />
            <PercentageChange
              value={change}
              className="text-xs font-semibold"
            />
          </div>
          {sparkline && sparkline.length > 1 && (
            <MiniSparkline data={sparkline} width={60} height={20} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
