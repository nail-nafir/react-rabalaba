import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createServer } from 'vite';

let server, model, service, route;
const originalFetch = globalThis.fetch;
const originalCaches = globalThis.caches;
const originalWindow = globalThis.window;
const at = (iso) => Date.parse(iso);
const fedRow = { type: 'FOMC', title: 'FOMC Meeting', month: '2026-09', days: '16', time: '2:00 p.m.' };
const fedFeed = (rows = [fedRow]) => JSON.stringify({ events: rows });
const yahooRow = {
  econ_release: 'GDP Final', country_code: 'US', startdatetime: '2026-09-30T12:30:00.000Z', period: 'Q2',
  after_release_actual: '2.6%', consensus_estimate: null, prior_release_actual: '2.5%', description: 'Gross domestic product ',
};
const YAHOO_COLUMNS = Object.keys(yahooRow);
/** One page as Yahoo's visualization API sends it: column ids plus positional rows. */
const yahooPayload = (rows = [yahooRow]) => ({ finance: { error: null, result: [{ documents: [{
  columns: YAHOO_COLUMNS.map((id) => ({ id })), rows: rows.map((row) => YAHOO_COLUMNS.map((id) => row[id] ?? null)),
}] }] } });
const sourceResponse = (events, checkedAt = Date.now()) => ({ events, checkedAt });
const SEP = '2026-09';
const yahooEvents = (rows) => model.normalizeYahooCalendar(model.yahooCalendarRows(yahooPayload(rows)), SEP);
const calendarRoute = (source, search = `?month=${SEP}`, init) =>
  route.onRequest({ request: new Request(`https://test.example/api/calendar/${source}${search}`, init), params: { source }, waitUntil() {} });

test.before(async () => {
  server = await createServer({ appType: 'custom', configFile: 'vite.config.ts', logLevel: 'silent', server: { middlewareMode: true, watch: null } });
  model = await server.ssrLoadModule('/src/features/economic-calendar/model/calendar.ts');
  service = await server.ssrLoadModule('/src/services/api/calendar.ts');
  route = await server.ssrLoadModule('/functions/api/calendar/[source].ts');
});
test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalCaches === undefined) delete globalThis.caches;
  else globalThis.caches = originalCaches;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});
test.after(async () => { try { await server?.close(); } catch { /* Vite SSR teardown */ } });

test('FOMC uses the next WIB date, explicit UTC milliseconds, and distinct press conference', () => {
  const [meeting, press] = model.normalizeFedCalendar(fedFeed([fedRow, { ...fedRow, title: 'FOMC Press Conference', time: '2:30 p.m.' }, {}]), SEP);
  assert.equal(meeting.timestamp, at('2026-09-16T18:00Z'));
  assert.equal(meeting.date, '2026-09-17');
  assert.equal(meeting.time, '01:00 WIB');
  assert.equal(press.time, '01:30 WIB');
  assert.notEqual(meeting.id, press.id);
  assert.equal(model.calendarDate(at('2026-09-30T18:00Z')), '2026-10-01');
});

test('The Fed feed parses even when the runtime keeps its UTF-8 BOM', () => {
  // Cloudflare's Response.text() keeps the BOM the Fed now sends; JSON.parse rejects it.
  const body = `\uFEFF${fedFeed()}`;
  assert.throws(() => JSON.parse(body));
  const [meeting] = model.normalizeFedCalendar(body, SEP);
  assert.equal(meeting.title, 'FOMC Meeting');
  assert.equal(meeting.source, 'fed');
});

