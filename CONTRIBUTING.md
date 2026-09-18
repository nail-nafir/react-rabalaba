# Contributing to RabaLaba

> 🇮🇩 Convention code, branching, env setup, dan PR flow untuk onboarding cepat plus arsip ingatan tim.
> 🇺🇸 Code conventions, branching, env setup, plus PR flow for fast onboarding plus team memory archive.

Terverifikasi: 2026-09-16 | Verified: 2026-09-16 — Kanonis: 45 file / 422 case, 38 migrasi, 16 tabel, 28 RPC.

[Bahasa Indonesia](#bagian-id) · [English](#english-part)

<a id="bagian-id"></a>

## 🇮🇩 Onboarding

```bash
git clone <repo> && cd react-rabalaba
npm install
cp .env.example .env
# Isi: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (dari dashboard Supabase → Settings → API)
npm run dev          # SPA → http://localhost:5173
npm test             # pastikan 422 case pass
npm run lint
```

Cron lokal (opsional, alur sat-set):

```bash
npm run build:edge   # bundle _engine.mjs dulu
# isi supabase/functions/.env (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, gitignored)
supabase functions serve auto-journal --env-file supabase/functions/.env
```

> Detail rebuild DB: [`supabase/README.md`](supabase/README.md). Deploy: [`docs/02-technical-specs/07-deployment.md`](docs/02-technical-specs/07-deployment.md).

## 🇮🇩 Branching dan PR Flow

| Branch | Peran |
|---|---|
| `main` | Produksi (deploy ke `rabalaba.pages.dev`) |
| `feat/<kebab-case>` | Fitur baru |
| `fix/<kebab-case>` | Bug fix |
| `docs/<kebab-case>` | Dokumentasi |
| `chore/<kebab-case>` | Refactor, dep bump, config |

Alur PR:

1. Branch baru dari `main`.
2. Commit kecil imperatif (`add ...`, `fix ...`, `refactor ...`).
3. `npm run build && npm run lint && npm test` pass lokal sebelum push.
4. PR ke `main` plus self-review diff.
5. Merge setelah yakin. Deploy manual (tanpa CI otomatis untuk saat ini).

## 🇮🇩 Convention Code

Umum:

- **TypeScript strict** (`tsconfig.app.json` — `noUnusedLocals/Parameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`).
- **Minim komentar** — kode self-documenting. Komentar hanya untuk alasan yang tidak obvious, bukan deskripsi ulang.
- **Pure-first**: logika keputusan = pure function (tanpa DOM, fetch, `Date.now`). I/O wiring terpisah. Lihat arsitektur (`02-tsd/00-architecture.md`).
- **Referensi modul** memakai format `nama-file › nama-fungsi` (tanpa nomor baris rapuh).

Naming:

| Tipe | Convention | Contoh |
|---|---|---|
| File komponen | `kebab-case.tsx` | `asset-signal-table.tsx` |
| File lib/engine | `kebab-case.ts` | `follow-trade-model.ts` |
| Hook | `use-<thing>.ts`, export `use<Thing>` | `use-auth.ts` → `useAuth` |
| Query hook | queryKey `["<thing>",…]` | `useCryptoDominance` → `["dominance"]` |
| Type/interface | `PascalCase` | `UnifiedAsset`, `Outlook` |
| Constant | `UPPER_SNAKE` | `SIGNAL_THRESHOLDS` |
| RPC (DB) | `snake_case` | `redeem_access_code` |
| Migration | `YYYYMMDDNNNNNN_<name>.sql` | `20260702000001_asset_discovery.sql` |
| Doc | `NN-kebab-case.md` | `02-trading-engine.md` |

Struktur:

- `src/features/<area>/` — slice fitur vertikal.
- `src/core/` — pure core yang di-bundle ke cron via facade `edge-engine.ts`.
- `src/services/{api,adapters,queries,supabase}/` — data layer.
- `src/hooks/` — hook non-query generik.
- `src/store/` — Redux slices.
- `src/constants/taxonomy/` — source of truth statis.
- `src/types/` — kontrak TypeScript.
- `src/components/{ui,charts,shared,layout}/` — UI reusable.
- `src/app/{config,providers,router,layouts}/` — app shell.
- `functions/api/` — proxy Cloudflare Pages.
- `supabase/{migrations,functions,schedule-*.sql}/` — backend.
- `tests/` — `node --test` plus Vite SSR load real `.ts`.

Engine (load-bearing):

- **Single-source**: engine `src/core/engine/`, normalisasi `src/core/market/`, automation `src/core/automation/` di-bundle ke cron. Tanpa duplikasi logika di `index.ts` function — import dari `_engine.mjs`.
- **Urutan enrichment** load-bearing, tidak boleh diacak.
- **Strength = alignment teknikal, bukan probabilitas menang**. Label i18n tidak boleh berubah menjadi probabilitas.
- **Tanpa flip sinyal** di enrichment (nudge bounded).
- **Phantom guard**: hanya candle timestamped memutuskan TP/SL. Spot price tidak dipakai.

i18n dan state:

- Tiap value domain wajib punya label-key map ke namespace `common`/`dialog`/`journal`/`admin`. Tanpa string-concat label literal.
- **Redux** `{ui,filter,auth}` — ephemeral UI/filter/session only. Seluruh server data di react-query. Tanpa Zustand (legacy, sudah dihapus).

DB dan migrasi:

- **Append-only**. Schema berubah = file migrasi baru. Tanpa edit file yang sudah apply di prod.
- **Idempotent** (`create ... if not exists`, `create or replace`, `drop policy if exists`).
- **Tanpa squash** — tiap file = satu fase audit trail.
- Langkah MANUAL (seed code, grant admin, cron secret) membawa secret sehingga keluar dari git.

## 🇮🇩 Secret Rules

| Boleh commit | Dilarang commit |
|---|---|
| `.env.example` (nama key tanpa value) | `.env` (berisi value) |
| Kode publik, query key, schema | Service-role key, access code, webhook URL |
| Template `supabase/functions/.env` | `supabase/functions/.env` berisi value (gitignored) |

Detail: [`docs/04-operations/01-security.md`](docs/04-operations/01-security.md).

## 🇮🇩 Test

- Framework: `node --test` plus `node:assert/strict`. Load real `.ts` via Vite SSR (`ssrLoadModule`).
- **Pure-first**: modul I/O di-extract menjadi decision pure dulu baru di-test (hindari over-mock).
- Convention: `tests/<topic>.test.mjs`, `await load("@/path/to/source.ts")`, fixture inline hand-computed.
- Target: pure core ~100%, gating Edge I/O ~70% (via extract helper), smoke UI 1–2 file.
- Gap dan rekomendasi: [`docs/03-testing/02-gaps-and-conventions.md`](docs/03-testing/02-gaps-and-conventions.md).

## 🇮🇩 Dokumentasi

- Sekuensial ID penuh lalu EN penuh per file (diputuskan 2026-09-16). Tanpa pronomina standalone (daftar blacklist di tiap template). Panjang ID/EN setara (±20%).
- Struktur: `docs/{01-functional-specs,02-technical-specs,03-testing,04-operations,05-explainers}/` plus indeks [`docs/README.md`](docs/README.md).
- Fakta kanonis: 45 file / 422 case, 38 migrasi, 16 tabel, 28 RPC, `MIN_CALIBRATION_SAMPLE=30`.
- Drift fix: dokumen yang tidak match kode diperbaiki di PR yang sama.

## 🇮🇩 Checklist Pre-PR

```bash
npm run build && npm run lint && npm test
```

- [ ] Build pass (`tsc -b + vite build`)
- [ ] Lint pass (eslint)
- [ ] Test pass (422 case)
- [ ] Tanpa secret di diff
- [ ] Drift dokumen diperbaiki bila ada
- [ ] Migrasi baru (bila ubah schema) append-only plus idempotent

---

<a id="english-part"></a>

## 🇺🇸 Onboarding

```bash
git clone <repo> && cd react-rabalaba
npm install
cp .env.example .env
# Fill: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (from Supabase dashboard → Settings → API)
npm run dev          # SPA → http://localhost:5173
npm test             # all 422 cases pass
npm run lint
```

Local cron (optional, tidy flow):

```bash
npm run build:edge   # bundle _engine.mjs first
# fill supabase/functions/.env (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, gitignored)
supabase functions serve auto-journal --env-file supabase/functions/.env
```

> DB rebuild detail: [`supabase/README.md`](supabase/README.md). Deploy: [`docs/02-technical-specs/07-deployment.md`](docs/02-technical-specs/07-deployment.md).

## 🇺🇸 Branching and PR Flow

| Branch | Role |
|---|---|
| `main` | Production (deploys to `rabalaba.pages.dev`) |
| `feat/<kebab-case>` | Fresh features |
| `fix/<kebab-case>` | Bug fixes |
| `docs/<kebab-case>` | Documentation |
| `chore/<kebab-case>` | Refactor, dep bump, config |

PR flow:

1. Fresh branch from `main`.
2. Small imperative commits (`add ...`, `fix ...`, `refactor ...`).
3. `npm run build && npm run lint && npm test` pass locally before push.
4. PR to `main` plus self-review diff.
5. Merge after confidence. Manual deploy (no automatic CI at present).

## 🇺🇸 Code Conventions

General:

- **Strict TypeScript** (`tsconfig.app.json` — `noUnusedLocals/Parameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`).
- **Minimal comments** — self-documenting code. Comments only for non-obvious reasons, not restated descriptions.
- **Pure-first**: decision logic equals pure functions (no DOM, fetch, `Date.now`). Separate I/O wiring. See architecture (`02-tsd/00-architecture.md`).
- **Module refs** use `file-name › function-name` format (no brittle line numbers).

Naming:

| Type | Convention | Example |
|---|---|---|
| Component file | `kebab-case.tsx` | `asset-signal-table.tsx` |
| Lib/engine file | `kebab-case.ts` | `follow-trade-model.ts` |
| Hook | `use-<thing>.ts`, export `use<Thing>` | `use-auth.ts` → `useAuth` |
| Query hook | queryKey `["<thing>",…]` | `useCryptoDominance` → `["dominance"]` |
| Type/interface | `PascalCase` | `UnifiedAsset`, `Outlook` |
| Constant | `UPPER_SNAKE` | `SIGNAL_THRESHOLDS` |
| RPC (DB) | `snake_case` | `redeem_access_code` |
| Migration | `YYYYMMDDNNNNNN_<name>.sql` | `20260702000001_asset_discovery.sql` |
| Doc | `NN-kebab-case.md` | `02-trading-engine.md` |

Structure:

- `src/features/<area>/` — vertical feature slices.
- `src/core/` — pure core bundled to cron via `edge-engine.ts` facade.
- `src/services/{api,adapters,queries,supabase}/` — data layer.
- `src/hooks/` — generic non-query hooks.
- `src/store/` — Redux slices.
- `src/constants/taxonomy/` — static source of truth.
- `src/types/` — TypeScript contracts.
- `src/components/{ui,charts,shared,layout}/` — reusable UI.
- `src/app/{config,providers,router,layouts}/` — app shell.
- `functions/api/` — Cloudflare Pages proxy.
- `supabase/{migrations,functions,schedule-*.sql}/` — backend.
- `tests/` — `node --test` plus Vite SSR real-`.ts` loading.

Engine (load-bearing):

- **Single-source**: `src/core/engine/`, `src/core/market/` normalization, `src/core/automation/` bundle to cron. No logic duplication in function `index.ts` — import from `_engine.mjs`.
- **Enrichment order** remains load-bearing, never shuffled.
- **Strength equals technical alignment, not win probability**. i18n labels never shift into probability.
- **No signal flips** in enrichment (bounded nudge).
- **Phantom guard**: timestamped candles decide TP/SL. Spot price stays unused.

i18n plus state:

- Each domain value requires label-key maps into `common`/`dialog`/`journal`/`admin` namespaces. No literal label string-concat.
- **Redux** `{ui,filter,auth}` — ephemeral UI/filter/session only. Server data lives in react-query. No Zustand (legacy, removed).

DB plus migrations:

- **Append-only**. Schema shifts equal fresh migration files. No edits to prod-applied files.
- **Idempotent** (`create ... if not exists`, `create or replace`, `drop policy if exists`).
- **No squash** — each file equals one audit-trail phase.
- MANUAL steps (seed codes, admin grants, cron secret) carry secrets so stay out of git.

## 🇺🇸 Secret Rules

| Committable | Never committed |
|---|---|
| `.env.example` (key names sans value) | `.env` (holds values) |
| Public code, query keys, schema | Service-role key, access codes, webhook URL |
| `supabase/functions/.env` template | Valued `supabase/functions/.env` (gitignored) |

Detail: [`docs/04-operations/01-security.md`](docs/04-operations/01-security.md).

## 🇺🇸 Tests

- Framework: `node --test` plus `node:assert/strict`. Real-`.ts` loading via Vite SSR (`ssrLoadModule`).
- **Pure-first**: I/O modules become pure decisions first, then tested (avoids over-mock).
- Convention: `tests/<topic>.test.mjs`, `await load("@/path/to/source.ts")`, inline hand-computed fixtures.
- Targets: pure core ~100%, Edge I/O gating ~70% (helper extract), UI smoke 1–2 files.
- Gaps plus recommendations: [`docs/03-testing/02-gaps-and-conventions.md`](docs/03-testing/02-gaps-and-conventions.md).

## 🇺🇸 Documentation

- Sequential full-ID then full-EN per file (decided 2026-09-16). No standalone pronouns (blacklist in each template). ID/EN length parity (±20%).
- Structure: `docs/{01-functional-specs,02-technical-specs,03-testing,04-operations,05-explainers}/` plus [`docs/README.md`](docs/README.md) index.
- Canonical facts: 45 files / 422 cases, 38 migrations, 16 tables, 28 RPCs, `MIN_CALIBRATION_SAMPLE=30`.
- Drift fix: docs mismatching code get fixed in the same PR.

## 🇺🇸 Pre-PR Checklist

```bash
npm run build && npm run lint && npm test
```

- [ ] Build passes (`tsc -b + vite build`)
- [ ] Lint passes (eslint)
- [ ] Tests pass (422 cases)
- [ ] No secrets in diff
- [ ] Doc drift fixed where present
- [ ] Fresh migrations (for schema shifts) append-only plus idempotent
