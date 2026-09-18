# Dokumentasi RabaLaba / RabaLaba Documentation

> Status verifikasi: angka dan path diverifikasi pada 2026-09-16. Kanonis: 45 file / 422 case (`node --test tests/*.test.mjs`); 38 migrasi; 16 tabel; 28 RPC; `MIN_CALIBRATION_SAMPLE=30`; cron 30m/hourly/daily.
> Verification status: figures and paths verified on 2026-09-16. Canonical: 45 files / 422 cases (`node --test tests/*.test.mjs`); 38 migrations; 16 tables; 28 RPCs; `MIN_CALIBRATION_SAMPLE=30`; cron 30m/hourly/daily.

[Bahasa Indonesia](#bagian-id) · [English](#english-part)

## Bagian ID

### Gambaran

Dokumentasi memakai 5 folder bernomor dengan peran tetap. Indeks ini menjadi pintu masuk utama; detail per area berada di file masing-masing. Urutan baca dibuat sat-set: produk, arsitektur, testing, operasi.

### Indeks kanonis 5 folder

| Folder | Isi | Audiens |
|---|---|---|
| `01-functional-specs/` | Spesifikasi fungsional: perilaku produk dari sudut fitur dan pengguna | Produk, pembaca baru |
| `02-technical-specs/` | Spesifikasi teknis: arsitektur, aliran data, skema, engine internal | Engineer |
| `03-testing/` | Framework test, inventaris coverage 45 file / 422 case, gap, convention | Engineer, QA |
| `04-operations/` | Runbook produksi, keamanan dan rationale RLS | Engineer, ops |
| `05-explainers/` | Metodologi trading, ELI5, SDD, batas server-browser | Semua peran |

### Peta dokumen lengkap

#### FSD — Spesifikasi fungsional

| File | Topik |
|---|---|
| `01-functional-specs/00-overview.md` | Produk, persona, TL;DR, glosarium |
| `01-functional-specs/01-terminal-screener.md` | Terminal: market pulse, tabel screener, detail aset, kartu share |
| `01-functional-specs/02-trading-engine.md` | Pipeline sinyal, regime, 3 konteks (BTC/IHSG/S&P), enrichment, backtest, kalibrasi |
| `01-functional-specs/03-auto-journal.md` | Robot jurnal otomatis (cron 30m) |
| `01-functional-specs/04-journal-dashboard.md` | Statistik jurnal, kurva performa, outcome donut, top performers |
| `01-functional-specs/05-economic-calendar.md` | Kalender ekonomi |
| `01-functional-specs/06-auth-entitlement.md` | Login, OAuth, premium/trial, redeem code, invite, subscription, disclaimer |
| `01-functional-specs/07-admin-console.md` | Konsol admin: users, assets, codes, invitations, plans, payments, disclaimer, statistics |
| `01-functional-specs/08-user-testimonials.md` | Testimoni: submit/edit/delete, moderasi, featured landing, privasi |

#### TSD — Spesifikasi teknis

| File | Topik |
|---|---|
| `02-technical-specs/00-architecture.md` | 4 runtime, layering, split pure/IO, single-source engine, diagram |
| `02-technical-specs/01-tech-stack.md` | Tech stack, dependensi, tooling |
| `02-technical-specs/02-data-flow.md` | API → adapter → react-query → engine → UI, state (Redux/RQ/Context/i18n) |
| `02-technical-specs/03-database-schema.md` | 16 tabel, 28 RPC, RLS, 38 migrasi |
| `02-technical-specs/04-cloudflare-proxy.md` | 3 route proxy, cache fresh/stale/error, Yahoo crumb |
| `02-technical-specs/05-edge-functions.md` | 3 Edge Function cron, scheduling/gating, Discord |
| `02-technical-specs/06-engine-internals.md` | Detail export signals/indicators/contexts/enrichment/backtest dan formula |
| `02-technical-specs/07-deployment.md` | Build edge, deploy, schedule cron, env vars |
| `02-technical-specs/08-signal-flow-diagrams.md` | Diagram mermaid flowchart, activity, sequence alur sinyal end-to-end |

#### Testing

| File | Topik |
|---|---|
| `03-testing/00-overview.md` | Framework `node --test`, load real `.ts` via Vite SSR, cara run |
| `03-testing/01-coverage-inventory.md` | Inventaris 45 file / 422 case per area, diagram pie |
| `03-testing/02-gaps-and-conventions.md` | Gap coverage, 9 rekomendasi test baru, convention |

#### Ops

| File | Topik |
|---|---|
| `04-operations/00-runbook.md` | Health check, playbook 5 insiden, rollback, restore DB, pause darurat |
| `04-operations/01-security.md` | Threat model 10 baris, key hierarchy, rationale RLS, trust boundary, checklist audit |

#### Explainer

| File | Topik |
|---|---|
| `05-explainers/00-trading-methodology.md` | Aturan sinyal, setup tetap, jurnal/Discord, TP/SL, exit/reset, contoh LONG/SHORT, skor dan interval pembaruan |
| `05-explainers/01-auto-journal-explained.md` | ELI5 cara kerja robot |
| `05-explainers/02-auto-journal-system-design.md` | SDD formal auto-journal |
| `05-explainers/03-server-vs-browser.md` | Lokasi eksekusi kode (4 runtime), prinsip jangan percaya browser |

### Mulai cepat sekuensial

Ikuti urutan berikut agar progres tetap gas:

1. Baca `01-functional-specs/00-overview.md`, lanjut `01-terminal-screener.md`.
2. Baca `02-technical-specs/00-architecture.md`, lanjut `02-data-flow.md`.
3. Untuk robot: baca `01-functional-specs/03-auto-journal.md` dan `05-explainers/01-auto-journal-explained.md`.
4. Untuk deploy: baca `02-technical-specs/07-deployment.md` dan `supabase/README.md`.
5. Untuk produksi bermasalah: buka `04-operations/00-runbook.md`.
6. Untuk kontribusi: baca `CONTRIBUTING.md`, lalu jalankan `npm run build && npm run lint && npm test`.

### Terkait

- [`../README.md`](../README.md) — README root proyek
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — onboarding dan convention
- [`../CHANGELOG.md`](../CHANGELOG.md) — changelog
- [`../supabase/README.md`](../supabase/README.md) — runbook DB

## English Part

### Overview

The documentation uses 5 numbered folders with fixed roles. The index serves as the main entry point; area details live in the respective files. The reading order stays relaxed and professional: product, architecture, testing, operations.

### Canonical 5-folder index

| Folder | Contents | Audience |
|---|---|---|
| `01-functional-specs/` | Functional specification: product behavior from the feature and reader perspective | Product, new readers |
| `02-technical-specs/` | Technical specification: architecture, data flow, schema, engine internals | Engineers |
| `03-testing/` | Test framework, 45-file / 422-case coverage inventory, gaps, conventions | Engineers, QA |
| `04-operations/` | Production runbook, security and RLS rationale | Engineers, ops |
| `05-explainers/` | Trading methodology, ELI5, SDD, server-browser boundary | All roles |

### Complete document map

#### FSD — Functional specification

| File | Topic |
|---|---|
| `01-functional-specs/00-overview.md` | Product, personas, TL;DR, glossary |
| `01-functional-specs/01-terminal-screener.md` | Terminal: market pulse, screener table, asset detail, share card |
| `01-functional-specs/02-trading-engine.md` | Signal pipeline, regime, 3 contexts (BTC/IHSG/S&P), enrichment, backtest, calibration |
| `01-functional-specs/03-auto-journal.md` | Auto-journal robot (30m cron) |
| `01-functional-specs/04-journal-dashboard.md` | Journal statistics, performance curve, outcome donut, top performers |
| `01-functional-specs/05-economic-calendar.md` | Economic calendar |
| `01-functional-specs/06-auth-entitlement.md` | Login, OAuth, premium/trial, redeem code, invite, subscription, disclaimer |
| `01-functional-specs/07-admin-console.md` | Admin console: users, assets, codes, invitations, plans, payments, disclaimer, statistics |
| `01-functional-specs/08-user-testimonials.md` | Testimonials: submit/edit/delete, moderation, featured landing, privacy |

#### TSD — Technical specification

| File | Topic |
|---|---|
| `02-technical-specs/00-architecture.md` | 4 runtimes, layering, pure/IO split, single-source engine, diagrams |
| `02-technical-specs/01-tech-stack.md` | Tech stack, dependencies, tooling |
| `02-technical-specs/02-data-flow.md` | API → adapter → react-query → engine → UI, state (Redux/RQ/Context/i18n) |
| `02-technical-specs/03-database-schema.md` | 16 tables, 28 RPCs, RLS, 38 migrations |
| `02-technical-specs/04-cloudflare-proxy.md` | 3 proxy routes, fresh/stale/error cache, Yahoo crumb |
| `02-technical-specs/05-edge-functions.md` | 3 cron Edge Functions, scheduling/gating, Discord |
| `02-technical-specs/06-engine-internals.md` | Export details for signals/indicators/contexts/enrichment/backtest plus formulas |
| `02-technical-specs/07-deployment.md` | Edge build, deploy, cron schedule, env vars |
| `02-technical-specs/08-signal-flow-diagrams.md` | Mermaid flowchart, activity, and sequence diagrams for the end-to-end signal flow |

#### Testing

| File | Topic |
|---|---|
| `03-testing/00-overview.md` | `node --test` framework, real-`.ts` loading via Vite SSR, run guide |
| `03-testing/01-coverage-inventory.md` | 45-file / 422-case inventory per area, pie chart |
| `03-testing/02-gaps-and-conventions.md` | Coverage gaps, 9 new-test recommendations, conventions |

#### Ops

| File | Topic |
|---|---|
| `04-operations/00-runbook.md` | Health checks, 5-incident playbook, rollback, DB restore, emergency pause |
| `04-operations/01-security.md` | 10-row threat model, key hierarchy, RLS rationale, trust boundary, audit checklist |

#### Explainer

| File | Topic |
|---|---|
| `05-explainers/00-trading-methodology.md` | Signal rules, fixed setup, journal/Discord, TP/SL, exit/reset, LONG/SHORT examples, scores and refresh intervals |
| `05-explainers/01-auto-journal-explained.md` | ELI5 of the robot |
| `05-explainers/02-auto-journal-system-design.md` | Formal auto-journal SDD |
| `05-explainers/03-server-vs-browser.md` | Code execution locations (4 runtimes), never-trust-the-browser principle |

### Sequential quick start

Follow the order below:

1. Read `01-functional-specs/00-overview.md`, then `01-terminal-screener.md`.
2. Read `02-technical-specs/00-architecture.md`, then `02-data-flow.md`.
3. For the robot: read `01-functional-specs/03-auto-journal.md` and `05-explainers/01-auto-journal-explained.md`.
4. For deploys: read `02-technical-specs/07-deployment.md` and `supabase/README.md`.
5. For production incidents: open `04-operations/00-runbook.md`.
6. For contributions: read `CONTRIBUTING.md`, then run `npm run build && npm run lint && npm test`.

### Related

- [`../README.md`](../README.md) — project root README
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — onboarding and conventions
- [`../CHANGELOG.md`](../CHANGELOG.md) — changelog
- [`../supabase/README.md`](../supabase/README.md) — DB runbook
