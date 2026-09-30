import {
  normalizeBeaCalendar, normalizeBlsCalendar, normalizeFedCalendar,
} from "../../../src/features/economic-calendar/model/calendar";
import { fetchWithTimeout, jsonErrorResponse, jsonOptionsResponse, proxyJsonRequest } from "../_shared/proxy";

const SOURCES = {
  bls: "https://www.bls.gov/schedule/news_release/bls.ics",
  bea: "https://apps.bea.gov/API/signup/release_dates.json",
  fed: "https://www.federalreserve.gov/json/calendar.json",
} as const;

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === "OPTIONS") return jsonOptionsResponse();
  if (context.request.method !== "GET") return jsonErrorResponse("Method not allowed", 405);
  const source = context.params.source;
  if (source !== "bls" && source !== "bea" && source !== "fed") return jsonErrorResponse("Unknown calendar source", 404);
  if (new URL(context.request.url).search) return jsonErrorResponse("Calendar sources do not accept query parameters", 400);

  return proxyJsonRequest(context, {
    serviceName: `Calendar-${source}`,
    upstreamUrl: new URL(SOURCES[source]),
    cachePolicy: { freshTtlSeconds: 1_800, staleTtlSeconds: 21_600, staleOnStatuses: [403, 429, [500, 599]] },
    fetchUpstream: async () => {
      const upstream = await fetchWithTimeout(SOURCES[source], {
        headers: { Accept: source === "bls" ? "text/calendar" : "application/json", "User-Agent": "RabaLaba/1.0" },
        redirect: "manual",
      });
      if (!upstream.ok) return jsonErrorResponse("Calendar source unavailable", upstream.status >= 400 ? upstream.status : 502);
      const body = await upstream.text();
      if (body.length > 5_000_000) throw new Error("Calendar response too large");
      const events = source === "bls" ? normalizeBlsCalendar(body)
        : source === "bea" ? normalizeBeaCalendar(JSON.parse(body)) : normalizeFedCalendar(JSON.parse(body));
      return Response.json({ events, checkedAt: Date.now() });
    },
  });
};
