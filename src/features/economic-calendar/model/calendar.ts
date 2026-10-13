import { z } from "zod";
import { recapWindow } from "../../../core/automation/period-summary";
import { COUNTRY_TO_CURRENCY, getCurrencyCode } from "../../../lib/country";
import type { CalendarData, CalendarEvent, CalendarSource, EventImpact } from "../../../types/calendar";

export const CALENDAR_SOURCES = {
  fed: { name: "Federal Reserve", url: "https://www.federalreserve.gov/newsevents/calendar.htm" },
  yahoo: { name: "Yahoo Finance", url: "https://finance.yahoo.com/calendar/economic/" },
} as const;

/** Major economies the calendar shows; the page's currency filter uses the same list. */
export const CALENDAR_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CNY", "IDR"] as const;
const CALENDAR_CURRENCY_SET = new Set<string>(CALENDAR_CURRENCIES);
/** Yahoo country codes behind those currencies, so the calendar query skips the rest of the world. */
export const CALENDAR_COUNTRIES = Object.keys(COUNTRY_TO_CURRENCY).filter((code) => CALENDAR_CURRENCY_SET.has(COUNTRY_TO_CURRENCY[code]));

export const CALENDAR_FRESH_MS = 30 * 60_000;
export const CALENDAR_MAX_AGE_MS = CALENDAR_FRESH_MS + 6 * 60 * 60_000;
const DAY_MS = 86_400_000;
const WIB_CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const DATE_FORMATS = new Map<string, Intl.DateTimeFormat>();

/** Building an Intl formatter costs ~20µs; a month of events reuses one per zone and shape. */
function dateFormat(timeZone: string, withTime: boolean): Intl.DateTimeFormat {
  const key = `${timeZone}|${withTime}`;
  if (!DATE_FORMATS.has(key)) {
    DATE_FORMATS.set(key, new Intl.DateTimeFormat("en-CA", withTime
      ? { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }
      : { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }));
  }
  return DATE_FORMATS.get(key)!;
}

export function availableCalendarData(data: CalendarData, now: number): CalendarData {
  const sources = data.sources.map((source) => ({
    ...source,
    status: source.checkedAt !== null && now - source.checkedAt > CALENDAR_MAX_AGE_MS ? "unavailable" as const : source.status,
    stale: source.stale || (source.checkedAt !== null && now - source.checkedAt > CALENDAR_FRESH_MS),
  }));
  const unavailable = new Set(sources.filter((source) => source.status === "unavailable").map((source) => source.source));
  return { sources, events: data.events.filter((event) => !unavailable.has(event.source)) };
}

export function calendarDate(timestamp: number, timeZone = "Asia/Jakarta"): string {
  const parts = dateFormat(timeZone, false).formatToParts(timestamp);
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function calendarTime(timestamp: number | null): string {
  return timestamp === null ? "" : `${WIB_CLOCK.format(timestamp)} WIB`;
}

export function calendarMonthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid calendar month");
  return recapWindow("monthly", Date.parse(`${month}-15T00:00:00+07:00`));
}

export function calendarWeekDates(today: string, offsetDays = 0): string[] {
  const { startMs } = recapWindow("weekly", Date.parse(`${today}T00:00:00+07:00`) + offsetDays * DAY_MS);
  return Array.from({ length: 7 }, (_, i) => calendarDate(startMs + i * DAY_MS));
}

/** WIB dates a month view covers: the edge weeks too, so the ribbon's Sunday/next-month days stay usable. */
export function calendarMonthWindow(month: string) {
  const { startMs, endMs } = calendarMonthRange(month);
  return { firstDate: calendarWeekDates(calendarDate(startMs))[0], lastDate: calendarWeekDates(calendarDate(endMs - 1))[6] };
}

/** Resolve a published wall-clock time with IANA DST rules, not a fixed ET offset. */
export function zonedTimestamp(date: string, time: string, timeZone: string): number {
  z.iso.date().parse(date);
  if (!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time)) throw new Error("Invalid release time");
  const wall = Date.parse(`${date}T${time}Z`);
  const formatter = dateFormat(timeZone, true);
  const wallAt = (timestamp: number) => {
    const p = Object.fromEntries(formatter.formatToParts(timestamp).map(({ type, value }) => [type, value]));
    return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
  };
  let timestamp = wall;
  for (let i = 0; i < 3 && wallAt(timestamp) !== wall; i++) timestamp += wall - wallAt(timestamp);
  if (wallAt(timestamp) !== wall) throw new Error("Nonexistent release time");
  return timestamp;
}

