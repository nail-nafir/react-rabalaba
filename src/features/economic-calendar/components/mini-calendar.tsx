import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatLocalDate } from "@/lib/formatters";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CalendarEvent } from "@/types/calendar";
import i18n from "@/app/config/i18n";

interface MiniCalendarProps {
  events: CalendarEvent[];
  onDateClick: (date: string) => void;
  currentDate: Date;
  onMonthChange: (date: Date) => void;
  selectedDate?: string | null;
  onResetDate?: () => void;
}

export function MiniCalendar({
  events,
  onDateClick,
  currentDate,
  onMonthChange,
  selectedDate,
  onResetDate,
}: MiniCalendarProps) {
  const { t } = useTranslation();
  const monthStart = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1,
  );
  const monthEnd = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0,
  );
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const calendarDays = [];
  const tempDate = new Date(startDate);
  while (tempDate <= monthEnd || calendarDays.length % 7 !== 0) {
    calendarDays.push(new Date(tempDate));
    tempDate.setDate(tempDate.getDate() + 1);
  }

  // Precompute highest impact and event count per date
  const dateMeta = useMemo(() => {
    const map: Record<
      string,
      { count: number; highestImpact: "high" | "medium" | "low" }
    > = {};
    events.forEach((e) => {
      if (!map[e.date]) {
        map[e.date] = { count: 1, highestImpact: e.impact };
      } else {
        map[e.date].count += 1;
        if (
          e.impact === "high" ||
          (e.impact === "medium" && map[e.date].highestImpact === "low")
        ) {
          map[e.date].highestImpact = e.impact;
        }
      }
    });
    return map;
  }, [events]);

  const changeMonth = (offset: number) => {
    onMonthChange(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1),
    );
  };

  const jumpToToday = () => {
    const today = new Date();
    onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1));
    const todayStr = formatLocalDate(today);
    if (dateMeta[todayStr]) {
      onDateClick(todayStr);
    }
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  return (
    <Card className="border transition-all duration-300 bg-card/60 backdrop-blur-md w-full border-border/80 shadow-xs hover:border-zinc-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between w-full">
          <CardTitle className="text-sm font-bold text-foreground capitalize">
            {currentDate.toLocaleDateString(
              i18n.language === "id" ? "id-ID" : "en-US",
              {
                month: "long",
                year: "numeric",
              },
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => changeMonth(-1)}
              className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              aria-label="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => changeMonth(1)}
              className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              aria-label="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-2 px-3 pt-0 pb-3">
        <div className="grid grid-cols-7 gap-1 text-center">
          {[
            t("calendar.days.su"),
            t("calendar.days.mo"),
            t("calendar.days.tu"),
            t("calendar.days.we"),
            t("calendar.days.th"),
            t("calendar.days.fr"),
            t("calendar.days.sa"),
          ].map((day, i) => (
            <span
              key={i}
              className="text-[10px] font-bold text-muted-foreground/60 py-1 select-none"
            >
              {day}
            </span>
          ))}
          {calendarDays.map((date, i) => {
            const dateStr = formatLocalDate(date);
            const meta = dateMeta[dateStr];
            const hasEvents = !!meta;
            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
            const isSelected = selectedDate === dateStr;
            const today = isToday(date);

            const dotColor =
              meta?.highestImpact === "high"
                ? "bg-rose-500"
                : meta?.highestImpact === "medium"
                  ? "bg-amber-500"
                  : "bg-emerald-500";

            return (
              <button
                key={i}
                type="button"
                onClick={() => hasEvents && onDateClick(dateStr)}
                disabled={!hasEvents}
                title={
                  hasEvents
                    ? `${meta.count} ${t("calendar.events_found")} (${meta.highestImpact})`
                    : undefined
                }
                className={cn(
                  "relative flex flex-col items-center justify-center h-8.5 w-full rounded-md text-xs transition-all select-none",
                  !isCurrentMonth && "opacity-25",
                  isSelected
                    ? "bg-primary text-primary-foreground font-bold shadow-xs cursor-pointer"
                    : today
                      ? "ring-1 ring-primary/80 text-primary font-bold hover:bg-primary/10 cursor-pointer"
                      : hasEvents
                        ? "hover:bg-muted font-medium text-foreground cursor-pointer"
                        : "cursor-default text-muted-foreground/35 hover:bg-transparent",
                )}
              >
                <span>{date.getDate()}</span>
                {hasEvents && (
                  <span
                    className={cn(
                      "absolute bottom-1 h-1 w-1 rounded-full transition-transform",
                      isSelected ? "bg-primary-foreground" : dotColor,
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2.5 border-t border-border/60 p-3 bg-muted/20">
        {/* Dot impact legend */}
        <div className="flex items-center justify-between w-full text-[10px] text-muted-foreground">
          <span className="font-semibold uppercase tracking-wider text-[9px]">
            {t("calendar.agenda")}:
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              <span>{t("calendar.impact.high")}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span>{t("calendar.impact.medium")}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>{t("calendar.impact.low")}</span>
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between w-full pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={jumpToToday}
            className="h-6 px-2 text-[10px] font-bold uppercase tracking-wider cursor-pointer text-muted-foreground hover:text-foreground"
          >
            {t("calendar.today")}
          </Button>

          {selectedDate && onResetDate && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResetDate}
              className="h-6 px-2 text-[10px] font-bold uppercase tracking-wider cursor-pointer border-border text-primary hover:bg-primary/10"
            >
              {t("calendar.reset_filter")}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
