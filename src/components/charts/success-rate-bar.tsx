import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
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

  const data = useMemo(() => [{
    success: successPercent,
    failure: failurePercent,
  }], [successPercent, failurePercent]);

  // Color logic matching our grade/tier colors
  let textColor = PALETTE.negative.textStrong;
  if (successPercent >= 60) {
    textColor = PALETTE.positive.textStrong;
  } else if (successPercent >= 45) {
    textColor = PALETTE.warning.textStrong;
  }

  return (
    <div
      className={cn(
        "pointer-events-none flex select-none items-center gap-2",
        className,
      )}
    >
      {total > 0 ? (
        <ChartContainer
          config={EMPTY_CONFIG}
          className={cn(
            "aspect-auto bg-zinc-400/20 rounded-lg overflow-hidden",
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
            "bg-zinc-400/20 rounded-lg",
            barHeight,
            barWidth,
          )}
        />
      )}
      {showValue &&
        (total > 0 ? (
          <div className="flex flex-col items-start font-mono gap-1 leading-none shrink-0">
            <span
              className={cn("text-sm font-semibold leading-none", textColor)}
            >
              {`${successPercent.toFixed(0)}%`}
            </span>
            {/* Second row matches the journal P&L column's TP-progress line
                exactly (size + weight + mono + color) so the two read as one. */}
            <span className="text-[10px] font-semibold text-mono-data uppercase tracking-wider text-foreground">
              {`${wins}/${total}`}
            </span>
          </div>
        ) : (
          /* No CLOSED trade yet → no track record to rate. Show a muted "Baru"
             badge instead of a bare "—" so an empty history reads as a status
             (no data), never as a genuine 0% win rate. */
          <span
            className={cn(
              "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              PALETTE.neutral.bg,
              PALETTE.neutral.border,
              PALETTE.neutral.text,
            )}
          >
            {t("common.new")}
          </span>
        ))}
    </div>
  );
});
