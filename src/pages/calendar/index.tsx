import { useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn, getEmojiFlag } from "@/lib/utils";
import { FilterGroup } from "@/components/shared/filter-group";
import { IMPACT_LEVELS } from "@/constants/calendar";
import {
  CalendarDays,
  AlertTriangle,
  ChevronRight,
  Info,
  Loader2,
  ChevronLeft,
} from "lucide-react";
import { useEconomicCalendar } from "@/services/queries/use-calendar-data";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SkeletonCalendarItem } from "@/components/shared/skeleton-card";
import type { CalendarEvent, EventImpact } from "@/types/calendar";
import { t } from "i18next";
import i18n from "@/app/config/i18n";

type ImpactFilter = EventImpact | "all";

const IMPACT_OPTIONS = Object.entries(IMPACT_LEVELS).map(
  ([value, { label }]) => ({
    value: value as ImpactFilter,
    label,
  }),
);

/**
 * Helper to format a Date object as YYYY-MM-DD in local time
 */
const formatLocalDate = (date: Date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export default function CalendarPage() {
  const { t, i18n } = useTranslation();
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("all");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const timelineRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { data: allEvents = [], isLoading } = useEconomicCalendar();

  const filteredEvents = useMemo(() => {
    return allEvents
      .filter((e) => {
        // e.date is "YYYY-MM-DD" from API
        const [year, month] = e.date.split("-").map(Number);
        return (
          month === viewDate.getMonth() + 1 && year === viewDate.getFullYear()
        );
      })
      .filter((e) => impactFilter === "all" || e.impact === impactFilter);
  }, [allEvents, impactFilter, viewDate]);

  const groupedEvents = useMemo(() => {
    const groups: Record<string, CalendarEvent[]> = {};
    filteredEvents.forEach((event) => {
      if (!groups[event.date]) groups[event.date] = [];
      groups[event.date].push(event);
    });
    return groups;
  }, [filteredEvents]);

  const selectedEvent = useMemo(
    () => allEvents.find((e) => e.id === selectedEventId),
    [allEvents, selectedEventId],
  );

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEventId(event.id);
    setIsDetailOpen(true);
  };

  const scrollToDate = (dateStr: string) => {
    const element = timelineRefs.current[dateStr];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="w-full py-6 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {t("calendar.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("calendar.subtitle")}
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar: Visual Calendar - Shown first on mobile */}
          <div className="w-full lg:w-80 space-y-6 order-first lg:order-last">
            <div className="sticky top-24">
              <MiniCalendar
                events={allEvents}
                onDateClick={scrollToDate}
                currentDate={viewDate}
                onMonthChange={setViewDate}
              />
            </div>
          </div>

          {/* Timeline View */}
          <div className="flex-1 min-w-0 space-y-8">
            <div className="flex flex-row items-center justify-between gap-4 border-b pb-4 mb-2 overflow-hidden">
              <FilterGroup
                value={impactFilter}
                options={IMPACT_OPTIONS}
                onChange={(v) => setImpactFilter(v as ImpactFilter)}
              />

              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 shrink-0">
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <span className="whitespace-nowrap">
                    {filteredEvents.length} {t("calendar.events_found")}
                  </span>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <SkeletonCalendarItem key={i} />
                ))}
              </div>
            ) : Object.keys(groupedEvents).length === 0 ? (
              <div className="w-full flex items-center justify-center border rounded-xl py-20 border-dashed">
                <EmptyState
                  title={t("calendar.no_events")}
                  description="Try adjusting your filters or choosing another date."
                  icon={
                    <CalendarDays className="h-10 w-10 text-muted-foreground/20" />
                  }
                />
              </div>
            ) : (
              Object.entries(groupedEvents).map(([date, events]) => (
                <div
                  key={date}
                  className="space-y-4 pt-4 scroll-mt-18"
                  ref={(el) => {
                    timelineRefs.current[date] = el;
                  }}
                >
                  <div className="flex items-center gap-4">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-primary">
                      {new Date(date).toLocaleDateString(
                        i18n.language === "id" ? "id-ID" : "en-US",
                        {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        },
                      )}
                    </h3>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <div className="grid gap-3">
                    {events.map((event) => (
                      <Card
                        key={event.id}
                        className={cn(
                          "border border-border bg-muted hover:bg-muted/80 transition-colors cursor-pointer",
                        )}
                        onClick={() => handleEventClick(event)}
                      >
                        <CardContent className="flex items-center gap-3 sm:gap-4">
                          <div className="flex flex-col items-start min-w-12 sm:min-w-15 shrink-0">
                            <span className="text-xs font-bold text-foreground">
                              {event.time.split(" ")[0]}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 min-w-0">
                              <span className="text-sm font-bold truncate text-foreground group-hover:text-primary transition-colors">
                                {selectedEvent?.id === event.id ? (
                                  <span className="text-primary">
                                    {event.title}
                                  </span>
                                ) : (
                                  event.title
                                )}
                              </span>
                              {event.impact === "high" && (
                                <AlertTriangle className="h-3.5 w-3.5 text-primary animate-pulse shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground truncate">
                                {getEmojiFlag(event.country)} {event.country}
                              </span>
                            </div>
                          </div>

                          <Badge
                            className={cn(
                              "text-[10px] uppercase font-bold rounded-md",
                              IMPACT_LEVELS[event.impact].badge,
                            )}
                          >
                            {event.impact}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detail Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
            {selectedEvent && (
              <div className="flex flex-col max-h-[85vh]">
                <DialogHeader className="p-6 pb-2 shrink-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="secondary"
                      className="text-[10px] rounded-md font-bold uppercase tracking-wider"
                    >
                      {getEmojiFlag(selectedEvent.country)}{" "}
                      {selectedEvent.country}
                    </Badge>
                    <Badge
                      className={cn(
                        "text-[10px] rounded-md font-bold uppercase tracking-wider",
                        IMPACT_LEVELS[selectedEvent.impact].badge,
                      )}
                    >
                      {selectedEvent.impact}
                    </Badge>
                  </div>
                  <DialogTitle className="text-xl font-bold leading-tight">
                    {selectedEvent.title}
                  </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 pt-2">
                  <div className="space-y-6">
                    <Card className="border border-border overflow-hidden">
                      <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4">
                        <DetailBox
                          label={t("calendar.detail.date")}
                          value={selectedEvent.date}
                        />
                        <DetailBox
                          label={t("calendar.detail.time")}
                          value={selectedEvent.time}
                        />
                        <DetailBox
                          label={t("calendar.detail.actual")}
                          value={selectedEvent.actual || "N/A"}
                        />
                        <DetailBox
                          label={t("calendar.detail.forecast")}
                          value={selectedEvent.forecast || "N/A"}
                        />
                        <DetailBox
                          label={t("calendar.detail.previous")}
                          value={selectedEvent.previous || "N/A"}
                        />
                      </CardContent>
                    </Card>

                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Info className="h-3.5 w-3.5 text-primary" />
                        {t("calendar.detail.market_context")}
                      </h4>
                      <p className="text-sm text-foreground/80 leading-relaxed italic border-l-2 border-primary/20 pl-3">
                        "{selectedEvent.description}"
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("calendar.detail.asset_correlation")}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedEvent.assetRelevance.map((asset) => (
                          <Badge
                            variant="secondary"
                            key={asset}
                            className="rounded-md text-[10px] font-bold uppercase tracking-wider"
                          >
                            {asset}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

/**
 * MiniCalendar Component
 */
function MiniCalendar({
  events,
  onDateClick,
  currentDate,
  onMonthChange,
}: {
  events: CalendarEvent[];
  onDateClick: (date: string) => void;
  currentDate: Date;
  onMonthChange: (date: Date) => void;
}) {
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
    <Card className="border border-border overflow-visible">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-sm font-bold text-foreground">
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
      </CardHeader>

      <CardContent className="p-5 pt-0 space-y-4">
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

      <CardFooter>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          {t("calendar.scheduled_event")}
        </div>
      </CardFooter>
    </Card>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
        {label}
      </span>
      <span className="text-xs font-bold text-mono-data text-foreground">
        {value}
      </span>
    </div>
  );
}
