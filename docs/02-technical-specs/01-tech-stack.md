# TSD 01 — Tech Stack / Tech Stack

> Status: Kanonis
> Terverifikasi: 2026-09-16
> Tanggal: 2026-09-16
> Cakupan: Dependency, tooling, scripts, konfigurasi, target deploy

[Bahasa Indonesia](#bagian-id) · [English](#english-part)

## Bagian ID

### Ringkasan
- Stack utama adalah React, Vite, TypeScript, Supabase, Cloudflare Pages.
- Build SPA dan bundle edge dipisah agar cron tetap deterministik. Alur sat-set.
- Konfigurasi browser minimal dan trial diatur via durasi trial.

### Runtime Dan Framework
| Kategori | Teknologi | Versi |
|---|---|---|
| UI framework | React | ^19.2.7 |
| Build tool | Vite | ^8.1.5 |
| Bahasa | TypeScript | ~6.0.3 |
| Routing | react-router-dom | ^7.18.1 |
| Server state | TanStack Query | ^5.101.2 |
| Tabel | TanStack Table | ^8.21.3 |
| Client state | Redux Toolkit | ^2.12.0 |
| Backend | Supabase JS | ^2.110.7 |
| Forms | Hook Form plus Zod | ^7.82.0 |
| i18n | i18next plus React | ^26.3.6 |
| Charts | Recharts | ^3.9.2 |
| Primitives | Radix plus shadcn | ^1.6.4 |
| Ikon | Lucide React | ^1.25.0 |
| Tanggal | date-fns plus picker | ^4.4.0 |

### Dev Tooling
| Tool | Versi | Peran |
|---|---|---|
| wrangler | ^4.112.0 | Pages dev dan deploy |
| eslint | ^10.7.0 | Lint kode |
| esbuild | 0.28.1 | Bundler edge function |

### Scripts
| Script | Fungsi |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Build SPA ke `dist/` |
| `npm test` | 45 file dan 422 case |
| `npm run build:edge` | Bundle edge ke 3 `_engine.mjs` |
| `npm run deploy:auto-journal` | Deploy cron auto-journal |

### Konfigurasi
| Berkas | Isi Kunci |
|---|---|
| `tsconfig › paths` | Alias `@` ke `./src` |
| `vite-config › plugin` | React, tailwind, proxy Yahoo dev |
| `wrangler-toml › name` | Aplikasi Pages react-rabalaba |
| `.env-example › vars` | Hanya URL plus publishable key |
| `trial-config › duration` | Trial konfigurabel via durasi trial |

- `.env.example` hanya berisi `VITE_SUPABASE_URL` plus `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Trial dikonfigurasi via `VITE_TRIAL_DURATION` tanpa perubahan skema.
- Bundle edge dibuat dari `src/core/edge-engine.ts` ke 3 `_engine.mjs`.
- Proxy berada di `proxy.ts › proxyJsonGet` dengan route yahoo, binance, coingecko.

### Target Deploy
| Target | Platform |
|---|---|
| SPA | Cloudflare Pages |
| Edge 3 fungsi | Supabase project kanonis |
| DB plus cron | Supabase Postgres |

### Terkait
- Arsitektur di `00-architecture.md`.
- Deploy di `07-deployment.md`.
- Inventori uji di `../03-testing/01-coverage-inventory.md`.

---
## English Part

### Overview
- Main stack is React, Vite, TypeScript, Supabase, Cloudflare Pages.
- SPA build and edge bundle stay separate for deterministic cron. Flow deep-dive.
- Browser configuration stays minimal and trial uses trial duration.

### Runtime And Framework
| Category | Technology | Version |
|---|---|---|
| UI framework | React | ^19.2.7 |
| Build tool | Vite | ^8.1.5 |
| Language | TypeScript | ~6.0.3 |
| Routing | react-router-dom | ^7.18.1 |
| Server state | TanStack Query | ^5.101.2 |
| Table | TanStack Table | ^8.21.3 |
| Client state | Redux Toolkit | ^2.12.0 |
| Backend | Supabase JS | ^2.110.7 |
| Forms | Hook Form plus Zod | ^7.82.0 |
| i18n | i18next plus React | ^26.3.6 |
| Charts | Recharts | ^3.9.2 |
| Primitives | Radix plus shadcn | ^1.6.4 |
| Icons | Lucide React | ^1.25.0 |
| Dates | date-fns plus picker | ^4.4.0 |

### Dev Tooling
| Tool | Version | Role |
|---|---|---|
| wrangler | ^4.112.0 | Pages dev and deploy |
| eslint | ^10.7.0 | Code lint |
| esbuild | 0.28.1 | Edge bundler |

### Scripts
| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | SPA build into `dist/` |
| `npm test` | 45 files and 422 cases |
| `npm run build:edge` | Edge bundle into 3 `_engine.mjs` |
| `npm run deploy:auto-journal` | Deploy auto-journal cron |

### Configuration
| File | Key Content |
|---|---|
| `tsconfig › paths` | Alias `@` to `./src` |
| `vite-config › plugin` | React, tailwind, Yahoo dev proxy |
| `wrangler-toml › name` | Pages app react-rabalaba |
| `.env-example › vars` | Only URL plus publishable key |
| `trial-config › duration` | Trial configurable via trial duration |

- `.env.example` only contains `VITE_SUPABASE_URL` plus `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Trial is configured via `VITE_TRIAL_DURATION` without schema change.
- Edge bundle is built from `src/core/edge-engine.ts` into 3 `_engine.mjs`.
- Proxy lives in `proxy.ts › proxyJsonGet` with yahoo, binance, coingecko routes.

### Deploy Targets
| Target | Platform |
|---|---|
| SPA | Cloudflare Pages |
| Edge 3 functions | Canonical Supabase project |
| DB plus cron | Supabase Postgres |

### Related
- Architecture in `00-architecture.md`.
- Deployment in `07-deployment.md`.
- Test inventory in `../03-testing/01-coverage-inventory.md`.
