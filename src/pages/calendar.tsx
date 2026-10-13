import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  getCountryName,
  getCurrencyCode,
  getCurrencyName,
} from "@/lib/country";
import { CountryFlag } from "@/components/shared/country-flag";
import {
  CALENDAR_CURRENCIES, CALENDAR_SOURCES, availableCalendarData, calendarDate,
  calendarWeekDates, filterCalendarEvents, nextCalendarCatalyst,
} from "@/features/economic-calendar/model/calendar";
import { IMPACT_LEVELS } from "@/constants/calendar";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  X,
  AlertCircle,
} from "lucide-react";
import { useEconomicCalendar } from "@/services/queries/use-calendar-data";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDetailDialog } from "@/features/economic-calendar/components/calendar-detail-dialog";
import { Separator } from "@/components/ui/separator";
import { FilterGroup } from "@/components/shared/filter-group";
import { PageHelp } from "@/components/shared/page-help";
import { BADGE } from "@/constants/taxonomy/palette";
import { useAppDispatch } from "@/store/hooks";
import { uiActions } from "@/store/slices/ui-slice";

const COMPACT_SIGNAL_BADGE_CLASSNAME =
  "rounded-md text-[10px] font-bold uppercase tracking-wider";
import type {
  CalendarData, CalendarEvent,
  EventAssetRelevance,
  EventImpact,
} from "@/types/calendar";

type ImpactFilter = EventImpact | "all";
type AssetFilter = EventAssetRelevance | "all";
type TimeHorizon = "today" | "tomorrow" | "this_week" | "this_month" | "";

function formatCountdown(ms: number, language: string): string {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}${language === "id" ? "h" : "d"} ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

const EMPTY_CALENDAR: CalendarData = { events: [], sources: [] };

