import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  getCountryName,
  getCurrencyCode,
  getCurrencyName,
} from "@/lib/country";
import { CountryFlag } from "@/components/shared/country-flag";
import { formatLocalDate } from "@/lib/formatters";
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
import { BADGE } from "@/constants/taxonomy/palette";

const COMPACT_SIGNAL_BADGE_CLASSNAME =
  "rounded-md text-[10px] font-bold uppercase tracking-wider";
import type {
  CalendarEvent,
  EventAssetRelevance,
  EventImpact,
} from "@/types/calendar";

type ImpactFilter = EventImpact | "all";
type AssetFilter = EventAssetRelevance | "all";
type TimeHorizon = "today" | "tomorrow" | "this_week" | "this_month" | "";

function getEventTimestamp(event: CalendarEvent): number {
  const parts = event.id.split("-");
  if (parts.length >= 3) {
    const ts = Number(parts[2]);
    if (!isNaN(ts) && ts > 1000000000000) {
      return ts;
    }
  }
  const timePart = event.time.split(" ")[0];
  const dateObj = new Date(
    `${event.date}T${timePart.length === 5 ? timePart + ":00" : timePart}`,
  );
  if (!isNaN(dateObj.getTime())) {
    return dateObj.getTime();
  }
  return new Date(`${event.date}T00:00:00`).getTime();
}