/** Only known US publication families participate in deduplication. */
export function releaseFamily(title: string): string | null {
  if (/\b(state|county|dallas|trimmed|adp)\b/i.test(title)) return null;
  if (/\bcpi\b|consumer price index/i.test(title)) return "cpi";
  if (/employment situation|non[- ]?farm|\bnfp\b|unemployment rate|average hourly earnings/i.test(title)) return "jobs";
  if (/\bppi\b|producer price index/i.test(title)) return "ppi";
  if (/\bjolts\b|job openings and labor turnover/i.test(title)) return "jolts";
  if (/^gdp\b|^gross domestic product/i.test(title)) return "gdp";
  if (/personal income|personal consum|personal spending|\bpce\b|^consumption, adjusted mm/i.test(title)) return "pce";
  if (/fomc.*minutes/i.test(title)) return "fomc-minutes";
  if (/fomc.*press conference/i.test(title)) return "fomc-press";
  if (/fomc.*meeting|fed funds (tgt|target)/i.test(title)) return "fomc";
  return null;
}

function impactFor(title: string, country: string): EventImpact {
  const family = country === "US" ? releaseFamily(title) : null;
  if (family && ["cpi", "jobs", "ppi", "jolts", "gdp", "pce", "fomc", "fomc-press"].includes(family)) return "high";
  if (/\bgdp\b|\bcpi\b|interest rate/i.test(title)) return "high";
  if (/sentiment|sales|\bpmi\b/i.test(title)) return "low";
  return "medium";
}

function eventFor(source: CalendarSource, title: string, timestamp: number | null, date?: string): CalendarEvent {
  const day = timestamp === null ? z.iso.date().parse(date) : calendarDate(timestamp);
  return {
    id: `${source}:${title}:${timestamp ?? day}`, title, country: "US", date: day,
    time: calendarTime(timestamp), timestamp, source, sourceUrl: CALENDAR_SOURCES[source].url,
    impact: impactFor(title, "US"), category: "Economic",
    assetRelevance: ["stocks", "crypto", "commodities"],
  };
}

const valueSchema = z.union([z.string(), z.number()]).nullish();
const yahooPageSchema = z.object({
  finance: z.object({
    error: z.null().optional(),
    result: z.array(z.object({
      documents: z.array(z.object({
        columns: z.array(z.object({ id: z.string() })), rows: z.array(z.array(z.unknown())),
      })).min(1),
    })).min(1),
  }),
});
const yahooRowSchema = z.object({
  econ_release: z.string().trim().min(1), country_code: z.string().regex(/^[A-Z]{2}$/),
  startdatetime: z.iso.datetime(), period: z.string().nullish(),
  after_release_actual: valueSchema, consensus_estimate: valueSchema, prior_release_actual: valueSchema,
  description: z.string().trim().nullish(),
});

export function calendarValue(value: string | number | null | undefined): string | undefined {
  const text = value == null ? "" : String(value).trim();
  return !text || /^(N\/?A|—|-)$/i.test(text) ? undefined : text;
}

/** One page of Yahoo's visualization API: column ids plus positional rows, as objects. */
export function yahooCalendarRows(payload: unknown): Record<string, unknown>[] {
  const { columns, rows } = yahooPageSchema.parse(payload).finance.result[0].documents[0];
  return rows.map((row) => Object.fromEntries(columns.map((column, i) => [column.id, row[i]])));
}

/** Keeps the calendar currencies within the month view; rows from other countries are never validated. */
export function normalizeYahooCalendar(rows: Record<string, unknown>[], month: string): CalendarEvent[] {
  const { firstDate, lastDate } = calendarMonthWindow(month);
  return rows
    .filter((record) => CALENDAR_CURRENCY_SET.has(getCurrencyCode(String(record.country_code ?? ""))))
    .map((record) => {
      const row = yahooRowSchema.parse(record);
      const timestamp = Date.parse(row.startdatetime);
      return {
        ...eventFor("yahoo", row.econ_release, timestamp),
        id: `yahoo:${row.country_code}:${row.econ_release}:${row.period ?? ""}:${timestamp}`,
        country: row.country_code,
        impact: impactFor(row.econ_release, row.country_code),
        actual: calendarValue(row.after_release_actual), forecast: calendarValue(row.consensus_estimate),
        previous: calendarValue(row.prior_release_actual), description: row.description || undefined,
      };
    })
    .filter((event) => event.date >= firstDate && event.date <= lastDate);
}

const FED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"' };