export default function CalendarPage() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("all");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("ALL");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [ribbon, setRibbon] = useState({ week: "", offset: 0 });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = calendarDate(now);
  const tomorrowStr = calendarDate(now + 86_400_000);
  const currentWeek = useMemo(() => calendarWeekDates(todayStr), [todayStr]);
  const selectedDate = timeHorizon === "today" ? todayStr : timeHorizon === "tomorrow" ? tomorrowStr : customDate;
  const month = (selectedDate ?? todayStr).slice(0, 7);
  const { data, isLoading, isError, isFetched, isFetching, refetch } = useEconomicCalendar(month);
  const freshnessMinute = Math.floor(now / 60_000);
  const { sources, events: allEvents } = useMemo(() => availableCalendarData(data ?? EMPTY_CALENDAR, freshnessMinute * 60_000), [data, freshnessMinute]);
  // Retrying without cached data resets isError, but the failure panel must stay visible.
  const loadFailed = isError || (!data && isFetched);
  const failed = allEvents.length === 0 && (loadFailed || (sources.length > 0 && sources.every((source) => source.status === "unavailable")));
  const incomplete = sources.some((source) => source.status !== "ok");
  const stale = loadFailed || sources.some((source) => source.stale);
  const matchingEvents = useMemo(() => filterCalendarEvents(allEvents, {
    currency: selectedCurrency, impact: impactFilter, asset: assetFilter, search: searchQuery,
  }), [allEvents, selectedCurrency, impactFilter, assetFilter, searchQuery]);
  const catalyst = nextCalendarCatalyst(matchingEvents, now);
  const nextMajorCatalyst = catalyst ? { event: catalyst, timestamp: catalyst.timestamp! } : null;
  const countdownMs = nextMajorCatalyst ? nextMajorCatalyst.timestamp - now : 0;
  const ribbonKey = `${todayStr.slice(0, 7)}:${currentWeek[0]}`;
  const ribbonOffset = ribbon.week === ribbonKey ? ribbon.offset : 0;
  const setRibbonOffset = (offset: number) => setRibbon({ week: ribbonKey, offset });
  const locale = i18n.language === "id" ? "id-ID" : "en-US";
  const ribbonDates = useMemo(() => calendarWeekDates(todayStr, ribbonOffset).map((dateStr) => {
    const date = new Date(`${dateStr}T00:00:00+07:00`);
    const dayEvents = matchingEvents.filter((event) => event.date === dateStr);
    const highestImpact = (["high", "medium", "low"] as const).find((impact) => dayEvents.some((event) => event.impact === impact));
    return {
      date, dateStr, dayName: date.toLocaleDateString(locale, { weekday: "long", timeZone: "Asia/Jakarta" }),
      dayNumber: Number(dateStr.slice(-2)), monthName: date.toLocaleDateString(locale, { month: "long", timeZone: "Asia/Jakarta" }),
      isToday: dateStr === todayStr, eventCount: dayEvents.length, highestImpact,
    };
  }), [todayStr, ribbonOffset, matchingEvents, locale]);
  const canPrevWeek = ribbonDates[0].dateStr > `${todayStr.slice(0, 7)}-01`;
  const canNextWeek = calendarDate(ribbonDates[6].date.getTime() + 86_400_000).slice(0, 7) === todayStr.slice(0, 7);
  const ribbonRangeLabel = `${ribbonDates[0].date.toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })} – ${ribbonDates[6].date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}`;

  // Filter options for FilterGroup in chronological order
  const timeHorizonOptions = useMemo(
    () =>
      [
        { value: "today", label: t("calendar.horizon.today") },
        { value: "tomorrow", label: t("calendar.horizon.tomorrow") },
        { value: "this_week", label: t("calendar.horizon.this_week") },
        { value: "this_month", label: t("calendar.horizon.this_month") },
      ] as const,
    [t],
  );

  const handleSelectRibbonDate = (dateStr: string) => {
    if (selectedDate === dateStr) {
      setCustomDate(null);
      setTimeHorizon("this_week");
    } else {
      setCustomDate(dateStr);
      setTimeHorizon(dateStr === todayStr ? "today" : dateStr === tomorrowStr ? "tomorrow" : "");
    }
  };

  const handleSelectTimeHorizon = (horizon: TimeHorizon) => {
    setTimeHorizon(horizon);
    setCustomDate(null);
    setRibbonOffset(0);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCurrency("ALL");
    setImpactFilter("all");
    setAssetFilter("all");
    setCustomDate(null);
    setTimeHorizon("today");
    setRibbonOffset(0);
  };

  const hasActiveFilters =
    Boolean(searchQuery) ||
    selectedCurrency !== "ALL" ||
    impactFilter !== "all" ||
    assetFilter !== "all" ||
    selectedDate !== todayStr ||
    timeHorizon !== "today" ||
    ribbonOffset !== 0;

  const currencyOptions = useMemo(
    () => [
      { value: "ALL", label: t("calendar.all_currencies") },
      ...CALENDAR_CURRENCIES.map((code) => ({ value: code, label: code })),
    ],
    [t],
  );

  const impactOptions = useMemo(
    () =>
      [
        { value: "all", label: t("calendar.impact.all") },
        { value: "high", label: t("calendar.impact.high") },
        { value: "medium", label: t("calendar.impact.medium") },
        { value: "low", label: t("calendar.impact.low") },
      ] as const,
    [t],
  );

  const assetOptions = useMemo(
    () => [
      { value: "all", label: t("calendar.asset.all") },
      { value: "stocks", label: t("calendar.asset.stocks") },
      { value: "crypto", label: t("calendar.asset.crypto") },
      { value: "commodities", label: t("calendar.asset.commodities") },
    ],
    [t],
  );

  const filteredEvents = useMemo(() => matchingEvents.filter((event) => {
    if (selectedDate) return event.date === selectedDate;
    if (timeHorizon === "this_week") return event.date >= currentWeek[0] && event.date <= currentWeek[6];
    return event.date.startsWith(`${month}-`);
  }), [matchingEvents, selectedDate, timeHorizon, currentWeek, month]);

  const pageContext = useMemo(
    () => ({
      kind: "calendar" as const,
      selectedDate,
      filters: {
        impact: impactFilter,
        currency: selectedCurrency,
        asset: assetFilter,
        timeHorizon,
        search: searchQuery.slice(0, 120),
      },
      events: filteredEvents.slice(0, 5).map((event) => ({
        title: event.title,
        country: event.country,
        date: event.date,
        time: event.time || t("calendar.time_unannounced"),
        impact: event.impact,
        ...(event.forecast ? { forecast: event.forecast } : {}),
        ...(event.previous ? { previous: event.previous } : {}),
        ...(event.actual ? { actual: event.actual } : {}),
        assetRelevance: event.assetRelevance,
      })),
    }),
    [
      selectedDate,
      impactFilter,
      selectedCurrency,
      assetFilter,
      timeHorizon,
      searchQuery,
      filteredEvents,
      t,
    ],
  );

  useEffect(() => {
    dispatch(uiActions.setPageResearchContext(pageContext));
  }, [dispatch, pageContext]);

  useEffect(() => () => {
    dispatch(uiActions.setPageResearchContext(null));
  }, [dispatch]);

  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: Record<string, CalendarEvent[]> = {};
    filteredEvents.forEach((event) => {
      if (!groups[event.date]) groups[event.date] = [];
      groups[event.date].push(event);
    });
    return groups;
  }, [filteredEvents]);

  return (
    <div className="w-full bg-background py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6">
        {/* Page Header */}
        <div className="min-w-0">
          <div className="flex w-fit max-w-full items-start gap-2">
            <h1 className="min-w-0 text-3xl font-bold uppercase tracking-tight text-foreground">
              {t("calendar.title")}
            </h1>
            <PageHelp
              title={t("calendar.title")}
              description={t("page_help.calendar")}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("calendar.subtitle")}
          </p>
        </div>

        <Separator />

        {(failed || incomplete || stale) && (
          <Card className="border border-border">
            <Empty role={failed ? "alert" : "status"}>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AlertCircle aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>
                  {t(failed ? "common.load_error_title" : incomplete ? "calendar.coverage_partial_title" : "calendar.coverage_stale_title")}
                </EmptyTitle>
                <EmptyDescription>
                  {failed ? t("common.load_error_description") : (
                    <>
                      {incomplete && <p>{t("calendar.coverage_partial")}</p>}
                      {stale && <p>{t("calendar.coverage_stale")}</p>}
                    </>
                  )}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  type="button"
                  size="lg"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                  aria-busy={isFetching}
                >
                  <RefreshCw data-icon="inline-start" />
                  {t("common.retry")}
                </Button>
              </EmptyContent>
            </Empty>
          </Card>
        )}

        {!failed && (
          <>
        {/* SECTION 1: NEXT MAJOR CATALYST */}
        <section className="flex flex-col gap-3">
          {/* Header: Title */}
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              {t("calendar.next_catalyst")}
            </h2>
          </div>

          {isLoading ? <Skeleton className="h-48 w-full" /> : nextMajorCatalyst ? (
            <Card className="border border-border p-4 sm:p-5 flex flex-col gap-3.5 transition-all">
              {/* Top Row: Meta Badges (left) & Live Countdown (right) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={cn(
                      COMPACT_SIGNAL_BADGE_CLASSNAME,
                      BADGE.negative.bg,
                      BADGE.negative.text,
                      BADGE.negative.border,
                    )}
                  >
                    {t("calendar.impact.high")}
                  </Badge>

                  <Badge
                    variant="outline"
                    className={cn(
                      COMPACT_SIGNAL_BADGE_CLASSNAME,
                      BADGE.neutral.bg,
                      BADGE.neutral.text,
                      BADGE.neutral.border,
                      "px-1.5 py-0.5",
                    )}
                  >
                    <CountryFlag
                      countryCode={nextMajorCatalyst.event.country}
                      className="w-4 h-2.5 rounded-[1px]"
                    />
                  </Badge>

                  <Badge
                    variant="outline"
                    className={cn(
                      COMPACT_SIGNAL_BADGE_CLASSNAME,
                      BADGE.neutral.bg,
                      BADGE.neutral.text,
                      BADGE.neutral.border,
                    )}
                  >
                    {getCountryName(
                      nextMajorCatalyst.event.country,
                      i18n.language,
                    )}
                  </Badge>

                  <Badge
                    variant="outline"
                    className={cn(
                      COMPACT_SIGNAL_BADGE_CLASSNAME,
                      BADGE.neutral.bg,
                      BADGE.neutral.text,
                      BADGE.neutral.border,
                    )}
                  >
                    {getCurrencyName(
                      getCurrencyCode(nextMajorCatalyst.event.country),
                      i18n.language,
                    )}
                  </Badge>

                  {nextMajorCatalyst.event.assetRelevance.map((asset) => (
                    <Badge
                      key={asset}
                      variant="outline"
                      className={cn(
                        COMPACT_SIGNAL_BADGE_CLASSNAME,
                        BADGE.neutral.bg,
                        BADGE.neutral.text,
                        BADGE.neutral.border,
                      )}
                    >
                      {t(`calendar.asset.${asset}`)}
                    </Badge>
                  ))}
                </div>

                {/* Live Countdown Hero Pill */}
                <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                  <Badge
                    variant="outline"
                    className={cn(
                      COMPACT_SIGNAL_BADGE_CLASSNAME,
                      BADGE.accent.bg,
                      BADGE.accent.text,
                      BADGE.accent.border,
                      "shrink-0 px-2.5 py-1",
                    )}
                  >
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {t("calendar.countdown_prefix")}:
                    </span>
                    <span className="font-mono text-xs font-bold tracking-tight text-primary">
                      {formatCountdown(countdownMs, i18n.language)}
                    </span>
                  </Badge>
                </div>
              </div>

              {/* Middle Row: Event Title */}
              <div className="space-y-1">
                <CardTitle className="text-base sm:text-lg font-bold tracking-tight uppercase text-foreground leading-snug">
                  {nextMajorCatalyst.event.title}
                </CardTitle>
                {nextMajorCatalyst.event.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {nextMajorCatalyst.event.description}
                  </p>
                )}
              </div>

              {/* Separator */}
              <Separator />

              {/* Bottom Row: Event Metadata + Action Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 sm:gap-4 text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <span>
                      {nextMajorCatalyst.event.time} •{" "}
                      {new Date(
                        nextMajorCatalyst.event.date + "T00:00:00+07:00",
                      ).toLocaleDateString(
                        i18n.language === "id" ? "id-ID" : "en-US",
                        {
                          timeZone: "Asia/Jakarta",
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )}
                    </span>
                  </div>

                  <a href={nextMajorCatalyst.event.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{CALENDAR_SOURCES[nextMajorCatalyst.event.source].name}</a>

                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">
                      {t("calendar.forecast")}:
                    </span>
                    <span className="font-semibold text-foreground">
                      {nextMajorCatalyst.event.forecast &&
                      nextMajorCatalyst.event.forecast !== "N/A"
                        ? nextMajorCatalyst.event.forecast
                        : t("calendar.value_unavailable")}
                    </span>
                  </div>

                  <div className="hidden sm:block text-border">•</div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">
                      {t("calendar.previous")}:
                    </span>
                    <span className="font-semibold text-muted-foreground">
                      {nextMajorCatalyst.event.previous &&
                      nextMajorCatalyst.event.previous !== "N/A"
                        ? nextMajorCatalyst.event.previous
                        : t("calendar.value_unavailable")}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 self-end sm:self-auto w-full sm:w-auto">
                  <CalendarDetailDialog
                    event={nextMajorCatalyst.event}
                    trigger={
                      <Button
                        size="sm"
                        className="w-full sm:w-auto font-bold text-xs cursor-pointer items-center justify-center gap-1.5 tracking-tight shrink-0"
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>{t("calendar.details")}</span>
                      </Button>
                    }
                  />
                </div>
              </div>
            </Card>
          ) : (
            <Card className="border border-border">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CalendarDays aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>
                    {t("calendar.no_upcoming_catalyst")}
                  </EmptyTitle>
                  <EmptyDescription>
                    {t("calendar.catalyst_empty_desc")}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </Card>
          )}
        </section>

        <Separator />

        {/* SECTION 2: JADWAL MINGGUAN */}
        <section className="flex flex-col gap-3">
          {/* Header: Title */}
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              {t("calendar.weekly_schedule")}
            </h2>
          </div>

          {/* 7-Day Cards (Calculator Card style) */}
          <div className="flex sm:grid sm:grid-cols-7 gap-2 sm:gap-2.5 overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none snap-x w-full">
            {ribbonDates.map((item) => {
              const isSelected = selectedDate === item.dateStr;
              return (
                <Card
                  key={item.dateStr}
                  size="sm"
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => handleSelectRibbonDate(item.dateStr)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectRibbonDate(item.dateStr);
                    }
                  }}
                  className={cn(
                    "group border border-border transition-all duration-200 cursor-pointer select-none snap-start min-w-30 sm:min-w-0 flex-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                    isSelected
                      ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-xs"
                      : "hover:bg-muted/50 hover:border-primary",
                  )}
                >
                  <CardContent className="px-3 sm:px-3.5 flex flex-col justify-between h-full gap-2">
                    {/* Top Row: Day Name + Terminal Palette Badge */}
                    <div className="flex items-center justify-between w-full gap-1">
                      <span
                        className={cn(
                          "text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors truncate",
                          isSelected
                            ? "text-primary"
                            : item.isToday
                              ? "text-primary font-extrabold"
                              : "text-muted-foreground group-hover:text-foreground",
                        )}
                      >
                        {item.dayName}
                      </span>

                      {item.isToday ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            COMPACT_SIGNAL_BADGE_CLASSNAME,
                            BADGE.accent.bg,
                            BADGE.accent.text,
                            BADGE.accent.border,
                          )}
                        >
                          {t("calendar.today")}
                        </Badge>
                      ) : item.highestImpact === "high" ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            COMPACT_SIGNAL_BADGE_CLASSNAME,
                            BADGE.negative.bg,
                            BADGE.negative.text,
                            BADGE.negative.border,
                          )}
                        >
                          {t("calendar.impact.high")}
                        </Badge>
                      ) : item.highestImpact === "medium" ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            COMPACT_SIGNAL_BADGE_CLASSNAME,
                            BADGE.warning.bg,
                            BADGE.warning.text,
                            BADGE.warning.border,
                          )}
                        >
                          {t("calendar.impact.medium")}
                        </Badge>
                      ) : item.highestImpact === "low" ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            COMPACT_SIGNAL_BADGE_CLASSNAME,
                            BADGE.positive.bg,
                            BADGE.positive.text,
                            BADGE.positive.border,
                          )}
                        >
                          {t("calendar.impact.low")}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className={cn(
                            COMPACT_SIGNAL_BADGE_CLASSNAME,
                            BADGE.neutral.bg,
                            BADGE.neutral.text,
                            BADGE.neutral.border,
                          )}
                        >
                          -
                        </Badge>
                      )}
                    </div>

                    {/* Middle Row: Date Number & Month */}
                    <div className="my-1 sm:my-1.5">
                      <div className="flex items-baseline gap-1 sm:gap-1.5">
                        <span
                          className={cn(
                            "text-xl sm:text-2xl font-bold tracking-tight transition-colors",
                            isSelected
                              ? "text-primary"
                              : "text-foreground group-hover:text-primary",
                          )}
                        >
                          {item.dayNumber}
                        </span>
                        <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase">
                          {item.monthName}
                        </span>
                      </div>
                    </div>

                    {/* Separator */}
                    <Separator className="my-1" />

                    {/* Bottom Row: Event Count */}
                    <div className="flex items-center gap-1.5 w-full text-[10px] sm:text-[11px]">
                      <span className="font-semibold text-foreground/80 truncate">
                        {item.eventCount} {t("calendar.events_found")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Footer Bar: Date Range Info on Left & Navigation Buttons on Right (matching DataTablePagination) */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs select-none pt-1">
            <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
              <span>{t("calendar.period")}</span>
              <span className="font-semibold text-foreground">
                {ribbonRangeLabel}
              </span>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 ml-auto">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!canPrevWeek}
                onClick={() => {
                  if (canPrevWeek) setRibbonOffset(ribbonOffset - 7);
                }}
                className="cursor-pointer"
                aria-label={t("calendar.prev_week")}
                title={t("calendar.prev_week")}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!canNextWeek}
                onClick={() => {
                  if (canNextWeek) setRibbonOffset(ribbonOffset + 7);
                }}
                className="cursor-pointer"
                aria-label={t("calendar.next_week")}
                title={t("calendar.next_week")}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </section>

        <Separator />

        {/* SECTION 3: AGENDA */}
        <section className="flex flex-col gap-3">
          {/* Header section — identical to Terminal (asset-signal-table) */}
          <div className="flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                {t("calendar.agenda")}
              </h2>
              {!(incomplete || stale) && (
                <Button
                  variant="link"
                  size="icon"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  title={t("journal.refresh")}
                  aria-label={t("journal.refresh")}
                  className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-primary hover:bg-muted"
                >
                  <RefreshCw
                    className={cn(
                      "h-4 w-4",
                      isFetching && "animate-spin",
                    )}
                  />
                </Button>
              )}
            </div>

            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 shrink-0">
              {isFetching ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span>
                  {filteredEvents.length} {t("calendar.events_found")}
                </span>
              )}
            </div>
          </div>

          {/* Control bar section — identical to Terminal (asset-signal-table) */}
          <div className="flex flex-col gap-3">
            {/* Filters: Tab Filter + Separator + Select Options */}
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <FilterGroup
                value={timeHorizon}
                options={timeHorizonOptions}
                onChange={(val) => handleSelectTimeHorizon(val as TimeHorizon)}
                aria-label={t("calendar.period")}
                className="flex-1 min-w-36 sm:flex-none sm:min-w-0 sm:w-fit"
              />

              <Separator orientation="vertical" className="hidden sm:block mx-1" />

              <FilterGroup
                value={assetFilter}
                options={assetOptions}
                aria-label={t("calendar.asset.all")}
                onChange={(v) => setAssetFilter(v as AssetFilter)}
                variant="select"
                className="flex-1 sm:flex-none"
              />

              <FilterGroup
                value={selectedCurrency}
                options={currencyOptions}
                aria-label={t("calendar.all_currencies")}
                onChange={(v) => setSelectedCurrency(v)}
                variant="select"
                className="flex-1 sm:flex-none"
              />

              <FilterGroup
                value={impactFilter}
                options={impactOptions}
                aria-label={t("calendar.impact.all")}
                onChange={(v) => setImpactFilter(v as ImpactFilter)}
                variant="select"
                className="flex-1 sm:flex-none"
              />
            </div>

            {/* Search and Actions Group below */}
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type="text"
                  placeholder={t("calendar.search_placeholder")}
                  aria-label={t("calendar.search_placeholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9 text-sm placeholder:text-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label={t("common.clear_search")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {hasActiveFilters && (
                <>
                  <Separator orientation="vertical" className="mx-1" />

                  <Button
                    size="sm"
                    onClick={handleResetFilters}
                    className="h-8 font-bold transition-all text-xs cursor-pointer items-center gap-1.5 tracking-tight shrink-0"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{t("calendar.reset_filter")}</span>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Agenda Event Cards */}
          {isLoading ? (
            <div className="space-y-6">
              <div
                className="border border-border rounded-xl ring-1 ring-foreground/10 overflow-hidden shadow-xs bg-card"
                aria-hidden="true"
              >
                <div className="shrink-0 bg-popover p-4 pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-4 w-48 sm:w-64" />
                    <Skeleton className="h-3 w-16 shrink-0" />
                  </div>
                  <Separator className="mt-4" />
                </div>
                <div className="divide-y divide-border">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="px-4 py-4 flex flex-row items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4 sm:gap-5 flex-1 min-w-0">
                        <Skeleton className="size-7 shrink-0 rounded-lg sm:size-8" />
                        <Skeleton className="h-5 w-20 shrink-0 rounded-md" />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <Skeleton className="h-4 w-48 max-w-full sm:w-64" />
                          <Skeleton className="h-3 w-20 max-w-full sm:w-28" />
                        </div>
                      </div>
                      <div className="flex items-center shrink-0">
                        <Skeleton className="h-5 w-16 shrink-0 rounded-md" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : Object.keys(groupedEvents).length === 0 ? (
            <Card className="border border-border">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CalendarDays aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>{t(incomplete ? "calendar.no_loaded_events" : "calendar.no_events")}</EmptyTitle>
                  <EmptyDescription>
                    {t("calendar.no_events_desc")}
                  </EmptyDescription>
                </EmptyHeader>
                {hasActiveFilters && (
                  <EmptyContent>
                    <Button
                      size="lg"
                      onClick={handleResetFilters}
                    >
                      <RotateCcw data-icon="inline-start" />
                      {t("calendar.reset_filter")}
                    </Button>
                  </EmptyContent>
                )}
              </Empty>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedEvents).map(([date, events]) => (
                <div
                  key={date}
                  className="border border-border rounded-xl ring-1 ring-foreground/10 overflow-hidden shadow-xs bg-card"
                >
                  {/* Date Group Header Bar (Identik Dialog Edukasi) */}
                  <div className="shrink-0 bg-popover p-4 pb-0 select-none">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-foreground uppercase tracking-wider truncate">
                          {new Date(`${date}T00:00:00+07:00`).toLocaleDateString(
                            i18n.language === "id" ? "id-ID" : "en-US",
                            {
                              timeZone: "Asia/Jakarta",
                          weekday: "long",
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            },
                          )}
                        </span>
                        {date === todayStr && (
                          <Badge
                            variant="outline"
                            className={cn(
                              COMPACT_SIGNAL_BADGE_CLASSNAME,
                              BADGE.accent.bg,
                              BADGE.accent.text,
                              BADGE.accent.border,
                            )}
                          >
                            {t("calendar.today")}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest shrink-0">
                        {events.length} {t("calendar.events_found")}
                      </span>
                    </div>
                    <Separator className="mt-4" />
                  </div>

                  {/* List of event rows divided by fine border line */}
                  <div className="divide-y divide-border">
                    {events.map((event) => (
                      <CalendarDetailDialog
                        key={event.id}
                        event={event}
                        trigger={
                          <div
                            className="group px-4 py-4 flex flex-row items-center justify-between gap-4 text-left transition-colors hover:bg-muted/30 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                            role="button"
                            tabIndex={0}
                            aria-label={event.title}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.currentTarget.click();
                              }
                            }}
                          >
                            {/* Sisi Kiri: Avatar Bendera + Badge Jam + Judul & Subtitle Mata Uang */}
                            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                              {/* Avatar Box Bendera (Identik dengan Style Card Konteks Pasar: bg-muted/50 border ring-1) */}
                              <div className="size-8 border border-border rounded-lg ring-1 ring-foreground/10 bg-muted/50 hidden sm:flex items-center justify-center shrink-0">
                                <CountryFlag
                                  countryCode={event.country}
                                  className="w-4.5 h-3 sm:w-5 sm:h-3.5 rounded-[2px]"
                                />
                              </div>

                              {/* Badge Jam Netral WIB */}
                              <Badge
                                variant="outline"
                                className={cn(
                                  COMPACT_SIGNAL_BADGE_CLASSNAME,
                                  BADGE.neutral.bg,
                                  BADGE.neutral.text,
                                  BADGE.neutral.border,
                                  "shrink-0 max-w-24 whitespace-normal text-center",
                                )}
                              >
                                {event.time || t("calendar.time_unannounced")}
                              </Badge>

                              {/* Judul & Subtitle: Mata Uang • Nama Negara */}
                              <div className="space-y-0.5 min-w-0 flex-1">
                                <CardTitle className="text-xs sm:text-sm font-bold tracking-tight uppercase text-foreground group-hover:text-primary transition-colors line-clamp-3 sm:line-clamp-2">
                                  {event.title}
                                </CardTitle>
                                <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground font-medium">
                                  <span className="text-[10px] font-bold text-foreground/80 uppercase tracking-wider">
                                    {getCurrencyCode(event.country)}
                                  </span>
                                  <span className="text-muted-foreground/40 select-none">
                                    •
                                  </span>
                                  <span className="text-[11px] text-muted-foreground truncate">
                                    {getCountryName(
                                      event.country,
                                      i18n.language,
                                    )}
                                  </span>
                                  <span>· {CALENDAR_SOURCES[event.source].name}</span>
                                </div>
                              </div>
                            </div>

                            {/* Sisi Kanan: Badge Dampak */}
                            <div className="flex items-center shrink-0">
                              <Badge
                                variant="outline"
                                className={cn(
                                  COMPACT_SIGNAL_BADGE_CLASSNAME,
                                  IMPACT_LEVELS[event.impact].badgeColor.bg,
                                  IMPACT_LEVELS[event.impact].badgeColor.text,
                                  IMPACT_LEVELS[event.impact].badgeColor.border,
                                )}
                              >
                                {t(IMPACT_LEVELS[event.impact].labelKey)}
                              </Badge>
                            </div>
                          </div>
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
          </>
        )}
      </div>
    </div>
  );
}