function formatEventTimeWIB(event: CalendarEvent): string {
  const ts = getEventTimestamp(event);
  if (ts > 0) {
    return new Date(ts).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    });
  }
  return event.time.split(" ")[0];
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}h ${hours.toString().padStart(2, "0")}j ${minutes.toString().padStart(2, "0")}m`;
  }
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

const CURRENCY_COUNTRY_MAP: Record<string, string[]> = {
  USD: ["US"],
  EUR: ["EU", "DE", "FR", "IT", "ES", "NL"],
  GBP: ["GB", "UK"],
  JPY: ["JP"],
  AUD: ["AU"],
  CNY: ["CN"],
  IDR: ["ID"],
};

export default function CalendarPage() {
  const { t, i18n } = useTranslation();
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("all");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("ALL");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(() =>
    formatLocalDate(new Date()),
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const {
    data: allEvents = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useEconomicCalendar();

  // Next key high-impact catalyst with live countdown
  const nextMajorCatalyst = useMemo(() => {
    const upcoming = allEvents
      .filter((e) => e.impact === "high")
      .map((e) => ({ event: e, timestamp: getEventTimestamp(e) }))
      .filter((item) => item.timestamp >= now)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (upcoming.length > 0) return upcoming[0];

    // Fallback: Check high-impact events awaiting release
    const pending = allEvents
      .filter((e) => e.impact === "high" && (!e.actual || e.actual === "N/A"))
      .map((e) => ({ event: e, timestamp: getEventTimestamp(e) }))
      .sort((a, b) => a.timestamp - b.timestamp);

    return pending[0] || null;
  }, [allEvents, now]);

  const countdownMs = nextMajorCatalyst
    ? Math.max(0, nextMajorCatalyst.timestamp - now)
    : 0;

  const [ribbonOffset, setRibbonOffset] = useState<number>(0);

  // Reference dates
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatLocalDate(today), [today]);

  // Horizontal Date Ribbon dates (7 days of active week)
  const ribbonDates = useMemo(() => {
    const base = new Date(today);
    base.setDate(base.getDate() + ribbonOffset);
    const dayOfWeek = (base.getDay() + 6) % 7; // Monday = 0
    const monday = new Date(base);
    monday.setDate(base.getDate() - dayOfWeek);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = formatLocalDate(d);

      const dayEvents = allEvents.filter((e) => e.date === dateStr);
      const hasHigh = dayEvents.some((e) => e.impact === "high");
      const hasMedium = dayEvents.some((e) => e.impact === "medium");
      const hasLow = dayEvents.some((e) => e.impact === "low");
      const highestImpact = hasHigh
        ? "high"
        : hasMedium
          ? "medium"
          : hasLow
            ? "low"
            : null;

      dates.push({
        date: d,
        dateStr,
        dayName: d.toLocaleDateString(
          i18n.language === "id" ? "id-ID" : "en-US",
          { weekday: "long" },
        ),
        dayNumber: d.getDate(),
        monthName: d.toLocaleDateString(
          i18n.language === "id" ? "id-ID" : "en-US",
          { month: "long" },
        ),
        isToday: dateStr === todayStr,
        eventCount: dayEvents.length,
        highestImpact,
      });
    }
    return dates;
  }, [today, ribbonOffset, allEvents, i18n.language, todayStr]);

  const monthStart = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [today]);

  const monthEnd = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [today]);

  const { canPrevWeek, canNextWeek } = useMemo(() => {
    const base = new Date(today);
    base.setDate(base.getDate() + ribbonOffset);
    const dayOfWeek = (base.getDay() + 6) % 7; // Monday = 0
    const currentMonday = new Date(base);
    currentMonday.setDate(base.getDate() - dayOfWeek);
    currentMonday.setHours(0, 0, 0, 0);

    const prevSunday = new Date(currentMonday);
    prevSunday.setDate(prevSunday.getDate() - 1);
    prevSunday.setHours(23, 59, 59, 999);

    const nextMonday = new Date(currentMonday);
    nextMonday.setDate(nextMonday.getDate() + 7);
    nextMonday.setHours(0, 0, 0, 0);

    return {
      canPrevWeek: prevSunday >= monthStart,
      canNextWeek: nextMonday <= monthEnd,
    };
  }, [today, ribbonOffset, monthStart, monthEnd]);

  const ribbonRangeLabel = useMemo(() => {
    if (ribbonDates.length === 0) return "";
    const first = ribbonDates[0].date;
    const last = ribbonDates[ribbonDates.length - 1].date;
    return `${first.toLocaleDateString(i18n.language === "id" ? "id-ID" : "en-US", { day: "numeric", month: "long" })} – ${last.toLocaleDateString(i18n.language === "id" ? "id-ID" : "en-US", { day: "numeric", month: "long", year: "numeric" })}`;
  }, [ribbonDates, i18n.language]);
  const tomorrowStr = useMemo(() => {
    const tmr = new Date(today);
    tmr.setDate(tmr.getDate() + 1);
    return formatLocalDate(tmr);
  }, [today]);

  const weekRange = useMemo(() => {
    const curr = new Date(today);
    const firstDay = curr.getDate() - curr.getDay() + 1; // Monday
    const monday = new Date(curr.setDate(firstDay));
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);

    return {
      start: formatLocalDate(monday),
      end: formatLocalDate(sunday),
    };
  }, [today]);

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

  // Synchronized date & horizon selection handlers
  const handleSelectRibbonDate = (dateStr: string) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null);
      setTimeHorizon("this_week");
    } else {
      setSelectedDate(dateStr);
      if (dateStr === todayStr) {
        setTimeHorizon("today");
      } else if (dateStr === tomorrowStr) {
        setTimeHorizon("tomorrow");
      } else {
        setTimeHorizon("");
      }
    }
  };

  const handleSelectTimeHorizon = (horizon: TimeHorizon) => {
    setTimeHorizon(horizon);
    if (horizon === "today") {
      setSelectedDate(todayStr);
    } else if (horizon === "tomorrow") {
      setSelectedDate(tomorrowStr);
    } else {
      setSelectedDate(null);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCurrency("ALL");
    setImpactFilter("all");
    setAssetFilter("all");
    setSelectedDate(todayStr);
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
      { value: "USD", label: "USD" },
      { value: "EUR", label: "EUR" },
      { value: "GBP", label: "GBP" },
      { value: "JPY", label: "JPY" },
      { value: "AUD", label: "AUD" },
      { value: "CNY", label: "CNY" },
      { value: "IDR", label: "IDR" },
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

  // Filter pipeline
  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return allEvents.filter((e) => {
      // 0. Visual Date filter (selectedDate takes precedence if explicitly set; otherwise timeHorizon)
      if (selectedDate) {
        if (e.date !== selectedDate) return false;
      } else if (timeHorizon) {
        if (timeHorizon === "today" && e.date !== todayStr) return false;
        if (timeHorizon === "tomorrow" && e.date !== tomorrowStr) return false;
        if (
          timeHorizon === "this_week" &&
          (e.date < weekRange.start || e.date > weekRange.end)
        )
          return false;
        if (timeHorizon === "this_month") {
          const [year, month] = e.date.split("-").map(Number);
          if (month !== today.getMonth() + 1 || year !== today.getFullYear())
            return false;
        }
      }

      // 2. Impact filter
      if (impactFilter !== "all" && e.impact !== impactFilter) return false;

      // 3. Currency filter
      if (selectedCurrency !== "ALL") {
        const matchedCountries = CURRENCY_COUNTRY_MAP[selectedCurrency] || [
          selectedCurrency,
        ];
        if (!matchedCountries.includes(e.country)) return false;
      }

      // 4. Asset relevance filter
      if (assetFilter !== "all" && !e.assetRelevance.includes(assetFilter))
        return false;

      // 5. Search query
      if (query) {
        const matchesTitle = e.title.toLowerCase().includes(query);
        const matchesCountry = e.country.toLowerCase().includes(query);
        const matchesAsset = e.assetRelevance.some((a) =>
          a.toLowerCase().includes(query),
        );
        if (!matchesTitle && !matchesCountry && !matchesAsset) return false;
      }

      return true;
    });
  }, [
    allEvents,
    selectedDate,
    timeHorizon,
    today,
    todayStr,
    tomorrowStr,
    weekRange,
    impactFilter,
    selectedCurrency,
    assetFilter,
    searchQuery,
  ]);

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">
              {t("calendar.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("calendar.subtitle")}
            </p>
          </div>

        </div>

        <Separator />

        {/* SECTION 1: NEXT MAJOR CATALYST */}
        <section className="flex flex-col gap-3">
          {/* Header: Title */}
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              {t("calendar.next_catalyst")}
            </h2>
          </div>

          {nextMajorCatalyst ? (
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
                      {formatCountdown(countdownMs)}
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
                      {formatEventTimeWIB(nextMajorCatalyst.event)} WIB •{" "}
                      {new Date(
                        nextMajorCatalyst.event.date + "T00:00:00",
                      ).toLocaleDateString(
                        i18n.language === "id" ? "id-ID" : "en-US",
                        {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )}
                    </span>
                  </div>

                  <div className="hidden sm:block text-border">•</div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">
                      {t("calendar.forecast")}:
                    </span>
                    <span className="font-semibold text-foreground">
                      {nextMajorCatalyst.event.forecast &&
                      nextMajorCatalyst.event.forecast !== "N/A"
                        ? nextMajorCatalyst.event.forecast
                        : "—"}
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
                        : "—"}
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
              <Empty className="min-h-0 flex-row justify-between rounded-none border-0 p-4 text-left sm:p-5">
                <EmptyHeader className="items-start text-left">
                  <EmptyMedia variant="icon">
                    <CalendarDays aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm sm:text-base">
                  {t("calendar.no_upcoming_catalyst")}
                  </EmptyTitle>
                  <EmptyDescription>
                  {t("calendar.no_events_desc")}
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
          <div className="flex items-center justify-between gap-3 text-xs select-none pt-1">
            <div className="flex items-center gap-1.5 text-muted-foreground whitespace-nowrap">
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
                  if (canPrevWeek) setRibbonOffset((prev) => prev - 7);
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
                  if (canNextWeek) setRibbonOffset((prev) => prev + 7);
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
              <Button
                variant="link"
                size="icon"
                onClick={() => refetch()}
                disabled={isLoading || isRefetching}
                title={t("journal.refresh")}
                aria-label={t("journal.refresh")}
                className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-primary hover:bg-muted"
              >
                <RefreshCw
                  className={cn(
                    "h-4 w-4",
                    (isLoading || isRefetching) && "animate-spin",
                  )}
                />
              </Button>
            </div>

            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 shrink-0">
              {isLoading || isRefetching ? (
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
                className="flex-1 md:flex-none shrink-0 min-w-0 sm:w-fit"
              />

              <Separator orientation="vertical" className="mx-1" />

              <FilterGroup
                value={assetFilter}
                options={assetOptions}
                onChange={(v) => setAssetFilter(v as AssetFilter)}
                variant="select"
                className="flex-1 sm:flex-none"
              />

              <FilterGroup
                value={selectedCurrency}
                options={currencyOptions}
                onChange={(v) => setSelectedCurrency(v)}
                variant="select"
                className="flex-1 sm:flex-none"
              />

              <FilterGroup
                value={impactFilter}
                options={impactOptions}
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
          ) : isError && allEvents.length === 0 ? (
            <Card className="border border-border">
              <Empty role="alert" className="min-h-56 border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <RefreshCw aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>{t("common.load_error_title")}</EmptyTitle>
                  <EmptyDescription>
                    {t("common.load_error_description")}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void refetch()}
                    disabled={isRefetching}
                    aria-busy={isRefetching}
                  >
                    <RefreshCw data-icon="inline-start" />
                    {t("common.retry")}
                  </Button>
                </EmptyContent>
              </Empty>
            </Card>
          ) : Object.keys(groupedEvents).length === 0 ? (
            <Card className="border border-border">
              <Empty className="min-h-56 border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CalendarDays aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>{t("calendar.no_events")}</EmptyTitle>
                  <EmptyDescription>
                    {t("calendar.no_events_desc")}
                  </EmptyDescription>
                </EmptyHeader>
                {hasActiveFilters && (
                  <EmptyContent>
                    <Button
                      variant="outline"
                      size="sm"
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
                          {new Date(date).toLocaleDateString(
                            i18n.language === "id" ? "id-ID" : "en-US",
                            {
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
                            className="group px-4 py-4 flex flex-row items-center justify-between gap-4 text-left transition-colors hover:bg-muted/30 cursor-pointer select-none"
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
                              <div className="w-7 h-7 sm:w-8 sm:h-8 border border-border rounded-lg ring-1 ring-foreground/10 bg-muted/50 flex items-center justify-center shrink-0">
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
                                  "shrink-0",
                                )}
                              >
                                {formatEventTimeWIB(event)} WIB
                              </Badge>

                              {/* Judul & Subtitle: Mata Uang • Nama Negara */}
                              <div className="space-y-0.5 min-w-0 flex-1">
                                <CardTitle className="text-xs sm:text-sm font-bold tracking-tight uppercase text-foreground group-hover:text-primary transition-colors truncate block">
                                  {event.title}
                                </CardTitle>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium truncate">
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
      </div>
    </div>
  );
}
