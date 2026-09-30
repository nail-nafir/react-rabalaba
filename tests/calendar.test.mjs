import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

let server, model, service, route;
const originalFetch = globalThis.fetch;
const originalCaches = globalThis.caches;
const at = (iso) => Date.parse(iso);
const beaFeed = { 'Gross Domestic Product': { release_dates: ['2026-09-30T12:30:00+00:00'] }, 'Personal Income and Outlays': { release_dates: ['2026-09-30T12:30:00+00:00'] } };
const fedRow = { type: 'FOMC', title: 'FOMC Meeting', month: '2026-09', days: '16', time: '2:00 p.m.' };
const yahooRow = { event: 'GDP Final', countryCode: 'US', eventTime: at('2026-09-30T12:30Z'), prior: '2.5%', actual: '2.6%' };
const yahooFeed = (records = [yahooRow], totalCount = records.length) => ({ finance: { error: null, result: { economicEvents: [{ totalCount, records }] } } });
const ics = (...events) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events.map((e) => ['BEGIN:VEVENT', e, 'END:VEVENT'].join('\r\n')), 'END:VCALENDAR'].join('\r\n');
const blsRow = 'UID:cpi-september\r\nSUMMARY:Consumer Price Index\r\nDTSTART;TZID=America/New_York:20260911T083000';
const sourceResponse = (events, checkedAt = Date.now()) => ({ events, checkedAt });

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
});
test.after(async () => { try { await server?.close(); } catch { /* Vite SSR teardown */ } });

