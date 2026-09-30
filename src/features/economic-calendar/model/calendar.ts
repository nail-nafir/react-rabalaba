import { z } from "zod";
import { recapWindow } from "../../../core/automation/period-summary";
import { getCurrencyCode } from "../../../lib/country";
import type { CalendarData, CalendarEvent, CalendarSource, EventImpact } from "../../../types/calendar";

export const CALENDAR_SOURCES = {
  bls: { name: "BLS", url: "https://www.bls.gov/schedule/" },
  bea: { name: "BEA", url: "https://www.bea.gov/news/schedule/" },
  fed: { name: "Federal Reserve", url: "https://www.federalreserve.gov/newsevents/calendar.htm" },
  yahoo: { name: "Yahoo Finance", url: "https://finance.yahoo.com/calendar/economic/" },
} as const;

export const CALENDAR_FRESH_MS = 30 * 60_000;
export const CALENDAR_MAX_AGE_MS = CALENDAR_FRESH_MS + 6 * 60 * 60_000;
const DAY_MS = 86_400_000;
const WIB_CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

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
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(timestamp);
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

/** Resolve a published wall-clock time with IANA DST rules, not a fixed ET offset. */
export function zonedTimestamp(date: string, time: string, timeZone: string): number {
  z.iso.date().parse(date);
  if (!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time)) throw new Error("Invalid release time");
  const wall = Date.parse(`${date}T${time}Z`);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
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
  if (/^corporate profits/i.test(title)) return "corporate-profits";
  if (/^U\.S\. International Transactions and Investment Position$|^current account\b/i.test(title)) return "international-transactions";
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
const yahooSchema = z.object({
  finance: z.object({
    error: z.null().optional(),
    result: z.object({ economicEvents: z.array(z.object({
      totalCount: z.number().int().nonnegative(),
      records: z.array(z.object({
        event: z.string().trim().min(1), countryCode: z.string().regex(/^[A-Z]{2}$/),
        eventTime: z.number().int().positive().max(8.64e15), period: z.string().optional(),
        actual: valueSchema, prior: valueSchema, description: z.string().optional(),
      })),
    })) }),
  }),
});

export function calendarValue(value: string | number | null | undefined): string | undefined {
  const text = value == null ? "" : String(value).trim();
  return !text || /^(N\/?A|—|-)$/i.test(text) ? undefined : text;
}

export function normalizeYahooCalendar(payload: unknown) {
  const groups = yahooSchema.parse(payload).finance.result.economicEvents;
  return {
    partial: groups.some((group) => group.records.length < group.totalCount),
    events: groups.flatMap((group) => group.records.map((record) => ({
      ...eventFor("yahoo", record.event, record.eventTime),
      id: `yahoo:${record.countryCode}:${record.event}:${record.period ?? ""}:${record.eventTime}`,
      country: record.countryCode,
      impact: impactFor(record.event, record.countryCode),
      actual: calendarValue(record.actual), previous: calendarValue(record.prior),
      description: record.description,
    }))),
  };
}

export function normalizeBeaCalendar(payload: unknown): CalendarEvent[] {
  const records = z.record(z.string(), z.unknown()).parse(payload);
  const events: CalendarEvent[] = [];
  for (const [title, value] of Object.entries(records)) {
    if (title === "file_last_updated") continue;
    const { release_dates } = z.object({ release_dates: z.array(z.iso.datetime({ offset: true })) }).parse(value);
    for (const date of release_dates) events.push(eventFor("bea", title, Date.parse(date)));
  }
  if (!events.length) throw new Error("BEA schedule is empty");
  return mergeCalendarEvents(events);
}

export function normalizeFedCalendar(payload: unknown): CalendarEvent[] {
  const { events } = z.object({ events: z.array(z.record(z.string(), z.unknown())) }).parse(payload);
  // The published Fed feed ends with an empty object; only FOMC rows are schedules we consume.
  if (events.some((event) => Object.keys(event).length && typeof event.type !== "string")) throw new Error("Invalid Fed event");
  const meetings = events.filter((event) => event.type === "FOMC");
  if (!meetings.length) throw new Error("Fed schedule is empty");
  return meetings.map((record) => {
    const event = z.object({
      title: z.string().trim().min(1), month: z.string(), days: z.string(), time: z.string().optional(),
    }).parse(record);
    const date = z.iso.date().parse(`${event.month}-${event.days.trim().padStart(2, "0")}`);
    const clock = /^(\d{1,2}):(\d{2})\s*([ap])\.?m\.?(?:\s+E[DS]T)?$/i.exec(event.time?.trim() ?? "");
    let timestamp: number | null = null;
    if (clock) {
      if (+clock[1] < 1 || +clock[1] > 12) throw new Error("Invalid Fed release time");
      const hours = (+clock[1] % 12) + (clock[3].toLowerCase() === "p" ? 12 : 0);
      timestamp = zonedTimestamp(date, `${String(hours).padStart(2, "0")}:${clock[2]}:00`, "America/New_York");
    }
    return eventFor("fed", event.title.trim(), timestamp, date);
  });
}

export function normalizeBlsCalendar(ics: string): CalendarEvent[] {
  if (!ics.includes("BEGIN:VCALENDAR") || !ics.includes("END:VCALENDAR")) throw new Error("Invalid BLS calendar");
  const text = ics.replace(/\r?\n[ \t]/g, "");
  const blocks = [...text.matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)END:VEVENT/g)];
  if (!blocks.length || blocks.length !== (text.match(/BEGIN:VEVENT/g) ?? []).length) throw new Error("Incomplete BLS calendar");
  const byId = new Map<string, { sequence: number; event: CalendarEvent | null }>();
  for (const [, block] of blocks) {
    const fields = new Map(block.trim().split(/\r?\n/).map((line) => {
      const colon = line.indexOf(":");
      return [line.slice(0, colon), line.slice(colon + 1)] as const;
    }));
    const unescape = (value: string) => value.replace(/\\([nN,;\\])/g, (_, char: string) => /n/i.test(char) ? "\n" : char);
    const uid = fields.get("UID");
    const title = unescape(fields.get("SUMMARY") ?? "").trim();
    const sequence = Number(fields.get("SEQUENCE") ?? 0);
    if (!uid || !Number.isFinite(sequence)) throw new Error("Invalid BLS event identity");
    if ((byId.get(uid)?.sequence ?? -1) > sequence) continue;
    if (fields.get("STATUS") === "CANCELLED") {
      byId.set(uid, { sequence, event: null });
      continue;
    }
    if (!title || fields.has("RRULE")) throw new Error("Unsupported BLS event");
    const start = [...fields].find(([key]) => key === "DTSTART" || key.startsWith("DTSTART;"));
    const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(start?.[1] ?? "");
    if (!start || !match) throw new Error("Invalid BLS event date");
    const date = z.iso.date().parse(`${match[1]}-${match[2]}-${match[3]}`);
    let timestamp: number | null = null;
    if (match[4]) {
      const zone = /TZID="?([^;"\s]+)"?/.exec(start[0])?.[1];
      // ponytail: only explicit ICS instants; floating times/recurrences need a full ICS parser if BLS adds them.
      if (!match[7] && !zone) throw new Error("BLS release timezone missing");
      timestamp = zonedTimestamp(date, `${match[4]}:${match[5]}:${match[6]}`, match[7] ? "UTC" : zone!);
    }
    byId.set(uid, { sequence, event: { ...eventFor("bls", title, timestamp, date), id: `bls:${uid}` } });
  }
  return [...byId.values()].flatMap(({ event }) => event ? [event] : []);
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
