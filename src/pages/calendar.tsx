import { useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { getEmojiFlag } from "@/lib/country";
import { FilterGroup } from "@/components/shared/filter-group";
import { IMPACT_LEVELS } from "@/constants/calendar";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useEconomicCalendar } from "@/services/queries/use-calendar-data";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SkeletonCalendarItem } from "@/components/shared/skeleton-card";
import { CalendarDetailDialog } from "@/features/economic-calendar/components/calendar-detail-dialog";
import { MiniCalendar } from "@/features/economic-calendar/components/mini-calendar";
import { Separator } from "@/components/ui/separator";
import type { CalendarEvent, EventImpact } from "@/types/calendar";

type ImpactFilter = EventImpact | "all";

export default function CalendarPage() {
  const { t, i18n } = useTranslation();
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("all");
  const [viewDate, setViewDate] = useState(new Date());
  const timelineRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { data: allEvents = [], isLoading } = useEconomicCalendar();

  const impactOptions = Object.keys(IMPACT_LEVELS).map((value) => ({
    value: value as ImpactFilter,
    label: t(IMPACT_LEVELS[value as ImpactFilter].labelKey),
  }));

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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground uppercase">
              {t("calendar.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("calendar.subtitle")}
            </p>
          </div>
        </div>

        <Separator />

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
            <div className="space-y-3">
              {/* Section title + events count */}
              <div className="flex flex-row items-center justify-between gap-4">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  {t("calendar.agenda")}
                </h2>
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

              {/* Impact filter */}
              <div className="border-b pb-4 overflow-hidden">
                <FilterGroup
                  className="shrink-0 min-w-0 sm:w-fit"
                  value={impactFilter}
                  options={impactOptions}
                  onChange={(v) => setImpactFilter(v as ImpactFilter)}
                />
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
                  description={t("calendar.no_events_desc")}
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
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        },
                      )}
                    </h3>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <div className="grid gap-3">
                    {events.map((event) => (
                      <CalendarDetailDialog
                        key={event.id}
                        event={event}
                        trigger={
                          <Card className="border border-border hover:bg-muted/50 hover:border-primary cursor-pointer">
                            <CardContent className="flex items-center gap-3 sm:gap-4">
                              <div className="flex flex-col items-start min-w-12 sm:min-w-15 shrink-0">
                                <span className="text-xs font-bold text-foreground">
                                  {event.time.split(" ")[0]}
                                </span>
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 min-w-0">
                                  <span className="text-sm font-bold truncate text-foreground group-hover:text-primary transition-colors">
                                    {event.title}
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
                                {t(IMPACT_LEVELS[event.impact].labelKey)}
                              </Badge>
                            </CardContent>
                          </Card>
                        }
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
