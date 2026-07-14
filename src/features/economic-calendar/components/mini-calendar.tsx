import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatLocalDate } from "@/lib/formatters";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
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
}

export function MiniCalendar({
  events,
  onDateClick,
  currentDate,
  onMonthChange,
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

  const eventsByDate = useMemo(() => {
    const map: Record<string, boolean> = {};
    events.forEach((e) => {
      map[e.date] = true;
    });
    return map;
  }, [events]);

  const changeMonth = (offset: number) => {
    onMonthChange(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1),
    );
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
    <Card className="border transition-all duration-300 bg-card/45 backdrop-blur-xs w-full border-border hover:border-zinc-700">
      <CardHeader>
        <CardTitle className="text-sm font-bold text-foreground">
          {currentDate.toLocaleDateString(
            i18n.language === "id" ? "id-ID" : "en-US",
            {
              month: "long",
              year: "numeric",
            },
          )}
        </CardTitle>
        <CardAction>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => changeMonth(-1)}
              className="h-8 w-8 rounded-md text-muted-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => changeMonth(1)}
              className="h-8 w-8 rounded-md text-muted-foreground transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 px-4 pt-0">
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
              className="text-[10px] font-bold text-muted-foreground/60 py-1"
            >
              {day}
            </span>
          ))}
          {calendarDays.map((date, i) => {
            const dateStr = formatLocalDate(date);
            const hasEvents = eventsByDate[dateStr];
            const isCurrentMonth = date.getMonth() === currentDate.getMonth();

            return (
              <Button
                key={i}
                variant="ghost"
                onClick={() => hasEvents && onDateClick(dateStr)}
                disabled={!hasEvents}
                className={cn(
                  "relative flex flex-col items-center justify-center h-9 w-full p-0 rounded-md text-xs transition-all",
                  !isCurrentMonth && "opacity-20",
                  isToday(date) &&
                    "bg-primary/10 text-primary font-bold hover:bg-primary/20",
                  hasEvents
                    ? "hover:bg-primary/5 cursor-pointer"
                    : "cursor-default text-muted-foreground/40 hover:bg-transparent",
                )}
              >
                {date.getDate()}
                {hasEvents && (
                  <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-primary" />
                )}
              </Button>
            );
          })}
        </div>
      </CardContent>

      <CardFooter className="mt-auto flex items-center justify-between gap-3 border-t border-border/40 pt-3">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          {t("calendar.scheduled_event")}
        </div>
      </CardFooter>
    </Card>
  );
}
