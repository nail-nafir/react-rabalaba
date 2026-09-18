# RabaLaba

> 🇮🇩 Terminal riset trading multi-aset (crypto / saham US / saham ID / komoditas / forex) dengan sinyal swing 1-jam, rencana trading (TP/SL), dan jurnal otomatis berbasis cron. **Bukan** sistem eksekusi — alat bantu keputusan.
> 🇺🇸 Multi-asset trading-research terminal (crypto / US stocks / ID stocks / commodity / forex) with 1-hour swing signals, trade plans (TP/SL), plus cron-based auto journal. **Not** an execution system — a decision-support tool.

**Live:** `rabalaba.pages.dev` · **Stack:** React 19 + Vite 8 + Supabase + Cloudflare Pages · **Test:** 45 file / 422 case · **DB:** 38 migrasi, 16 tabel, 28 RPC

---

## 🚀 Mulai Cepat / Quick Start

Bagian Indonesia dulu, lalu mirror English dengan panjang setara. Langkah sat-set dari install sampai dev server tetap rapi.

```bash
npm install
cp .env.example .env   # isi VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev            # http://localhost:5173
```

Test dan build:

```bash
npm test               # 45 file / 422 case (node --test)
npm run build          # tsc -b + vite build → dist/
npm run lint           # eslint
```

---

## 📦 Scripts

| Script | Fungsi / Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run wrangler` | Pages dev (port 8788) + Vite |
| `npm run build` | `tsc -b && vite build` → `dist/` |
| `npm run lint` | eslint |
| `npm test` | `node --test tests/*.test.mjs` (45 file / 422 case) |
| `npm run build:edge` | esbuild `src/core/edge-engine.ts` → 3 `_engine.mjs` (cron) |
| `npm run deploy:auto-journal` | build:edge + deploy `auto-journal` |
| `npm run deploy:daily-summary` | build:edge + deploy `daily-summary` |
| `npm run deploy:asset-discovery` | build:edge + deploy `asset-discovery` |
| `npm run gate:compare` | riset filter entry hipotetis; jurnal production tetap parity dengan screener |

> Deploy lengkap: [`docs/02-technical-specs/07-deployment.md`](docs/02-technical-specs/07-deployment.md).

---

## 🧱 Arsitektur Singkat / Architecture at a Glance

Kode berjalan di **4 runtime**:

- 🌐 **Browser** — React SPA (UI, screener, engine live)
- 🦾 **Supabase Edge Function** (Deno) — 3 cron: `auto-journal` 30m, `daily-summary` hourly, `asset-discovery` daily
- 🗄️ **Supabase Postgres** — DB + RLS + pg_cron + Auth (16 tabel, 28 RPC, 38 migrasi)
- ☁️ **Cloudflare Pages** — host SPA + proxy Yahoo (CoinGecko/Binance direct dari browser)

Engine sinyal **single-source** di `src/core` — dipakai browser dan di-bundle ke cron via `edge-engine.ts`.

> Detail: [`docs/02-technical-specs/00-architecture.md`](docs/02-technical-specs/00-architecture.md).

---

## 📚 Dokumentasi / Documentation

Seluruh dokumentasi berada di [`docs/`](docs/README.md), terverifikasi 2026-09-16:

| Folder | Isi / Content |
|---|---|
| [`docs/01-functional-specs/`](docs/01-functional-specs/00-overview.md) | **Spesifikasi fungsional** — perilaku produk dari sudut fitur |
| [`docs/02-technical-specs/`](docs/02-technical-specs/00-architecture.md) | **Spesifikasi teknis** — arsitektur, schema, engine internals |
| [`docs/03-testing/`](docs/03-testing/00-overview.md) | Framework test, inventory 45 file / 422 case, gap analysis |
| [`docs/04-operations/`](docs/04-operations/00-runbook.md) | Runbook produksi dan security |
| [`docs/05-explainers/`](docs/05-explainers/00-trading-methodology.md) | Metodologi trading, ELI5, SDD |
| [`supabase/README.md`](supabase/README.md) | Setup dan rebuild DB dari nol |

Mulai cepat: [`docs/01-functional-specs/00-overview.md`](docs/01-functional-specs/00-overview.md) → [`docs/02-technical-specs/00-architecture.md`](docs/02-technical-specs/00-architecture.md).

---

## 🤝 Kontribusi / Contributing

Lihat [`CONTRIBUTING.md`](CONTRIBUTING.md) — convention code, branching, env setup, PR flow.

## 📝 Changelog

Lihat [`CHANGELOG.md`](CHANGELOG.md).

---

## ⚠️ Disclaimer

RabaLaba **bukan** broker, bot eksekusi, penasihat keuangan, atau jaminan profit. Sinyal = alignment teknikal, bukan janji. Data memakai delay (Yahoo). Disclaimer resmi tersimpan di DB (`disclaimer` table, bilingual + versioned) dan tampil di app.
