import type { CalendarEvent, CalendarSource } from "../../../src/types/calendar";
import {
  CALENDAR_COUNTRIES, calendarMonthWindow, normalizeFedCalendar, normalizeYahooCalendar, yahooCalendarRows,
} from "../../../src/features/economic-calendar/model/calendar";
import { fetchWithTimeout, jsonErrorResponse, jsonOptionsResponse, proxyJsonRequest } from "../_shared/proxy";
import { YAHOO_UA, getCrumb } from "../_shared/yahoo";

const FED_FEED = "https://www.federalreserve.gov/json/calendar.json";
const YAHOO_FEED = "https://query1.finance.yahoo.com/v1/finance/visualization";
/** Yahoo answers at most 250 rows per request. */
const YAHOO_PAGE = 250;
const YAHOO_FIELDS = [
  "econ_release", "country_code", "startdatetime", "period",
  "after_release_actual", "consensus_estimate", "prior_release_actual", "description",
];

async function loadFed(month: string): Promise<CalendarEvent[]> {
  const upstream = await fetchWithTimeout(FED_FEED, {
    headers: { Accept: "application/json", "User-Agent": "RabaLaba/1.0" },
    redirect: "manual",
  });
  if (!upstream.ok) throw new Error(`Fed returned ${upstream.status}`);
  const body = await upstream.text();
  if (body.length > 5_000_000) throw new Error("Calendar response too large");
  return normalizeFedCalendar(body, month);
}

/** One query for the calendar countries in [from, to); a 401 means the crumb expired, so it is refreshed once. */
async function yahooQuery(from: number, to: number, retry = true): Promise<Record<string, unknown>[]> {
  const creds = await getCrumb(!retry);
  if (!creds) throw new Error("Yahoo crumb unavailable");
  const response = await fetchWithTimeout(`${YAHOO_FEED}?crumb=${encodeURIComponent(creds.crumb)}&lang=en-US&region=US`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": YAHOO_UA, Cookie: creds.cookie },
    body: JSON.stringify({
      sortType: "ASC", entityIdType: "economic_event", sortField: "startdatetime", includeFields: YAHOO_FIELDS,
      // One flat AND: Yahoo rejects nested ones.
      query: { operator: "and", operands: [
        { operator: "gte", operands: ["startdatetime", new Date(from).toISOString()] },
        { operator: "lt", operands: ["startdatetime", new Date(to).toISOString()] },
        { operator: "or", operands: CALENDAR_COUNTRIES.map((code) => ({ operator: "eq", operands: ["country_code", code] })) },
      ] },
      offset: 0, size: YAHOO_PAGE,
    }),
  });
  if (response.status === 401 && retry) return yahooQuery(from, to, false);
  if (!response.ok) throw new Error(`Yahoo returned ${response.status}`);
  return yahooCalendarRows(await response.json());
}

/** Offset paging over Yahoo's tied timestamps skips rows, so a full answer is split in time instead. */
async function yahooRows(from: number, to: number): Promise<Record<string, unknown>[]> {
  const rows = await yahooQuery(from, to);
  if (rows.length < YAHOO_PAGE) return rows;
  if (to - from <= 60_000) throw new Error("Yahoo calendar too dense to split");
  const middle = from + Math.floor((to - from) / 2);
  return (await Promise.all([yahooRows(from, middle), yahooRows(middle, to)])).flat();
}

async function loadYahoo(month: string): Promise<CalendarEvent[]> {
  const { firstDate, lastDate } = calendarMonthWindow(month);
  const from = Date.parse(`${firstDate}T00:00:00+07:00`);
  const to = Date.parse(`${lastDate}T00:00:00+07:00`) + 86_400_000;
  return normalizeYahooCalendar(await yahooRows(from, to), month);
}

const SOURCES: Record<CalendarSource, { feed: string; load: (month: string) => Promise<CalendarEvent[]> }> = {
  fed: { feed: FED_FEED, load: loadFed },
  yahoo: { feed: YAHOO_FEED, load: loadYahoo },
};

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === "OPTIONS") return jsonOptionsResponse();
  if (context.request.method !== "GET") return jsonErrorResponse("Method not allowed", 405);
  const source = String(context.params.source);
  if (!Object.hasOwn(SOURCES, source)) return jsonErrorResponse("Unknown calendar source", 404);
  // Only the month on screen: never an arbitrary URL or forwarded user input.
  const month = /^\?month=(\d{4}-(?:0[1-9]|1[0-2]))$/.exec(new URL(context.request.url).search)?.[1];
  if (!month) return jsonErrorResponse("Calendar requires ?month=YYYY-MM", 400);
  const { feed, load } = SOURCES[source as CalendarSource];

  // Loaders throw on any upstream failure, so the proxy serves the last good month instead.
  return proxyJsonRequest(context, {
    serviceName: `Calendar-${source}`,
    upstreamUrl: new URL(feed),
    cachePolicy: { freshTtlSeconds: 1_800, staleTtlSeconds: 21_600 },
    fetchUpstream: async () => Response.json({ events: await load(month), checkedAt: Date.now() }),
  });
};
