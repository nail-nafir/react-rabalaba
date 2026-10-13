import { z } from "zod";
import {
  CALENDAR_MAX_AGE_MS, CALENDAR_SOURCES, calendarDate, calendarTime, mergeCalendarEvents,
} from "@/features/economic-calendar/model/calendar";
import type { CalendarData, CalendarSource, CalendarSourceState } from "@/types/calendar";

const sourceValue = z.string().optional();
const calendarResponse = z.object({
  checkedAt: z.number().int().positive(),
  events: z.array(z.object({
    id: z.string().min(1), title: z.string().min(1), country: z.string().regex(/^[A-Z]{2}$/),
    date: z.iso.date(), time: z.string(), timestamp: z.number().int().positive().max(8.64e15).nullable(),
    source: z.enum(["fed", "yahoo"]), sourceUrl: z.string(),
    impact: z.enum(["high", "medium", "low"]), category: z.literal("Economic"),
    assetRelevance: z.array(z.enum(["stocks", "crypto", "commodities"])),
    actual: sourceValue, forecast: sourceValue, previous: sourceValue, description: sourceValue,
  })),
});

/** Each source fails independently; an unavailable source is never an empty success. */
export async function fetchEconomicCalendar(month = calendarDate(Date.now()).slice(0, 7)): Promise<CalendarData> {
  const sources = Object.keys(CALENDAR_SOURCES) as CalendarSource[];
  const results = await Promise.allSettled(sources.map(async (source) => {
    const response = await fetch(`/api/calendar/${source}?month=${month}`, { signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`${source} returned ${response.status}`);
    const data = calendarResponse.parse(await response.json());
    if (data.events.some((event) => event.source !== source || event.sourceUrl !== CALENDAR_SOURCES[source].url ||
      event.time !== calendarTime(event.timestamp) || (event.timestamp !== null && event.date !== calendarDate(event.timestamp)))) {
      throw new Error("Invalid calendar event");
    }
    if (Date.now() - data.checkedAt > CALENDAR_MAX_AGE_MS || data.checkedAt > Date.now() + 60_000) throw new Error("Expired calendar data");
    const state: CalendarSourceState = {
      source, status: "ok", checkedAt: data.checkedAt,
      stale: response.headers.get("X-Rabalaba-Cache") === "stale",
    };
    return { events: data.events, state };
  }));
  return {
    events: mergeCalendarEvents(results.flatMap((result) => result.status === "fulfilled" ? result.value.events : [])),
    sources: results.map((result, index) => result.status === "fulfilled" ? result.value.state : {
      source: sources[index], status: "unavailable", stale: false, checkedAt: null,
    }),
  };
}
