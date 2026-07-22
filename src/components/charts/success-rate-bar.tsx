import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PALETTE } from "@/constants";

const EMPTY_CONFIG: ChartConfig = {};
const DOMAIN: [number, number] = [0, 100];
const MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };

interface SuccessRateBarProps {
  wins: number;
  total: number;
  showValue?: boolean;
  barWidth?: string;
  barHeight?: string;
  className?: string;
}

/** Two-sided stacked Success Rate bar chart (success/wins vs failure/losses). */
export const SuccessRateBar = memo(function SuccessRateBar({
  wins,
  total,
  showValue = true,
  barWidth = "flex-1",
  barHeight = "h-2",
  className,
}: SuccessRateBarProps) {
  const { t } = useTranslation();
  const successPercent = total > 0 ? (wins / total) * 100 : 0;
  const failurePercent = total > 0 ? 100 - successPercent : 0;

  const data = useMemo(
    () => [
      {
        success: successPercent,
        failure: failurePercent,
      },
    ],
    [successPercent, failurePercent],
  );

  // Color logic matching our grade/tier colors
  let textColor = PALETTE.negative.textStrong;
  if (successPercent >= 60) {
    textColor = PALETTE.positive.textStrong;
  } else if (successPercent >= 45) {
    textColor = PALETTE.warning.textStrong;
  }

  return (
    <div
      role="img"
      aria-label={
        total > 0
          ? t("table.successrate_summary", {
              percent: successPercent.toFixed(0),
              wins,
              total,
            })
          : t("table.successrate_new_data_description")
      }
      className={cn(
        "pointer-events-none flex select-none items-center gap-2",
        className,
      )}
    >
      {total > 0 ? (
        <ChartContainer
          config={EMPTY_CONFIG}
          aria-hidden="true"
          className={cn(
            "aspect-auto overflow-hidden rounded-full bg-muted-foreground/20",
            barHeight,
            barWidth,
          )}
        >
          <BarChart
            data={data}
            layout="vertical"
            margin={MARGIN}
            barCategoryGap={0}
            accessibilityLayer={false}
          >
            <XAxis type="number" hide domain={DOMAIN} />
            <YAxis type="category" hide />
            <Bar
              dataKey="success"
              stackId="a"
              fill={PALETTE.positive.fill}
              radius={[4, 0, 0, 4]}
              animationDuration={700}
            />
            <Bar
              dataKey="failure"
              stackId="a"
              fill={PALETTE.negative.fill}
              radius={[0, 4, 4, 0]}
              animationDuration={700}
            />
          </BarChart>
        </ChartContainer>
      ) : (
        <div
          className={cn(
            "rounded-full bg-muted-foreground/20",
            barHeight,
            barWidth,
          )}
        />
      )}
      {showValue &&
        (total > 0 ? (
          <div className="flex shrink-0 flex-col items-start gap-1 leading-none">
            <span
              className={cn(
                "text-sm font-bold leading-none tracking-tight",
                textColor,
              )}
            >
              {`${successPercent.toFixed(0)}%`}
            </span>
            {/* Second row matches the journal P&L column's TP-progress line
                exactly (size + weight + mono + color) so the two read as one. */}
            <span className="text-xs text-muted-foreground">
              {t("table.successrate_sample", { wins, total })}
            </span>
          </div>
        ) : (
          /* A genuine zero-sample state, never an entitlement placeholder. */
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 rounded-md text-[10px] font-bold uppercase tracking-wider",
              PALETTE.neutral.bg,
              PALETTE.neutral.text,
              PALETTE.neutral.border,
            )}
            title={t("table.successrate_new_data_description")}
          >
            {t("table.successrate_new_data")}
          </Badge>
        ))}
    </div>
  );
});
