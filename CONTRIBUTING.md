# Contributing to RabaLaba

> 🇮🇩 Convention code, branching, env setup, PR flow buat onboarding (diri sendiri kalau lupa / orang baru).
> 🇺🇸 Code conventions, branching, env setup, PR flow for onboarding (your future self / newcomers).

---

## 🚀 Onboarding (setup dev baru / fresh dev setup)

```bash
git clone <repo> && cd react-rabalaba
npm install
cp .env.example .env
# Isi: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (dari Supabase dashboard → Settings → API)
npm run dev          # SPA → http://localhost:5173
npm test             # pastikan 268 case pass
npm run lint
```

**Run cron lokal** (opsional):
```bash
npm run build:edge   # bundle _engine.mjs dulu
# isi supabase/functions/.env (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, gitignored)
supabase functions serve auto-journal --env-file supabase/functions/.env
```

> Detail setup/rebuild DB: [`supabase/README.md`](supabase/README.md). Deploy: [`docs/tsd/07-deployment.md`](docs/tsd/07-deployment.md).

---

## 🌿 Branching & PR flow

| Branch | Untuk / For |
|---|---|
| `main` | Produksi (yang deploy ke `rabalaba.pages.dev`) |
| `feat/<kebab-case>` | Fitur baru |
| `fix/<kebab-case>` | Bug fix |
| `docs/<kebab-case>` | Dokumentasi |
| `chore/<kebab-case>` | Refactor, dep bump, config |

**PR flow:**
1. Branch baru dari `main`.
2. Commit kecil-kecil, message imperatif (`add ...`, `fix ...`, `refactor ...`).
3. `npm run build && npm run lint && npm test` harus pass lokal sebelum push.
4. PR ke `main` — self-review diff.
5. Merge setelah yakin. Deploy manual (bukan CI otomatis, sekarang).

> Solo flow: langsung commit ke `main` juga OK untuk fix kecil. Branch cuma kalau fitur besar / mau review diff dulu.

---

## 🧾 Code conventions

### Umum / General
- **TypeScript strict** (`tsconfig.app.json` — `noUnusedLocals/Parameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`).
- **No comments unless necessary** — kode self-documenting. Komen cuma kalau "kenapa" gak obvious (bukan "apa").
- **Pure-first**: logic keputusan = pure function (no DOM/fetch/`Date.now`). I/O wiring di luar. Lihat [`docs/tsd/00-architecture.md`](docs/tsd/00-architecture.md) §pure-IO-split.
- **`file:line` reference** di kode-komen & dokumen (biar navigasi gampang).

### Naming
| Tipe / Type | Convention | Contoh / Example |
|---|---|---|
| File komponen | `kebab-case.tsx` | `asset-signal-table.tsx` |
| File lib/engine | `kebab-case.ts` | `follow-trade-model.ts` |
| Hook | `use-<thing>.ts`, export `use<Thing>` | `use-auth.ts` → `useAuth` |
| Query hook | `use-<thing>.ts`, queryKey `["<thing>",…]` | `useCryptoDominance` → `["dominance"]` |
| Type/interface | `PascalCase` | `UnifiedAsset`, `Outlook` |
| Constant | `UPPER_SNAKE` | `SIGNAL_THRESHOLDS` |
| RPC (DB) | `snake_case` | `redeem_access_code` |
| Migration | `YYYYMMDDNNNNNN_<name>.sql` | `20260702000001_asset_discovery.sql` |
| Doc | `NN-kebab-case.md` | `02-trading-engine.md` |

### Struktur / Structure
- `src/features/<area>/` — fitur (engine, market, trading-plan, follow-trade, journal, admin, auth, economic-calendar).
- `src/core/` — pure core yang di-bundle ke cron (edge-engine facade).
- `src/services/{api,adapters,queries,supabase}/` — data layer.
- `src/hooks/` — custom hook non-query.
- `src/store/` — Redux slices.
- `src/constants/taxonomy/` — value list source of truth (value+type+label-key; colors di `colors.ts`/`palette.ts` terpisah biar value module edge-pure).
- `src/types/` — domain type.
- `src/components/{ui,charts,shared,layout}/` — reusable UI.
- `src/app/{config,providers,router,layouts}/` — app shell.
- `functions/api/` — Cloudflare Pages Functions proxy.
- `supabase/{migrations,functions,schedule-*.sql}/` — backend.
- `tests/` — `node --test` + Vite SSR load real `.ts`.