/** Fed text fields are HTML-escaped snippets (`&lt;p&gt;…`); keep the plain text, one " · " per paragraph. */
function fedText(html = ""): string {
  return html
    .replace(/&(?:#(\d+)|(\w+));/g, (entity, code: string | undefined, name: string) =>
      code ? String.fromCodePoint(Number(code)) : FED_ENTITIES[name] ?? entity)
    .split(/<\/p>|<br\s*\/?>/i)
    .map((part) => part.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" · ");
}

const fedRowSchema = z.object({
  type: z.string(), title: z.string().trim().min(1), month: z.string(), days: z.string(),
  time: z.string().optional(), description: z.string().optional(), location: z.string().optional(),
});

/**
 * Takes the raw body (the Fed feed starts with a UTF-8 BOM that JSON.parse rejects) and keeps every
 * event published for the month view, one per listed day, as the Fed's own calendar shows them.
 */
export function normalizeFedCalendar(text: string, month: string): CalendarEvent[] {
  const { firstDate, lastDate } = calendarMonthWindow(month);
  // An ET date runs at most one day behind its WIB date.
  const from = calendarDate(Date.parse(`${firstDate}T00:00:00+07:00`) - DAY_MS);
  const { events } = z.object({ events: z.array(z.record(z.string(), z.unknown())) })
    .parse(JSON.parse(text.replace(/^\uFEFF/, "")));
  // A renamed type or an emptied feed must fail loudly, never pass as a quiet month.
  if (!events.some((event) => event.type === "FOMC")) throw new Error("Fed schedule is empty");
  return events
    // Also drops undated rows: the trailing empty object and archive entries without a month.
    .filter((event) => typeof event.month === "string" && event.month >= from.slice(0, 7) && event.month <= lastDate.slice(0, 7))
    .flatMap((record) => {
      const row = fedRowSchema.parse(record);
      const title = fedText(row.title);
      const description = [row.description, row.location].map(fedText).filter(Boolean).join(" · ");
      const clock = /^(\d{1,2}):(\d{2})\s*([ap])\.?m\.?(?:\s+E[DS]T)?$/i.exec(row.time?.trim() ?? "");
      if (clock && (+clock[1] < 1 || +clock[1] > 12)) throw new Error("Invalid Fed release time");
      const time = clock && `${String((+clock[1] % 12) + (clock[3].toLowerCase() === "p" ? 12 : 0)).padStart(2, "0")}:${clock[2]}:00`;
      return row.days.split(",").flatMap((day) => {
        const date = z.iso.date().parse(`${row.month}-${day.trim().padStart(2, "0")}`);
        if (date < from || date > lastDate) return [];
        const event = eventFor("fed", title, time ? zonedTimestamp(date, time, "America/New_York") : null, date);
        if (event.date < firstDate || event.date > lastDate) return [];
        // The Fed rates nothing: statistical releases are routine, FOMC keeps its release-family impact.
        return [{ ...event, impact: row.type === "Stat" ? "low" as const : event.impact, ...(description ? { description } : {}) }];
      });
    });
}

export function mergeCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
  const key = (event: CalendarEvent) => {
    const family = event.country === "US" && releaseFamily(event.title);
    const date = event.timestamp === null ? event.date : calendarDate(event.timestamp, "America/New_York");
    return family ? `${family}:${date.slice(0, 7)}` : null;
  };
  const officialKeys = new Set(events.filter((event) => event.source !== "yahoo").map(key).filter(Boolean));
  return [...new Map(events
    .filter((event) => event.source !== "yahoo" || !officialKeys.has(key(event)))
    .map((event) => [event.id, event])).values()]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.timestamp ?? Infinity) - (b.timestamp ?? Infinity) || a.title.localeCompare(b.title));
}

export function filterCalendarEvents(events: CalendarEvent[], filters: {
  currency: string; impact: string; asset: string; search: string;
}): CalendarEvent[] {
  const query = filters.search.trim().toLowerCase();
  return events.filter((event) =>
    (filters.currency === "ALL" || getCurrencyCode(event.country) === filters.currency) &&
    (filters.impact === "all" || event.impact === filters.impact) &&
    (filters.asset === "all" || event.assetRelevance.some((asset) => asset === filters.asset)) &&
    (!query || [event.title, event.country, ...event.assetRelevance].some((value) => value.toLowerCase().includes(query))),
  );
}

export function nextCalendarCatalyst(events: CalendarEvent[], now: number): CalendarEvent | null {
  return events.reduce<CalendarEvent | null>((next, event) =>
    event.impact === "high" && event.timestamp !== null && event.timestamp >= now &&
    (next === null || event.timestamp < next.timestamp!) ? event : next, null);
}