test('FOMC uses the next WIB date, explicit UTC milliseconds, and distinct press conference', () => {
  const [meeting, press] = model.normalizeFedCalendar({ events: [fedRow, { ...fedRow, title: 'FOMC Press Conference', time: '2:30 p.m.' }, {}] });
  assert.equal(meeting.timestamp, at('2026-09-16T18:00Z'));
  assert.equal(meeting.date, '2026-09-17');
  assert.equal(meeting.time, '01:00 WIB');
  assert.equal(press.time, '01:30 WIB');
  assert.notEqual(meeting.id, press.id);
  assert.equal(model.calendarDate(at('2026-09-30T18:00Z')), '2026-10-01');
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

test('BLS reads explicit ET/UTC timestamps, folded text, revisions and cancellations', () => {
  const events = model.normalizeBlsCalendar(ics(
    blsRow.replace('Price Index', 'Price In\r\n dex'),
    'UID:jobs\r\nSUMMARY:Employment Situation\r\nDTSTART:20260904T123000Z',
    'UID:jolts\r\nSUMMARY:Job Openings and Labor Turnover\r\nDTSTART;TZID=America/New_York:20260929T100000',
    blsRow + '\r\nSEQUENCE:1\r\nSTATUS:CANCELLED',
    blsRow,
  ));
  assert.deepEqual(events.map((e) => e.title), ['Employment Situation', 'Job Openings and Labor Turnover']);
  assert.equal(events[0].time, '19:30 WIB');
  assert.equal(events[1].time, '21:00 WIB');
  const [cpi] = model.normalizeBlsCalendar(ics(blsRow.replace('Price Index', 'Price In\r\n dex')));
  assert.equal(cpi.title, 'Consumer Price Index');
  assert.equal(cpi.date, '2026-09-11');
  assert.equal(cpi.forecast, undefined);
});

test('Unknown release time remains null and never produces a countdown or midnight guess', () => {
  const [bls] = model.normalizeBlsCalendar(ics('UID:date-only\r\nSUMMARY:Consumer Price Index\r\nDTSTART;VALUE=DATE:20260911'));
  const [fed] = model.normalizeFedCalendar({ events: [{ ...fedRow, time: 'To be announced' }] });
  assert.equal(bls.timestamp, null);
  assert.equal(fed.timestamp, null);
  assert.equal(bls.time, '');
  assert.equal(model.nextCalendarCatalyst([bls, fed], at('2026-09-01T00:00Z')), null);
});

test('Malformed schedules fail validation instead of inventing or silently dropping dates', () => {
  assert.throws(() => model.normalizeBlsCalendar('<html>Access Denied</html>'));
  assert.throws(() => model.normalizeBlsCalendar(ics(blsRow.replace('DTSTART;TZID=America/New_York', 'DTSTART'))));
  assert.throws(() => model.normalizeBlsCalendar(ics(blsRow + '\r\nRRULE:FREQ=MONTHLY')));
  assert.throws(() => model.normalizeBeaCalendar({ error: 'denied' }));
  assert.throws(() => model.normalizeBeaCalendar({}));
  assert.throws(() => model.normalizeFedCalendar({ events: [{ ...fedRow, days: '15-16' }] }));
  assert.throws(() => model.normalizeFedCalendar({ events: [{ ...fedRow, time: '13:00 p.m.' }] }));
  assert.throws(() => model.normalizeFedCalendar({ events: [{}] }));
});

test('BEA deduplicates dates per publication, keeping GDP and PCE separate and values absent', () => {
  const events = model.normalizeBeaCalendar({ ...beaFeed, 'Gross Domestic Product': { release_dates: Array(2).fill('2026-09-30T12:30:00+00:00') }, file_last_updated: '2026-07-13' });
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((e) => e.title), ['Gross Domestic Product', 'Personal Income and Outlays']);
  assert.ok(events.every((e) => e.time === '19:30 WIB' && !e.actual && !e.forecast && !e.previous));
});

test('Yahoo detects truncation from totalCount and preserves zero while normalizing absent values', () => {
  const { events, partial } = model.normalizeYahooCalendar(yahooFeed([{ ...yahooRow, actual: 0, prior: ' N/A ' }, { ...yahooRow, event: 'Other', actual: null, prior: '' }], 596));
  assert.equal(partial, true);
  assert.equal(events[0].actual, '0');
  assert.equal(events[0].previous, undefined);
  assert.equal(events[1].actual, undefined);
  assert.equal(model.normalizeYahooCalendar(yahooFeed([], 0)).partial, false);
  assert.throws(() => model.normalizeYahooCalendar({ finance: { error: { code: 'unauthorized' } } }));
  assert.throws(() => model.normalizeYahooCalendar(yahooFeed([{ ...yahooRow, eventTime: 'not a timestamp' }])));
});

test('Official publication families replace Yahoo series, including reschedules; unrelated series survive', () => {
  const official = model.normalizeBeaCalendar(beaFeed);
  const yahoo = model.normalizeYahooCalendar(yahooFeed([
    yahooRow,
    { ...yahooRow, event: 'GDP Advance', eventTime: at('2026-09-29T12:30Z') },
    { ...yahooRow, event: 'Core PCE Price Idx', actual: '0.2%' },
    { ...yahooRow, event: 'CPI' },
    { ...yahooRow, event: 'GDP Final', countryCode: 'GB' },
    { ...yahooRow, event: 'USDA Cattle' },
    { ...yahooRow, event: 'Dallas Fed Trimmed Mean PCE' },
  ])).events;
  const merged = model.mergeCalendarEvents([...official, ...yahoo]);
  assert.equal(merged.length, 6);
  assert.equal(merged.find((e) => e.title === 'Gross Domestic Product').actual, undefined);
  assert.ok(merged.some((e) => e.title === 'CPI' && e.source === 'yahoo'));
  assert.ok(merged.some((e) => e.country === 'GB'));
  assert.ok(merged.some((e) => e.title.includes('Dallas')));
  assert.equal(model.releaseFamily('Gross Domestic Product by State and Personal Income by State'), null);
});

test('One currency filter feeds agenda, weekly counts and future-only catalyst selection', () => {
  const events = model.normalizeYahooCalendar(yahooFeed([
    { ...yahooRow, event: 'CPI', eventTime: at('2026-09-10T12:30Z') },
    { ...yahooRow, event: 'GDP UK', countryCode: 'GB', eventTime: at('2026-09-28T12:30Z') },
    yahooRow,
  ])).events;
  const usd = model.filterCalendarEvents(events, { currency: 'USD', impact: 'all', asset: 'all', search: '' });
  assert.equal(usd.length, 2);
  assert.ok(usd.every((e) => e.country === 'US'));
  assert.equal(model.nextCalendarCatalyst(usd, at('2026-09-27T12:30Z')).title, 'GDP Final');
  assert.equal(model.nextCalendarCatalyst(usd, at('2026-10-01T12:30Z')), null);
});

test('Fetches four sources independently, countPerDay=100 and complete edge weeks; failed BLS stays visible', async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    if (url.endsWith('/bls')) return new Response('Denied', { status: 403 });
    if (url.endsWith('/bea')) return Response.json(sourceResponse(model.normalizeBeaCalendar(beaFeed)));
    if (url.endsWith('/fed')) return Response.json(sourceResponse(model.normalizeFedCalendar({ events: [fedRow] })));
    return Response.json(yahooFeed([yahooRow], 596));
  };
  const data = await service.fetchEconomicCalendar('2026-09');
  assert.equal(urls.length, 4);
  const params = new URL(urls.find((url) => url.includes('yahoo')), 'https://test.example').searchParams;
  assert.equal(params.get('countPerDay'), '100');
  assert.equal(params.get('startDate'), String(at('2026-08-30T17:00Z')));
  assert.equal(params.get('endDate'), String(at('2026-10-04T16:59:59.999Z')));
  assert.equal(data.sources.find((s) => s.source === 'bls').status, 'unavailable');
  assert.equal(data.sources.find((s) => s.source === 'yahoo').status, 'partial');
  assert.equal(data.events.length, 3);
});