test('The Fed feed is kept as published: every type, one event per listed day, plain text', () => {
  const events = model.normalizeFedCalendar(fedFeed([
    { ...fedRow, description: '&lt;p&gt;Two-day meeting, September 15 - 16&lt;/p&gt;\n\n&lt;p&gt;Press Conference&lt;/p&gt;' },
    { type: 'Stat', title: 'H.15 - Selected Interest Rates', month: '2026-09', days: '1, 8', time: '4:15 p.m.' },
    { type: 'Speeches', title: 'Speech - Governor A ', month: '2026-09', days: '3', time: '', description: 'Economic Outlook', location: 'At the Q&amp;A Forum&#8217;s Day' },
    { type: 'FOMC', title: 'FOMC Minutes', month: '2026-08', days: '31', time: '2:00 p.m.', description: '&lt;p&gt;Meeting of July 28-29&lt;/p&gt;' },
    { type: 'Stat', title: 'G.19 - Consumer Credit', month: '2026-10', days: '7', time: '3:00 p.m.' },
    { type: 'Stat', title: 'G.17 - Industrial Production', month: '2026-11', days: '17', time: '9:15 a.m.' },
    { type: 'events', title: 'Speech -- Archive', month: '', days: '4', time: '9:00 a.m.' },
    {},
  ]), SEP);
  assert.deepEqual(events.map((e) => `${e.date} ${e.time || '-'} ${e.title} ${e.impact}`), [
    '2026-09-17 01:00 WIB FOMC Meeting high',
    '2026-09-02 03:15 WIB H.15 - Selected Interest Rates low',
    '2026-09-09 03:15 WIB H.15 - Selected Interest Rates low',
    '2026-09-03 - Speech - Governor A medium',
    '2026-09-01 01:00 WIB FOMC Minutes medium',
  ]);
  assert.equal(events[3].description, 'Economic Outlook · At the Q&A Forum\u2019s Day');
  assert.equal(events[4].description, 'Meeting of July 28-29');
  assert.equal(events[0].description, 'Two-day meeting, September 15 - 16 · Press Conference');
  assert.equal(events[1].description, undefined);
  assert.equal(model.nextCalendarCatalyst(events, at('2026-09-01T00:00Z')).title, 'FOMC Meeting');
});

test('US daylight saving changes use IANA rules, while WIB stays UTC+7', () => {
  for (const [date, utc] of [['2026-03-06', '13:30'], ['2026-03-09', '12:30'], ['2026-10-30', '12:30'], ['2026-11-02', '13:30']]) {
    assert.equal(model.zonedTimestamp(date, '08:30:00', 'America/New_York'), at(`${date}T${utc}Z`));
  }
  assert.throws(() => model.zonedTimestamp('2026-03-08', '02:30:00', 'America/New_York'), /Nonexistent/);
  assert.throws(() => model.zonedTimestamp('2026-02-30', '08:30:00', 'America/New_York'));
});

