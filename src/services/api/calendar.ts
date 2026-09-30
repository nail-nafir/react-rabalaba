import { z } from "zod";
import {
  CALENDAR_MAX_AGE_MS, CALENDAR_SOURCES, calendarDate, calendarMonthRange,
  calendarTime, calendarWeekDates, mergeCalendarEvents, normalizeYahooCalendar,
} from "@/features/economic-calendar/model/calendar";
import type { CalendarData, CalendarSource, CalendarSourceResponse, CalendarSourceState } from "@/types/calendar";

const officialResponse = z.object({
  checkedAt: z.number().int().positive(),
  events: z.array(z.object({
    id: z.string().min(1), title: z.string().min(1), country: z.literal("US"),
    date: z.iso.date(), time: z.string(), timestamp: z.number().int().positive().max(8.64e15).nullable(),
    source: z.enum(["bls", "bea", "fed"]), sourceUrl: z.string(),
    impact: z.enum(["high", "medium", "low"]), category: z.literal("Economic"),
    assetRelevance: z.array(z.enum(["stocks", "crypto", "commodities"])),
  })),
});

/** Each source fails independently; an unavailable source is never an empty success. */
export async function fetchEconomicCalendar(month = calendarDate(Date.now()).slice(0, 7)): Promise<CalendarData> {
  const { startMs, endMs } = calendarMonthRange(month);
  // Include the edge weeks so Sunday/next-month dates in the ribbon remain usable.
  const firstDate = calendarWeekDates(calendarDate(startMs))[0];
  const lastDate = calendarWeekDates(calendarDate(endMs - 1))[6];
  const params = new URLSearchParams({
    modules: "economicEvents", startDate: String(Date.parse(`${firstDate}T00:00:00+07:00`)),
    endDate: String(Date.parse(`${lastDate}T23:59:59.999+07:00`)),
    countPerDay: "100", economicEventsHighImportanceOnly: "false",
  });
  const sources = Object.keys(CALENDAR_SOURCES) as CalendarSource[];
  const results = await Promise.allSettled(sources.map(async (source) => {
    const url = source === "yahoo" ? `/api/yahoo/ws/screeners/v1/finance/calendar-events?${params}` : `/api/calendar/${source}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`${source} returned ${response.status}`);
    const payload: unknown = await response.json();
    let data: CalendarSourceResponse;
    let partial = false;
    if (source === "yahoo") {
      const normalized = normalizeYahooCalendar(payload);
      partial = normalized.partial;
      data = { events: normalized.events, checkedAt: Number(response.headers.get("X-Rabalaba-Checked-At")) || Date.now() };
    } else {
      data = officialResponse.parse(payload);
      if (data.events.some((event) => event.source !== source || event.sourceUrl !== CALENDAR_SOURCES[source].url ||
        event.time !== calendarTime(event.timestamp) || (event.timestamp !== null && event.date !== calendarDate(event.timestamp)))) {
        throw new Error("Invalid official calendar event");
      }
    }
    if (Date.now() - data.checkedAt > CALENDAR_MAX_AGE_MS || data.checkedAt > Date.now() + 60_000) throw new Error("Expired calendar data");
    const events = data.events.filter((event) => event.date >= firstDate && event.date <= lastDate);
    const state: CalendarSourceState = {
      source, status: partial ? "partial" : "ok", checkedAt: data.checkedAt,
      stale: response.headers.get("X-Rabalaba-Cache") === "stale",
    };
    return { events, state };
  }));
  return {
    events: mergeCalendarEvents(results.flatMap((result) => result.status === "fulfilled" ? result.value.events : [])),
    sources: results.map((result, index) => result.status === "fulfilled" ? result.value.state : {
      source: sources[index], status: "unavailable", stale: false, checkedAt: null,
    }),
  };
}