### Engine (load-bearing rules)
- **Single-source**: engine di `src/features/engine/` + `src/core/` di-bundle ke cron via `edge-engine.ts`. Jangan duplikasi logika di `supabase/functions/*/index.ts` — import dari `_engine.mjs`.
- **Enrichment order** (`enrichment.ts`): context de-rate → flow nudge → relative-strength → fundamentals. Urutan ini load-bearing, jangan acak.
- **Strength = alignment teknikal, BUKAN probabilitas menang**. Jangan label/ubah key i18n jadi "win probability".
- **Gak pernah flip sinyal** di enrichment (nudge bounded, gak pernah `LONG→SHORT`).
- **Phantom guard**: cuma candle timestamped yang mutusin TP/SL. Jangan pakai spot price.

### i18n
- Tiap label value domain **harus** punya label-key map (`ASSET_TYPE_LABEL_KEYS` dll) → namespace `common`/`dialog`/`journal`/`admin`. Jangan string-concat label literal.
- Tambah value taxonomy tanpa key → ketahuan di render (gak silent).

### State
- **Redux** `{ui,filter,auth}` — ephemeral UI/filter/session only. **Semua server data di react-query**.
- **Gak ada Zustand** (legacy, dihapus). Favorite di `user_favorites` (Supabase), entitlement di `profiles` (server truth).
- Screener subscribe **actions-only** (`"use no memo"`) biar hindari re-render loop.

### DB / migration
- **Append-only**. Schema berubah = file migrasi baru, JANGAN edit yang udah ke-apply di prod.
- **Idempotent** (`create ... if not exists`, `create or replace`, `drop policy if exists`).
- **Jangan squash** — tiap file = satu fase audit trail.
- Langkah MANUAL (seed code, grant admin, bearer cron) bawa secret → **keluar dari git**.

---

## 🔒 Secret rules

| Boleh commit | JANGAN commit |
|---|---|
| `.env.example` (key name TANPA value) — cuman `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` (value) |
| Kode publik, query key, schema | Service-role key, access code, bearer, webhook URL |
| `supabase/functions/.env` template | `supabase/functions/.env` (value, gitignored) |

Detail: [`docs/ops/security.md`](docs/ops/security.md).

---

## 🧪 Test

- Framework: `node --test` + `node:assert/strict`. Load real `.ts` via Vite SSR (`ssrLoadModule`).
- **Pure-first**: kalau modul I/O, extract pure decision dulu baru test (hindari over-mock).
- Convention: `tests/<topic>.test.mjs`, `await load("@/path/to/source.ts")`, hand-computed fixture inline.
- Target coverage: pure core ~100%, Edge I/O gating ~70% (extract helper), UI smoke 1-2 file.
- Gap & rekomendasi test baru: [`docs/testing/02-gaps-and-conventions.md`](docs/testing/02-gaps-and-conventions.md).

---

## 📝 Dokumentasi / Docs

- Bilingual 🇮🇩/🇺🇸 di semua doc (blok ID dulu → EN, emoji header, tabel, `file:line` ref, footer `🔗 Terkait / Related`).
- Struktur: `docs/{fsd,tsd,testing,ops,explainer}/` + index [`docs/README.md`](docs/README.md).
- Drift fix: kalau nemu doc gak match kode, benerin di PR yang sama.

---

## 🚦 Sebelum PR / Pre-PR checklist

```bash
npm run build && npm run lint && npm test
```
- [ ] Build pass (`tsc -b + vite build`)
- [ ] Lint pass (eslint)
- [ ] Test pass (268 case)
- [ ] Gak ada secret di diff
- [ ] Doc drift dibenerin kalau ada
- [ ] Migration baru (kalau ubah schema) append-only + idempotent