test('Sunday belongs to the Monday-start week; midnight, month and year roll correctly', () => {
  assert.deepEqual(model.calendarWeekDates('2026-09-27'), ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
  assert.equal(model.calendarWeekDates('2026-09-28')[0], '2026-09-28');
  assert.equal(model.calendarDate(at('2026-09-30T16:59:59Z')), '2026-09-30');
  assert.equal(model.calendarDate(at('2026-09-30T17:00:00Z')), '2026-10-01');
  assert.equal(model.calendarMonthRange('2026-12').endMs, at('2026-12-31T17:00Z'));
  assert.equal(model.calendarMonthRange('2028-02').endMs, at('2028-02-29T17:00Z'));
  assert.throws(() => model.calendarMonthRange('2026-13'));
});

test('Unknown release time remains null and never produces a countdown or midnight guess', () => {
  const [fed] = model.normalizeFedCalendar(fedFeed([{ ...fedRow, time: 'To be announced' }]), SEP);
  assert.equal(fed.timestamp, null);
  assert.equal(fed.time, '');
  assert.equal(fed.date, '2026-09-16');
  assert.equal(model.nextCalendarCatalyst([fed], at('2026-09-01T00:00Z')), null);
});

test('Malformed schedules fail validation instead of inventing or silently dropping dates', () => {
  assert.throws(() => model.normalizeFedCalendar('<html>Access Denied</html>', SEP));
  assert.throws(() => model.normalizeFedCalendar(fedFeed([{ ...fedRow, days: '15-16' }]), SEP));
  assert.throws(() => model.normalizeFedCalendar(fedFeed([{ ...fedRow, time: '13:00 p.m.' }]), SEP));
  assert.throws(() => model.normalizeFedCalendar(fedFeed([{}]), SEP));
});

test('Yahoo rows keep zero, drop absent values, map consensus and trim descriptions', () => {
  const [first, second] = yahooEvents([
    { ...yahooRow, after_release_actual: 0, prior_release_actual: ' N/A ', consensus_estimate: '2.4%' },
    { ...yahooRow, econ_release: 'Other', after_release_actual: null, prior_release_actual: '', description: null },
  ]);
  assert.equal(first.actual, '0');
  assert.equal(first.previous, undefined);
  assert.equal(first.forecast, '2.4%');
  assert.equal(first.description, 'Gross domestic product');
  assert.equal(first.time, '19:30 WIB');
  assert.equal(second.actual, undefined);
  assert.equal(second.description, undefined);
  assert.throws(() => model.yahooCalendarRows({ finance: { error: { code: 'unauthorized' } } }));
  assert.throws(() => yahooEvents([{ ...yahooRow, startdatetime: 'not a timestamp' }]));
});

test('Fed FOMC replaces the Yahoo FOMC row; unrelated Yahoo series survive', () => {
  const official = model.normalizeFedCalendar(fedFeed(), SEP);
  const yahoo = yahooEvents([
    { ...yahooRow, econ_release: 'Fed Funds Tgt Rate', startdatetime: '2026-09-16T18:00:00.000Z' },
    { ...yahooRow, econ_release: 'CPI' },
    { ...yahooRow, econ_release: 'GDP Final', country_code: 'GB' },
    { ...yahooRow, econ_release: 'Dallas Fed Trimmed Mean PCE' },
  ]);
  const merged = model.mergeCalendarEvents([...official, ...yahoo]);
  assert.equal(merged.length, 4);
  assert.ok(merged.some((e) => e.title === 'FOMC Meeting' && e.source === 'fed'));
  assert.ok(!merged.some((e) => e.title === 'Fed Funds Tgt Rate'));
  assert.ok(merged.some((e) => e.title === 'CPI' && e.source === 'yahoo'));
  assert.ok(merged.some((e) => e.country === 'GB'));
  assert.ok(merged.some((e) => e.title.includes('Dallas')));
  assert.equal(model.releaseFamily('Gross Domestic Product by State and Personal Income by State'), null);
});

test('Yahoo keeps the calendar currencies within the month view, counting every euro member as EUR', () => {
  const events = yahooEvents([
    yahooRow,
    { ...yahooRow, econ_release: 'Ifo Business Climate', country_code: 'DE' },
    { ...yahooRow, econ_release: 'Industrial Output', country_code: 'SK' },
    { ...yahooRow, econ_release: 'CPI YY', country_code: 'LT' },
    { ...yahooRow, econ_release: 'Inflation YY*', country_code: 'ID' },
    { ...yahooRow, econ_release: 'CPI YY', country_code: 'KW' },
    { ...yahooRow, econ_release: 'GDP', country_code: 'CA' },
    { ...yahooRow, country_code: 'XX1', startdatetime: 'not checked: other countries are skipped first' },
    { ...yahooRow, startdatetime: '2026-10-05T12:30:00.000Z' },
  ]);
  assert.deepEqual(events.map((e) => e.country), ['US', 'DE', 'SK', 'LT', 'ID']);
  for (const code of ['US', 'GB', 'SK', 'LT', 'LV', 'EE', 'BG']) assert.ok(model.CALENDAR_COUNTRIES.includes(code), code);
  assert.ok(!model.CALENDAR_COUNTRIES.includes('KW'));
});

test('One currency filter feeds agenda, weekly counts and future-only catalyst selection', () => {
  const events = yahooEvents([
    { ...yahooRow, econ_release: 'CPI', startdatetime: '2026-09-10T12:30:00.000Z' },
    { ...yahooRow, econ_release: 'GDP UK', country_code: 'GB', startdatetime: '2026-09-28T12:30:00.000Z' },
    yahooRow,
  ]);
  const usd = model.filterCalendarEvents(events, { currency: 'USD', impact: 'all', asset: 'all', search: '' });
  assert.equal(usd.length, 2);
  assert.ok(usd.every((e) => e.country === 'US'));
  assert.equal(model.nextCalendarCatalyst(usd, at('2026-09-27T12:30Z')).title, 'GDP Final');
  assert.equal(model.nextCalendarCatalyst(usd, at('2026-10-01T12:30Z')), null);
});

test('Fetches both sources through the same monthly route; a failed Fed leaves Yahoo visible', async () => {
  const urls = [];
  const [yahooEvent] = yahooEvents([yahooRow]);
  globalThis.fetch = async (url) => {
    urls.push(url);
    return url.includes('/fed') ? new Response('Denied', { status: 403 }) : Response.json(sourceResponse([yahooEvent]));
  };
  const data = await service.fetchEconomicCalendar('2026-09');
  assert.deepEqual(urls.sort(), ['/api/calendar/fed?month=2026-09', '/api/calendar/yahoo?month=2026-09']);
  assert.equal(data.sources.find((s) => s.source === 'fed').status, 'unavailable');
  assert.equal(data.sources.find((s) => s.source === 'yahoo').status, 'ok');
  assert.deepEqual(data.events.map((e) => e.id), [yahooEvent.id]);
});

test('All failures and damaged normalized payloads are not reported as successful empty calendars', async () => {
  globalThis.fetch = async (url) => url.includes('/fed') ? Promise.reject(new Error('offline')) : Response.json({ events: 'broken', checkedAt: Date.now() });
  const data = await service.fetchEconomicCalendar('2026-09');
  assert.deepEqual(data.events, []);
  assert.equal(data.sources.length, 2);
  assert.ok(data.sources.every((s) => s.status === 'unavailable'));
});

test('Stale cache retains its check time and expires instead of showing old events indefinitely', async () => {
  const checkedAt = Date.now() - 3_600_000;
  globalThis.fetch = async (url) => url.includes('/fed')
    ? Response.json(sourceResponse(model.normalizeFedCalendar(fedFeed(), SEP), checkedAt), { headers: { 'X-Rabalaba-Cache': 'stale' } })
    : new Response('', { status: 502 });
  const data = await service.fetchEconomicCalendar('2026-09');
  assert.equal(data.sources.find((s) => s.source === 'fed').checkedAt, checkedAt);
  assert.equal(data.sources.find((s) => s.source === 'fed').stale, true);
  assert.equal(data.events.length, 1);
  const expired = model.availableCalendarData(data, checkedAt + model.CALENDAR_MAX_AGE_MS + 1);
  assert.equal(expired.events.length, 0);
  assert.ok(expired.sources.every((s) => s.status === 'unavailable'));
});

test('Route only accepts GET for a known source and one month, never an arbitrary URL or forwarded user input', async () => {
  globalThis.fetch = async () => assert.fail('invalid requests must not fetch');
  for (const [method, source, search, status] of [
    ['POST', 'fed', '?month=2026-09', 405], ['GET', 'bls', '?month=2026-09', 404], ['GET', 'constructor', '?month=2026-09', 404],
    ['GET', 'yahoo', '', 400], ['GET', 'fed', '?month=2026-13', 400],
    ['GET', 'fed', '?month=2026-09&x=1', 400], ['GET', 'yahoo', '?url=https://other.example', 400],
  ]) {
    const response = await calendarRoute(source, search, { method });
    assert.equal(response.status, status, `${method} ${source}${search}`);
  }
});

test('Yahoo route splits a full answer in time instead of paging, and renews an expired crumb once', async () => {
  globalThis.caches = { default: { async match() {}, async put() {}, async delete() { return false; } } };
  // 300 rows on both sides of the window's midpoint: one full answer, then two complete halves.
  const rows = Array.from({ length: 300 }, (_, i) => ({
    ...yahooRow, econ_release: `Release ${i}`,
    startdatetime: new Date(at(i < 150 ? '2026-09-01T00:00Z' : '2026-09-20T00:00Z') + i * 60_000).toISOString(),
  }));
  const queries = [];
  let crumbs = 0;
  let expired = true;
  globalThis.fetch = async (url, init) => {
    if (String(url) === 'https://fc.yahoo.com/') return new Response('', { headers: { 'set-cookie': 'A3=session; Path=/' } });
    if (String(url).endsWith('/v1/test/getcrumb')) return new Response(`crumb${++crumbs}`);
    if (expired) { expired = false; return new Response('Invalid Crumb', { status: 401 }); }
    assert.ok(String(url).includes(`crumb=crumb${crumbs}`) && init.headers.Cookie === 'A3=session');
    const { query, size } = JSON.parse(init.body);
    queries.push(query);
    const [from, to] = query.operands.slice(0, 2).map((operand) => Date.parse(operand.operands[1]));
    return Response.json(yahooPayload(rows.filter((row) => Date.parse(row.startdatetime) >= from && Date.parse(row.startdatetime) < to).slice(0, size)));
  };
  const response = await calendarRoute('yahoo');
  const { events } = await response.json();
  assert.equal(response.status, 200);
  assert.equal(new Set(events.map((e) => e.id)).size, 300);
  assert.equal(crumbs, 2);
  assert.deepEqual(queries.map((query) => query.operands.slice(0, 2).map((operand) => operand.operands[1])).sort(), [
    ['2026-08-30T17:00:00.000Z', '2026-09-17T05:00:00.000Z'],
    ['2026-08-30T17:00:00.000Z', '2026-10-04T17:00:00.000Z'],
    ['2026-09-17T05:00:00.000Z', '2026-10-04T17:00:00.000Z'],
  ]);
  assert.ok(queries[0].operands[2].operands.some((operand) => operand.operands[1] === 'SK'));
});

test('Route caches validated success, recovers stale on blocked or malformed upstream, and preserves check time', async () => {
  const entries = new Map();
  globalThis.caches = { default: {
    async match(request) { return entries.get(request.url)?.clone(); },
    async put(request, response) { entries.set(request.url, response.clone()); },
    async delete(request) { return entries.delete(request.url); },
  } };
  const waits = [];
  const context = { request: new Request('https://test.example/api/calendar/fed?month=2026-09'), params: { source: 'fed' }, waitUntil: (promise) => waits.push(promise) };
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), 'https://www.federalreserve.gov/json/calendar.json');
    assert.ok(init.signal);
    return new Response(`\uFEFF${fedFeed([fedRow, { ...fedRow, title: 'FOMC Press Conference', time: '2:30 p.m.' }])}`);
  };
  const first = await route.onRequest(context);
  const original = await first.json();
  assert.equal(first.status, 200);
  assert.equal(original.events.length, 2);
  assert.equal(first.headers.get('X-Rabalaba-Cache'), 'miss');
  await Promise.all(waits);
  const hit = await route.onRequest(context);
  assert.equal(hit.headers.get('X-Rabalaba-Cache'), 'hit');
  assert.equal(calls, 1);
  for (const failure of [() => new Response('Denied', { status: 403 }), () => Response.json({ broken: true })]) {
    for (const key of entries.keys()) if (key.includes('=fresh') || key.includes('=error')) entries.delete(key);
    globalThis.fetch = async () => failure();
    const stale = await route.onRequest(context);
    assert.equal(stale.headers.get('X-Rabalaba-Cache'), 'stale');
    assert.deepEqual(await stale.json(), original);
  }
});