test('All failures and damaged normalized payloads are not reported as successful empty calendars', async () => {
  globalThis.fetch = async (url) => url.endsWith('/bls') ? Promise.reject(new Error('offline')) : Response.json({ events: 'broken', checkedAt: Date.now() });
  const data = await service.fetchEconomicCalendar('2026-09');
  assert.deepEqual(data.events, []);
  assert.equal(data.sources.length, 4);
  assert.ok(data.sources.every((s) => s.status === 'unavailable'));
});

test('Stale cache retains its check time and expires instead of showing old events indefinitely', async () => {
  const checkedAt = Date.now() - 3_600_000;
  globalThis.fetch = async (url) => url.endsWith('/bea')
    ? Response.json(sourceResponse(model.normalizeBeaCalendar(beaFeed), checkedAt), { headers: { 'X-Rabalaba-Cache': 'stale' } })
    : new Response('', { status: 502 });
  const data = await service.fetchEconomicCalendar('2026-09');
  assert.equal(data.sources.find((s) => s.source === 'bea').checkedAt, checkedAt);
  assert.equal(data.sources.find((s) => s.source === 'bea').stale, true);
  assert.equal(data.events.length, 2);
  const expired = model.availableCalendarData(data, checkedAt + model.CALENDAR_MAX_AGE_MS + 1);
  assert.equal(expired.events.length, 0);
  assert.ok(expired.sources.every((s) => s.status === 'unavailable'));
});

test('Route only accepts fixed GET sources, never an arbitrary URL or forwarded user input', async () => {
  globalThis.fetch = async () => assert.fail('invalid requests must not fetch');
  for (const [source, method, search, status] of [['example.com', 'GET', '', 404], ['constructor', 'GET', '', 404], ['bea', 'POST', '', 405], ['bea', 'GET', '?url=https://other.example', 400]]) {
    const response = await route.onRequest({ request: new Request(`https://test.example/api/calendar/${source}${search}`, { method }), params: { source } });
    assert.equal(response.status, status);
  }
});

test('Route caches validated success, recovers stale on blocked or malformed upstream, and preserves check time', async () => {
  const entries = new Map();
  globalThis.caches = { default: {
    async match(request) { return entries.get(request.url)?.clone(); },
    async put(request, response) { entries.set(request.url, response.clone()); },
    async delete(request) { return entries.delete(request.url); },
  } };
  const waits = [];
  const context = { request: new Request('https://test.example/api/calendar/bea'), params: { source: 'bea' }, waitUntil: (promise) => waits.push(promise) };
  let calls = 0;
  globalThis.fetch = async (url, init) => { calls++; assert.equal(String(url), 'https://apps.bea.gov/API/signup/release_dates.json'); assert.ok(init.signal); return Response.json(beaFeed); };
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

test('Other loaded BEA publications replace their Yahoo equivalents without swallowing regional data', () => {
  const official = model.normalizeBeaCalendar({
    ...beaFeed,
    'Corporate Profits': { release_dates: ['2026-09-30T12:30:00+00:00'] },
    'U.S. International Transactions and Investment Position': { release_dates: ['2026-09-24T12:30:00+00:00'] },
  });
  const yahoo = model.normalizeYahooCalendar(yahooFeed([
    { ...yahooRow, event: 'Corporate Profits Revised*' },
    { ...yahooRow, event: 'Current Account*', eventTime: at('2026-09-24T12:30Z') },
    { ...yahooRow, event: 'Consumption, Adjusted MM*' },
    { ...yahooRow, event: 'Dallas Fed PCE*' },
  ])).events;
  const result = model.mergeCalendarEvents([...official, ...yahoo]);
  assert.equal(result.length, 5);
  assert.equal(result.filter((e) => e.source === 'yahoo')[0].title, 'Dallas Fed PCE*');
  assert.equal(result.find((e) => e.title === 'Corporate Profits').impact, 'medium');
});

test('Client rejects source spoofing, wrong WIB dates and expired payloads; valid empty results stay distinct', async () => {
  const event = model.normalizeBeaCalendar(beaFeed)[0];
  for (const payload of [
    sourceResponse([{ ...event, sourceUrl: 'https://untrusted.example' }]),
    sourceResponse([{ ...event, date: '2026-09-29' }]),
    sourceResponse([{ ...event, source: 'fed' }]),
    sourceResponse([event], Date.now() - model.CALENDAR_MAX_AGE_MS - 1),
  ]) {
    globalThis.fetch = async (url) => url.endsWith('/bea') ? Response.json(payload) : new Response('', { status: 503 });
    const result = await service.fetchEconomicCalendar('2026-09');
    assert.equal(result.events.length, 0);
    assert.equal(result.sources.find((s) => s.source === 'bea').status, 'unavailable');
  }
  globalThis.fetch = async (url) => url.includes('yahoo') ? Response.json(yahooFeed([], 0)) : Response.json(sourceResponse([]));
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
