# Testing 02 — Gaps & Conventions

> 🇮🇩 Celah coverage + rekomendasi test baru + convention pattern.
> 🇺🇸 Coverage gaps + new-test recommendations + convention pattern.

---

## 🕳️ Celah coverage / Coverage gaps

🇮🇩 Coverage terkonsentrasi di **pure core** (engine, follow-trade, discovery, alerts, proxy). Yang **gak** ter-unit-test:

🇺🇸 Coverage is concentrated in the **pure core**. What is **not** unit-tested:

| Area | File | Kenapa gak / Why not | Risiko / Risk |
|---|---|---|---|
| Edge Function I/O handler | `supabase/functions/{auto-journal,daily-summary,asset-discovery}/index.ts` | I/O heavy (fetch, DB, Discord). Correctness di-anchor pure core yang di-bundle + manual `find-phantom-closes.mjs` diagnostic. | Bug di wiring fetch/DB/gating bisa lewat. Gating logic (`interval_minutes` clock-align, atomic send-once claim) kompleks & gak ter-test otomatis. |
| UI components | `src/features/*/components/*.tsx`, `src/components/*` | React component butuh DOM/jsdom + render test. `node --test` gak punya jsdom env. | Render crash, prop drift, memoization bug (recharts cascade, react-query structural-sharing loop) gak tertangkap otomatis. |
| Hooks (query/admin) | `src/hooks/use-*.ts`, `src/services/queries/*` | Butuh react-query + Supabase client + auth context mock. | queryKey drift, optimistic-update bug, RLS interaction gak tertangkap. |
| Adapters (sebagian) | `yahoo-adapter.ts` | Hanya `engine-extras` test F&G scope + crypto daily change. Full `adaptYahooChart` path gak ter-test lengkap. | AssetType detect, HTF resample, signal fallback bug. |
| Supabase mapper | `journal-mapper.ts` | Pure tapi gak ada test file langsung. | snake↔camel field drift. |
| Calendar/fng API | `calendar.ts`, `fear-greed.ts` | Network; gak di-mock. | Auto-classify impact, flatten bug. |

---

## ➕ Rekomendasi test baru / New-test recommendations

### Prioritas tinggi / High priority

1. **`auto-journal-gating.test.mjs`** — extract gating logic dari `index.ts` (clock-align `slotMin % interval === 0`, dedup `last_run_at`, `market_hours_only` `isMarketOpen`) jadi pure helper, lalu test. Sekarang gating kompleks & gak ter-test otomatis.
2. **`daily-summary-send-once.test.mjs`** — extract atomic send-once claim (conditional UPDATE per kind + release on failure) jadi pure decision, test race scenario.
3. **`journal-mapper.test.mjs`** — test `rowToFollowedTrade` + `followedTradeToInsert` round-trip (snake↔camel, array field, null handling). Pure, gampang.
4. **`asset-discovery-validation.test.mjs`** — test `validateMarket` round-trip bar count (`MIN_CANDLES 120`, `PRICE_DIVERGENCE_MAX 0.3`) pure logic.

### Prioritas sedang / Medium

5. **`yahoo-adapter.test.mjs`** — test `adaptYahooChart` full path dengan fixture `YahooChartResult` (detectAssetType, HTF resample factor, daily change baseline convention crypto vs equity, `createUnavailableSignal` fallback).
6. **`react-query-key.test.mjs`** — test query key stability (fearGreedValue/`dominance` baked, `usePeriodCandles` `Infinity`, `useSmartMoney` plain object bukan Map). Butuh react-query test setup.
7. **`recharts-memo.test.mjs`** (jsdom) — test chart component gak cascade-renders dengan identity-stable props (regresi `follow-history-table` / `journal-dashboard`).

### Prioritas rendah / Low

8. **UI smoke test** (puppeteer-core udah dev dep) — render `/terminal` headless, assert no crash, key element visible.
9. **`calendar-impact.test.mjs`** — test `fetchEconomicCalendar` auto-classify impact (GDP/CPI/rate→high, sentiment/sales/PMI→low) dengan fixture.

---

## 🧾 Convention pattern (buat nambah test)

### Boilerplate bootstrap
```js
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

let server;
test.before(async () => {
  server = await createServer({
    appType: "custom",
    configFile: "vite.config.ts",
    logLevel: "silent",
    server: { middlewareMode: true, watch: null },
  });
});
test.after(async () => { await server.close(); });

const load = (path) => server.ssrLoadModule(path);
```

### Konvensi yang udah dipakai
| Konvensi / Convention | Detail |
|---|---|
| File naming | `tests/<topic>.test.mjs` (kebab-case) |
| Import path | `await load("@/features/engine/signals.ts")` (pakai alias `@`) |
| Fixture | hand-computed array literal inline; gak ada folder `fixtures/` |
| Assertion | `assert.strictEqual`, `assert.deepEqual`, `assert.ok`, `assert.throws` |
| Naming test | `test("nama kasus")` deskriptif, sering sebut nama fungsi + skenario |
| unhandledRejection | beberapa file pasang `process.on("unhandledRejection", ()=>{})` swallow Vite-teardown noise |
| No mock library | manual mock (e.g. `proxy.test.mjs` in-memory `caches.default`), atau inject pure input |
| Pure-first | kalau modul I/O, extract pure decision dulu baru test itu |

### Pola test pure decision (recommended buat gap)
```js
// Kalau logic di index.ts I/O-heavy, extract pure helper dulu:
// supabase/functions/auto-journal/index.ts → supabase/functions/auto-journal/gating.ts (pure)
// lalu test gating.ts tanpa mock fetch/DB
test("clock-align: slotMin % interval === 0 jalan", () => {
  const result = shouldRun({ slotMin: 30, interval: 30, lastRunAt: null, now: 1000 });
  assert.strictEqual(result, true);
});
```

---

## 📈 Metric target

🇮🇩 Target realistis: pure core tetap ~100% (sekarang udah mendekati), Edge I/O gating naik ke ~70% (extract pure helper), UI smoke test 1-2 file cover happy-path render. Hindari over-mock — pure-first extract lebih maintainable.

🇺🇸 Realistic target: pure core stays ~100% (near-current), Edge I/O gating rises to ~70% (extract pure helpers), UI smoke 1-2 files cover happy-path render. Avoid over-mocking — pure-first extraction is more maintainable.

---

## 🔗 Terkait / Related
- [`00-overview.md`](00-overview.md) — framework
- [`01-coverage-inventory.md`](01-coverage-inventory.md) — inventory
- [`../tsd/06-engine-internals.md`](../tsd/06-engine-internals.md) — modul yang di-test
- [`../tsd/05-edge-functions.md`](../tsd/05-edge-functions.md) — I/O handler yang gap