test('Client rejects source spoofing, wrong WIB dates and expired payloads; valid empty results stay distinct', async () => {
  const event = model.normalizeFedCalendar(fedFeed(), SEP)[0];
  for (const payload of [
    sourceResponse([{ ...event, sourceUrl: 'https://untrusted.example' }]),
    sourceResponse([{ ...event, date: '2026-09-16' }]),
    sourceResponse([{ ...event, source: 'yahoo' }]),
    sourceResponse([event], Date.now() - model.CALENDAR_MAX_AGE_MS - 1),
  ]) {
    globalThis.fetch = async (url) => url.includes('/fed') ? Response.json(payload) : new Response('', { status: 503 });
    const result = await service.fetchEconomicCalendar('2026-09');
    assert.equal(result.events.length, 0);
    assert.equal(result.sources.find((s) => s.source === 'fed').status, 'unavailable');
  }
  globalThis.fetch = async () => Response.json(sourceResponse([]));
  const result = await service.fetchEconomicCalendar('2026-09');
  assert.equal(result.events.length, 0);
  assert.ok(result.sources.every((s) => s.status === 'ok'));
});

test('Shared timeout still aborts a response body after headers have arrived', async () => {
  const { fetchWithTimeout } = await server.ssrLoadModule('/functions/api/_shared/proxy.ts');
  globalThis.fetch = async (_url, init) => new Response(new ReadableStream({
    start(controller) { init.signal.addEventListener('abort', () => controller.error(init.signal.reason), { once: true }); },
  }));
  const response = await fetchWithTimeout('https://test.example', {}, 10);
  await Promise.all([
    assert.rejects(response.text(), { name: 'TimeoutError' }),
    new Promise((resolve) => setTimeout(resolve, 25)),
  ]);
});

