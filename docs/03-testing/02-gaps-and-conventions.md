# Pengujian 02 — Gap dan Convention / Testing 02 — Gaps and Conventions

> Status verifikasi: angka dan path diverifikasi pada 2026-09-16. Kanonis: 45 file / 422 case (`node --test tests/*.test.mjs`); `MIN_CALIBRATION_SAMPLE=30`; `MIN_CANDLES=120`; `PRICE_DIVERGENCE_MAX=0.3`.
> Verification status: figures and paths verified on 2026-09-16. Canonical: 45 files / 422 cases (`node --test tests/*.test.mjs`); `MIN_CALIBRATION_SAMPLE=30`; `MIN_CANDLES=120`; `PRICE_DIVERGENCE_MAX=0.3`.

[Bahasa Indonesia](#bagian-id) · [English](#english-part)

## Bagian ID

### Celah coverage

Coverage terkonsentrasi di pure core (engine, follow-trade, discovery, alerts, proxy). Area berikut belum ter-unit-test:

| Area | File contoh | Sebab | Risiko |
|---|---|---|---|
| Edge Function I/O handler | `supabase/functions/auto-journal/index.ts`, `daily-summary/index.ts`, `asset-discovery/index.ts` | I/O-heavy (fetch, DB, Discord); correctness di-anchor pada pure core hasil bundle plus diagnostik `scripts/find-phantom-closes.mjs` | Bug wiring fetch/DB/gating lolos; clock-align, dedup, dan atomic claim kompleks tanpa test otomatis |
| UI components | `src/features/*/components/*.tsx`, `src/components/*` | Komponen React butuh DOM/jsdom dan render test; `node --test` tidak menyediakan jsdom env | Render crash, prop drift, dan bug memoization lolos otomatisasi |
| Hooks query/admin | `src/hooks/use-*.ts`, `src/services/queries/*` | Butuh react-query, Supabase client, dan mock auth context | queryKey drift, bug optimistic-update, dan interaksi RLS lolos |
| Adapter sebagian | `yahoo-adapter.ts` | Baru path crypto daily-change yang ter-cover via `engine-extras` | AssetType detect, HTF resample, dan fallback sinyal berisiko |
| Supabase mapper | `journal-mapper.ts` | Modul pure tanpa file test langsung | Drift field snake-camel lolos |
| Calendar API | `calendar.ts` | Network tanpa mock fixture | Auto-classify impact dan flatten error lolos |

### Rekomendasi test baru (9 prioritas)

#### Prioritas tinggi

1. **`auto-journal-gating.test.mjs`** — Ekstrak gating dari `index.ts` (clock-align `slotMin % interval === 0`, dedup `last_run_at`, `market_hours_only` plus `isMarketOpen`) menjadi helper pure, lalu test semua cabang.
2. **`daily-summary-send-once.test.mjs`** — Ekstrak atomic send-once claim (conditional UPDATE per kind, release on failure) menjadi decision pure, lalu test skenario race.
3. **`journal-mapper.test.mjs`** — Test round-trip `rowToFollowedTrade` dan `followedTradeToInsert` (snake-camel, array field, null handling). Murni pure dan cepat.
4. **`asset-discovery-validation.test.mjs`** — Test round-trip `validateMarket` (bar count `MIN_CANDLES=120`, `PRICE_DIVERGENCE_MAX=0.3`) sebagai logic pure.

#### Prioritas sedang

5. **`yahoo-adapter.test.mjs`** — Test full path `adaptYahooChart` dengan fixture `YahooChartResult` (detectAssetType, faktor resample HTF, baseline crypto versus equity, fallback `createUnavailableSignal`).
6. **`react-query-key.test.mjs`** — Test stabilitas query key (dominance baked ke crypto context, `usePeriodCandles` Infinity, `useSmartMoney` plain object). Butuh setup test react-query.
7. **`recharts-memo.test.mjs`** (jsdom) — Test anti cascade-render chart dengan props identity-stable (regresi tabel histori dan dashboard jurnal).

#### Prioritas rendah

8. **UI smoke test** (opsional, tanpa dependensi browser tambahan) — Render `/terminal` lewat browser/in-app browser, assert tanpa crash dan elemen kunci visible.
9. **`calendar-impact.test.mjs`** — Test auto-classify impact `fetchEconomicCalendar` (GDP/CPI/rate ke high, sentiment/sales/PMI ke low) dengan fixture. Sedikit spill konteks makro membantu review fixture.

### Convention pattern

Boilerplate bootstrap untuk test baru:

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

| Convention | Detail |
|---|---|
| File naming | `tests/<topic>.test.mjs` (kebab-case) |
| Import path | `await load("@/core/engine/signals.ts")` (alias `@`) |
| Fixture | Array literal hand-computed inline; tanpa folder `fixtures/` |
| Assertion | `assert.strictEqual`, `assert.deepEqual`, `assert.ok`, `assert.throws` |
| Nama test | `test("nama kasus")` deskriptif, menyebut fungsi dan skenario |
| unhandledRejection | Beberapa file meredam noise teardown Vite |
| Tanpa mock library | Mock manual atau inject input pure |
| Pure-first | Modul I/O di-extract menjadi decision pure sebelum di-test |

Pola test pure decision untuk menutup gap:

```js
// Logic I/O-heavy di index.ts di-extract dulu:
// supabase/functions/auto-journal/index.ts -> gating pure -> test tanpa mock fetch/DB
test("clock-align: slotMin % interval === 0 berjalan", () => {
  const result = shouldRun({ slotMin: 30, interval: 30, lastRunAt: null, now: 1000 });
  assert.strictEqual(result, true);
});
```

### Target metrik

Target realistis: pure core bertahan mendekati 100%, gating Edge I/O naik menuju 70% lewat extract helper pure, smoke UI 1–2 file menutup happy-path render. Ekstraksi pure-first lebih maintainable daripada over-mock, jadi eksekusi rekomendasi prioritas tinggi dulu sebelum menambah mock berat. Langkah penutup dibuat gas: kunci 4 test prioritas tinggi, lalu ukur ulang coverage gating.

### Terkait

- [`00-overview.md`](00-overview.md) — framework
- [`01-coverage-inventory.md`](01-coverage-inventory.md) — inventaris
- [`../02-technical-specs/06-engine-internals.md`](../02-technical-specs/06-engine-internals.md) — modul yang di-test
- [`../02-technical-specs/05-edge-functions.md`](../02-technical-specs/05-edge-functions.md) — I/O handler yang gap

## English Part

### Coverage gaps

Coverage concentrates on the pure core (engine, follow-trade, discovery, alerts, proxy). The following areas lack unit tests:

| Area | Example files | Cause | Risk |
|---|---|---|---|
| Edge Function I/O handlers | `supabase/functions/auto-journal/index.ts`, `daily-summary/index.ts`, `asset-discovery/index.ts` | I/O-heavy (fetch, DB, Discord); correctness anchors on the bundled pure core plus the `scripts/find-phantom-closes.mjs` diagnostic | Fetch/DB/wiring bugs slip through; clock-align, dedup, and atomic claims stay complex without automated tests |
| UI components | `src/features/*/components/*.tsx`, `src/components/*` | React components need a DOM/jsdom plus render tests; `node --test` provides no jsdom env | Render crashes, prop drift, and memoization bugs escape automation |
| Query/admin hooks | `src/hooks/use-*.ts`, `src/services/queries/*` | Require react-query, Supabase client, and auth-context mocks | queryKey drift, optimistic-update bugs, and RLS interaction escape detection |
| Partial adapters | `yahoo-adapter.ts` | Only the crypto daily-change path holds coverage via `engine-extras` | AssetType detection, HTF resample, and signal fallbacks stay at risk |
| Supabase mapper | `journal-mapper.ts` | Pure module without a direct test file | Snake-camel field drift escapes detection |
| Calendar API | `calendar.ts` | Network code without mock fixtures | Impact auto-classification and flatten errors escape detection |

### New-test recommendations (9 priorities)

#### High priority

1. **`auto-journal-gating.test.mjs`** — Extract gating from `index.ts` (clock-align `slotMin % interval === 0`, `last_run_at` dedup, `market_hours_only` plus `isMarketOpen`) into pure helpers, then test all branches.
2. **`daily-summary-send-once.test.mjs`** — Extract the atomic send-once claim (conditional UPDATE per kind, release on failure) into a pure decision, then test race scenarios.
3. **`journal-mapper.test.mjs`** — Test the `rowToFollowedTrade` and `followedTradeToInsert` round-trip (snake-camel, array fields, null handling). Pure and fast.
4. **`asset-discovery-validation.test.mjs`** — Test the `validateMarket` round-trip (`MIN_CANDLES=120` bar count, `PRICE_DIVERGENCE_MAX=0.3`) as pure logic.

#### Medium priority

5. **`yahoo-adapter.test.mjs`** — Test the full `adaptYahooChart` path with a `YahooChartResult` fixture (detectAssetType, HTF resample factor, crypto-versus-equity baseline, `createUnavailableSignal` fallback).
6. **`react-query-key.test.mjs`** — Test query-key stability (dominance baked into crypto context, `usePeriodCandles` Infinity, `useSmartMoney` plain object). Requires a react-query test setup.
7. **`recharts-memo.test.mjs`** (jsdom) — Test chart components against cascade renders with identity-stable props (history-table and journal-dashboard regression).

#### Low priority

8. **UI smoke test** (optional, no extra browser dependency) — Render `/terminal` through a browser/in-app browser, assert a crash-free render with key elements visible.
9. **`calendar-impact.test.mjs`** — Test `fetchEconomicCalendar` impact auto-classification (GDP/CPI/rates to high, sentiment/sales/PMI to low) with fixtures.

### Convention patterns

Bootstrap boilerplate for new tests:

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

| Convention | Detail |
|---|---|
| File naming | `tests/<topic>.test.mjs` (kebab-case) |
| Import paths | `await load("@/core/engine/signals.ts")` (`@` alias) |
| Fixtures | Inline hand-computed array literals; no `fixtures/` folder |
| Assertions | `assert.strictEqual`, `assert.deepEqual`, `assert.ok`, `assert.throws` |
| Test names | Descriptive `test("case name")` strings naming function and scenario |
| unhandledRejection | Some files dampen Vite teardown noise |
| No mock library | Manual mocks or pure-input injection |
| Pure-first | I/O modules become pure decisions before testing |

Pure-decision test pattern for closing gaps:

```js
// Extract I/O-heavy logic from index.ts first:
// supabase/functions/auto-journal/index.ts -> pure gating -> test without fetch/DB mocks
test("clock-align: slotMin % interval === 0 passes", () => {
  const result = shouldRun({ slotMin: 30, interval: 30, lastRunAt: null, now: 1000 });
  assert.strictEqual(result, true);
});
```

### Metric targets

Realistic targets: the pure core stays near 100%, Edge I/O gating rises toward 70% through pure-helper extraction, and 1–2 UI smoke files cover happy-path renders. Pure-first extraction stays more maintainable than over-mocking, so execute the high-priority recommendations before adding heavy mocks.

### Related

- [`00-overview.md`](00-overview.md) — framework
- [`01-coverage-inventory.md`](01-coverage-inventory.md) — inventory
- [`../02-technical-specs/06-engine-internals.md`](../02-technical-specs/06-engine-internals.md) — modules under test
- [`../02-technical-specs/05-edge-functions.md`](../02-technical-specs/05-edge-functions.md) — gap I/O handlers
