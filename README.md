# RabaLaba

> 🇮🇩 Terminal riset trading multi-aset (crypto / saham US / saham ID / komoditas / forex) dengan sinyal swing 1-jam, rencana trading (TP/SL), dan jurnal otomatis berbasis cron. **Bukan** sistem eksekusi — alat bantu keputusan.
> 🇺🇸 Multi-asset trading-research terminal (crypto / US stocks / ID stocks / commodity / forex) with 1-hour swing signals, trade plans (TP/SL), and an automated cron journal. **Not** an execution system — a decision-support tool.

**Live:** `rabalaba.pages.dev` · **Stack:** React 19 + Vite 8 + Supabase + Cloudflare Pages

---

## 🚀 Quick start

```bash
npm install
cp .env.example .env   # isi VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev            # http://localhost:5173
```

Test & build:
```bash
npm test               # 26 file / 268 case (node --test)
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
| `npm test` | `node --test tests/*.test.mjs` |
| `npm run build:edge` | esbuild bundle `src/core/edge-engine.ts` → 3 `_engine.mjs` (cron) |
| `npm run deploy:edge` | build:edge + deploy `auto-journal` |
| `npm run deploy:summary` | build:edge + deploy `daily-summary` |
| `npm run deploy:discovery` | build:edge + deploy `asset-discovery` |
| `npm run gate:compare` | bandingin win% raw vs emission-gated backtest |

> Deploy lengkap: [`docs/tsd/07-deployment.md`](docs/tsd/07-deployment.md).

---

## 🧱 Arsitektur singkat / Architecture at a glance

Kode jalan di **4 tempat**:
- 🌐 **Browser** — React SPA (UI, screener, engine live)
- 🦾 **Supabase Edge Function** (Deno) — 3 cron: `auto-journal` 30m, `daily-summary` hourly, `asset-discovery` daily
- 🗄️ **Supabase Postgres** — DB + RLS + pg_cron + Auth
- ☁️ **Cloudflare Pages** — host SPA + proxy data market (Yahoo/F&G; CoinGecko/Binance direct dari browser)

Engine sinyal **single-source** di `src/` — di-pake browser & di-bundle ke cron.

> Detail: [`docs/tsd/00-architecture.md`](docs/tsd/00-architecture.md).

---

## 📚 Dokumentasi / Documentation

Semua dokumentasi ada di [`docs/`](docs/README.md):

| Folder | Isi / Content |
|---|---|
| [`docs/fsd/`](docs/README.md) | **Functional Spec** — fitur dari user view |
| [`docs/tsd/`](docs/README.md) | **Technical Spec** — arsitektur, schema, engine internals |
| [`docs/testing/`](docs/README.md) | Test framework, coverage inventory, gap analysis |
| [`docs/ops/`](docs/README.md) | Runbook produksi & security |
| [`docs/explainer/`](docs/README.md) | Dokumen ELI5 & SDD legacy |
| [`supabase/README.md`](supabase/README.md) | Setup & rebuild DB dari nol |

Mulai cepat: [`docs/fsd/00-overview.md`](docs/fsd/00-overview.md) → [`docs/tsd/00-architecture.md`](docs/tsd/00-architecture.md).

---

## 🤝 Kontribusi / Contributing

Lihat [`CONTRIBUTING.md`](CONTRIBUTING.md) — convention code, branching, env setup, PR flow.

## 📝 Changelog

Lihat [`CHANGELOG.md`](CHANGELOG.md).

---

## ⚠️ Disclaimer

RabaLaba **bukan** broker, bot eksekusi, penasihat keuangan, atau jaminan profit. Sinyal = alignment teknikal, bukan janji. Data punya delay (Yahoo). Disclaimer resmi tersimpan di DB (`disclaimer` table, bilingual + versioned) & ditampilkan di app.