test('Calendar keeps one recovery panel and usable data across source states in ID/EN', async (t) => {
  const now = at('2026-10-03T10:30Z');
  t.mock.method(Date, 'now', () => now);
  const { default: CalendarPage } = await server.ssrLoadModule('/src/pages/calendar.tsx');
  const { TooltipProvider } = await server.ssrLoadModule('/src/components/ui/tooltip.tsx');
  const { store } = await server.ssrLoadModule('/src/store/index.ts');
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  const instance = createInstance();
  const resources = Object.fromEntries(['id', 'en'].map((language) => [language, {
    translation: JSON.parse(readFileSync(`src/assets/locales/${language}.json`, 'utf8')),
  }]));
  await instance.init({ resources, lng: 'id' });
  const [event, nextDayEvent] = model.normalizeYahooCalendar(model.yahooCalendarRows(yahooPayload([
    { ...yahooRow, startdatetime: new Date(now + 60_000).toISOString() },
    { ...yahooRow, startdatetime: new Date(now + 86_400_000).toISOString() },
  ])), '2026-10');
  const fed = { source: 'fed', status: 'ok', stale: false, checkedAt: now };
  const yahoo = { ...fed, source: 'yahoo', checkedAt: now - 60_000 };
  const unavailable = { ...fed, status: 'unavailable', checkedAt: null };
  const older = { ...yahoo, stale: true, checkedAt: now - 3_600_000 };
  const expired = { ...fed, checkedAt: now - model.CALENDAR_MAX_AGE_MS - 60_000 };
  const cases = [
    { name: 'loading', messages: [] },
    { name: 'success', sources: [fed, yahoo], messages: [] },
    { name: 'valid empty', sources: [fed, yahoo], empty: true, messages: [] },
    { name: 'partial', sources: [unavailable, yahoo], title: 'calendar.coverage_partial_title', messages: ['coverage_partial'] },
    { name: 'partial empty', sources: [unavailable, yahoo], empty: true, title: 'calendar.coverage_partial_title', messages: ['coverage_partial'] },
    { name: 'stale', sources: [fed, older], title: 'calendar.coverage_stale_title', messages: ['coverage_stale'] },
    { name: 'partial and stale', sources: [unavailable, older], title: 'calendar.coverage_partial_title', messages: ['coverage_partial', 'coverage_stale'] },
    { name: 'all failed', sources: [unavailable, { ...unavailable, source: 'yahoo' }], empty: true, failed: true, title: 'common.load_error_title', messages: [] },
    { name: 'retrying partial', sources: [unavailable, yahoo], retrying: true, title: 'calendar.coverage_partial_title', messages: ['coverage_partial'] },
    { name: 'retrying all failed', sources: [unavailable, { ...unavailable, source: 'yahoo' }], empty: true, failed: true, retrying: true, title: 'common.load_error_title', messages: [] },
    { name: 'failed request without cache', sources: [], noData: true, failed: true, title: 'common.load_error_title', messages: [] },
    { name: 'retrying without cache', sources: [], noData: true, failed: true, retrying: true, title: 'common.load_error_title', messages: [] },
    { name: 'failed refresh with valid cache', sources: [fed, yahoo], error: true, title: 'calendar.coverage_stale_title', messages: ['coverage_stale'] },
    { name: 'failed refresh with empty date filter', sources: [fed, yahoo], events: [nextDayEvent], error: true, title: 'calendar.coverage_stale_title', messages: ['coverage_stale'] },
    { name: 'failed refresh with partial cache', sources: [unavailable, yahoo], error: true, title: 'calendar.coverage_partial_title', messages: ['coverage_partial', 'coverage_stale'] },
    { name: 'expired cache', sources: [expired, { ...expired, source: 'yahoo' }], failed: true, title: 'common.load_error_title', messages: [] },
  ];
  for (const language of ['id', 'en']) {
    await instance.changeLanguage(language);
    for (const state of cases) {
      const label = `${language}: ${state.name}`;
      const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, gcTime: 0 } } });
      const key = ['economic-calendar', '2026-10'];
      if (state.sources) client.setQueryData(key, { sources: state.sources, events: state.events ?? (state.empty ? [] : [event]) });
      const query = client.getQueryCache().find({ queryKey: key });
      if (state.error || state.noData) query.setState({
        status: 'error', error: new Error('Connection failed'), errorUpdateCount: 1,
        ...(state.noData ? { data: undefined, dataUpdatedAt: 0, dataUpdateCount: 0 } : {}),
      });
      if (state.retrying) query.setState({
        fetchStatus: 'fetching',
        ...(state.noData ? { status: 'pending', error: null } : {}),
      });
      try {
        const html = renderToStaticMarkup(React.createElement(I18nextProvider, { i18n: instance },
          React.createElement(TooltipProvider, null, React.createElement(Provider, { store }, React.createElement(QueryClientProvider, { client }, React.createElement(CalendarPage)))),
        ));
        const beforeSections = html.split('<section')[0];
        const header = beforeSections.split('data-slot="separator"')[0];
        const status = beforeSections.slice(header.length);
        const info = [...header.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
          .find(([button]) => button.includes(instance.t('page_help.label', { title: instance.t('calendar.title') })))?.[0];
        assert.ok(info, label);
        assert.match(info, /data-state="closed"/, `Initially closed: ${label}`);
        assert.doesNotMatch(info, /\saria-(?:haspopup|expanded|describedby)=/, label);
        assert.doesNotMatch(header, /<details\b|<summary\b|data-slot="(?:tooltip|popover)-content"/, label);
        assert.doesNotMatch(header.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/)?.[0] ?? '', /<button\b/, `Info control is outside the heading: ${label}`);
        const text = header.replace(/<[^>]+>/g, '').replaceAll('&amp;', '&');
        assert.doesNotMatch(text, /WIB \(UTC\+7\)/, `Timezone belongs in the bubble: ${label}`);
        assert.doesNotMatch(html, /Jadwal dari sumber berhasil dimuat|Source schedules loaded/, label);
        assert.doesNotMatch(header, /Federal Reserve|Yahoo Finance/, `Closed overlays are not server-rendered: ${label}`);
        assert.doesNotMatch(text, /Lagi cek sumber|Checking sources|Dicek|Checked/, `Header has no loading or source metadata text: ${label}`);
        assert.doesNotMatch(header, /role="(?:status|alert)"/, `Status is outside the header: ${label}`);
        for (const message of ['coverage_partial', 'coverage_stale']) {
          assert.equal(html.split(instance.t(`calendar.${message}`)).length - 1, state.messages.includes(message) ? 1 : 0, `${label}: ${message} appears only in the panel`);
        }
        const buttons = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(([button]) => button);
        const retries = buttons.filter((button) => button.includes(instance.t('common.retry')));
        assert.equal(retries.length, state.title ? 1 : 0, `One recovery action: ${label}`);
        assert.equal(buttons.some((button) => button.includes(`aria-label="${instance.t('journal.refresh')}"`)), !state.title, `Agenda refresh is absent during recovery: ${label}`);
        const retry = retries[0];
        if (retry) {
          assert.ok(status.includes(instance.t(state.title)), `Status title: ${label}`);
          assert.match(status, new RegExp(`role="${state.failed ? 'alert' : 'status'}"`), label);
          assert.ok(status.includes(retry), `Retry is before the content: ${label}`);
          assert.equal(/disabled=""/.test(retry), Boolean(state.retrying), label);
          assert.equal(/aria-busy="true"/.test(retry), Boolean(state.retrying), label);
          if (state.failed) assert.ok(status.includes(instance.t('common.load_error_description')), label);
        } else {
          assert.doesNotMatch(status, /role="(?:status|alert)"/, label);
        }
        if (!state.sources) {
          assert.match(html, /data-slot="skeleton"/, label);
          assert.doesNotMatch(header, /role="status"/, `Loading is represented by skeletons: ${label}`);
        }
        assert.equal(/<section\b/.test(html), !state.failed, `Calendar sections remain only when usable: ${label}`);
        if (state.sources && !state.empty && !state.failed) assert.ok(html.includes(`href="${event.sourceUrl}"`), `Source link remains on the catalyst: ${label}`);
        if (state.name === 'valid empty' || state.events) assert.ok(html.includes(instance.t('calendar.no_events')), `Empty filter uses the regular empty state: ${label}`);
        if (state.name === 'partial empty') assert.ok(html.includes(instance.t('calendar.no_loaded_events')), label);
        if (state.failed) assert.doesNotMatch(html, /role="status"|data-slot="skeleton"/, label);
      } finally { client.clear(); }
    }
  }
});
