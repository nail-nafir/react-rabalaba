# Dokumentasi RabaLaba / RabaLaba Documentation

> 🇮🇩 Index navigasi buat semua dokumentasi proyek RabaLaba. Tiap dokumen bilingual Indonesia + English.
> 🇺🇸 Navigation index for all RabaLaba project documentation. Each document is bilingual Indonesian + English.

---

## 📚 Struktur / Structure

| Folder | Isi / Content | Audiens / Audience |
|---|---|---|
| `fsd/` | **Functional Spec Doc** — apa yang produk lakuin dari sudut pandang fitur & user. *What the product does, feature & user view.* | Produk/PM, orang baru |
| `tsd/` | **Technical Spec Doc** — gimana kode diatur, arsitektur, data flow, schema, engine internals. *How the code is organized, architecture, data flow, schema, engine internals.* | Engineer |
| `testing/` | **Test docs** — framework, coverage inventory, gap analysis, convention. *Test framework, coverage inventory, gap analysis, convention.* | Engineer/QA |
| `ops/` | **Ops** — runbook produksi & security/RLS rationale. *Production runbook & security/RLS rationale.* | Engineer/ops |
| `explainer/` | Dokumen ELI5 & SDD formal legacy. *Legacy ELI5 & formal SDD.* | Semua |

---

## 🧭 Peta dokumen / Document map

### FSD — Functional Spec (fitur)

| File | Topik / Topic |
|---|---|
| [`fsd/00-overview.md`](fsd/00-overview.md) | Produk, persona, TL;DR, glossary *Product, personas, TL;DR, glossary* |
| [`fsd/01-terminal-screener.md`](fsd/01-terminal-screener.md) | Terminal: market pulse + screener table + asset detail + share card |
| [`fsd/02-trading-engine.md`](fsd/02-trading-engine.md) | Pipeline sinyal, regime, 3 context (BTC/IHSG/S&P), enrichment, backtest, calibration |
| [`fsd/03-auto-journal.md`](fsd/03-auto-journal.md) | Robot jurnal otomatis (cron 30m) *Auto-journal robot* |
| [`fsd/04-journal-dashboard.md`](fsd/04-journal-dashboard.md) | Dashboard portfolio, P&L, equity curve, outcome donut, top performers |
| [`fsd/05-economic-calendar.md`](fsd/05-economic-calendar.md) | Kalender ekonomi *Economic calendar* |
| [`fsd/06-auth-entitlement.md`](fsd/06-auth-entitlement.md) | Login, OAuth, premium/trial, redeem code, invite, subscription, disclaimer |
| [`fsd/07-admin-console.md`](fsd/07-admin-console.md) | Admin console: users, assets, codes, invitations, plans, payments, disclaimer, statistics |
| [`fsd/08-user-testimonials.md`](fsd/08-user-testimonials.md) | Testimoni pengguna: submit/edit/delete, moderasi, featured landing, privacy |

### TSD — Technical Spec (arsitektur)

| File | Topik / Topic |
|---|---|
| [`tsd/00-architecture.md`](tsd/00-architecture.md) | 4 tempat kode jalan, layering, pure/IO split, single-source engine, diagram |
| [`tsd/01-tech-stack.md`](tsd/01-tech-stack.md) | Tech stack, dependency, tooling |
| [`tsd/02-data-flow.md`](tsd/02-data-flow.md) | API → adapter → react-query → engine → UI + state (Redux/RQ/Context/i18n) |
| [`tsd/03-database-schema.md`](tsd/03-database-schema.md) | 15 tabel, 24 function/RPC, RLS, 29 migrasi |
| [`tsd/04-cloudflare-proxy.md`](tsd/04-cloudflare-proxy.md) | 4 route proxy, cache engine fresh/stale/error, Yahoo crumb |
| [`tsd/05-edge-functions.md`](tsd/05-edge-functions.md) | 3 Edge Function cron, scheduling/gating, Discord |
| [`tsd/06-engine-internals.md`](tsd/06-engine-internals.md) | Mendalam: tiap export signals/indicators/contexts/enrichment/backtest + formula |
| [`tsd/07-deployment.md`](tsd/07-deployment.md) | Build edge, deploy, schedule cron, env vars |

### Testing

| File | Topik / Topic |
|---|---|
| [`testing/00-overview.md`](testing/00-overview.md) | Framework `node --test`, Vite SSR load real `.ts`, cara run |
| [`testing/01-coverage-inventory.md`](testing/01-coverage-inventory.md) | 26 file / 268 case map per modul |
| [`testing/02-gaps-and-conventions.md`](testing/02-gaps-and-conventions.md) | Gap coverage + rekomendasi test baru + convention |

### Ops

| File | Topik / Topic |
|---|---|
| [`ops/runbook.md`](ops/runbook.md) | Runbook produksi: health check, incident playbook, rollback, restore DB, pause darurat |
| [`ops/security.md`](ops/security.md) | Threat model, RLS/RPC rationale, secret management, trust boundaries |

### Explainer (legacy)

| File | Topik / Topic |
|---|---|
| [`explainer/auto-journal-explained.md`](explainer/auto-journal-explained.md) | ELI5 cara kerja robot *ELI5 how the robot works* |
| [`explainer/auto-journal-system-design.md`](explainer/auto-journal-system-design.md) | SDD formal auto-journal *Formal SDD* |
| [`explainer/server-vs-browser.md`](explainer/server-vs-browser.md) | Di mana kode jalan (4 tempat) + jangan percaya browser |

---

## 🚀 Mulai cepat / Quick start

🇮🇩 Baru datang? Baca urut: `fsd/00-overview` → `fsd/01` → `tsd/00` → `tsd/02`. Mau paham robot? `fsd/03` + `explainer/auto-journal-explained.md`. Mau deploy? `tsd/07`. Produksi bermasalah? `ops/runbook`.

🇺🇸 New here? Read in order: `fsd/00-overview` → `fsd/01` → `tsd/00` → `tsd/02`. Want the robot? `fsd/03` + `explainer/auto-journal-explained.md`. Deploying? `tsd/07`. Production broken? `ops/runbook`.

## 🔗 Terkait / Related
- [`../README.md`](../README.md) — root project README
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — convention & onboarding
- [`../CHANGELOG.md`](../CHANGELOG.md) — changelog
- [`../supabase/README.md`](../supabase/README.md) — runbook DB / DB runbook
