# TSD 01 — Tech Stack & Tooling

> 🇮🇩 Daftar dependency, tooling, dan konfigurasi proyek.
> 🇺🇸 Dependency, tooling, and project configuration list.

---

## 📦 Runtime & framework

| Kategori / Category | Teknologi / Technology | Versi (dari `package.json`) |
|---|---|---|
| UI framework | React | ^19.2.7 |
| Build tool | Vite | ^8.1.3 |
| Bahasa | TypeScript | ~6.0.3 |
| Routing | react-router-dom | ^7.18.1 |
| Server state | @tanstack/react-query | ^5.101.2 |
| Table | @tanstack/react-table | ^8.21.3 |
| Client state | @reduxjs/toolkit + react-redux | ^2.12.0 / ^9.3.0 |
| Backend | @supabase/supabase-js | ^2.110.0 |
| Forms | react-hook-form + @hookform/resolvers | ^7.81.0 / ^5.4.0 |
| Validasi | zod | ^4.4.3 |
| i18n | i18next + react-i18next + i18next-browser-languagedetector | ^26.3.4 / ^17.0.8 / ^8.2.1 |
| Charts | recharts | ^3.9.2 |
| UI primitives | radix-ui + shadcn | ^1.6.1 / ^4.13.0 |
| Icons | lucide-react | ^1.23.0 |
| Theme | next-themes | ^0.4.6 |
| Date | date-fns + react-day-picker | ^4.4.0 / ^10.0.1 |
| Toast | sonner | ^2.0.7 |
| CSS | tailwindcss ^4.3.2 + @tailwindcss/vite + tw-animate-css + tailwind-merge + class-variance-authority + clsx | |
| Fonts | @fontsource-variable/inter + jetbrains-mono | ^5.2.8 |

### Dev tooling
| Tool | Versi | Untuk / For |
|---|---|---|
| wrangler | ^4.107.0 | Cloudflare Pages dev/deploy |
| eslint + typescript-eslint | ^10.6.0 / ^8.62.1 | Lint |
| eslint-plugin-react-hooks / react-refresh | ^7.1.1 / ^0.5.3 | React lint rules |
| @vitejs/plugin-react | ^6.0.3 | React Vite plugin |
| puppeteer-core | ^25.3.0 | (dev dep) |
| @types/node/react/react-dom | ^26/^19.2 | Type defs |

---

## 🛠️ Scripts (`package.json:6-17`)

| Script | Fungsi / Purpose |
|---|---|
| `npm run dev` | Vite dev server (`--host`) |
| `npm run wrangler` | Pages dev port 8788 + Vite |
| `npm run build` | `tsc -b && vite build` → `dist/` |
| `npm run lint` | `eslint .` |
| `npm test` | `node --test tests/*.test.mjs` (26 file/268 case) |
| `npm run gate:compare` | `node scripts/gate-compare.mjs` — bandingin win% raw vs emission-gated |
| `npm run build:edge` | esbuild bundle `src/core/edge-engine.ts` → 3 `_engine.mjs` (auto-journal/daily-summary/asset-discovery) |
| `npm run deploy:edge` | build:edge + `supabase functions deploy auto-journal` |
| `npm run deploy:summary` | build:edge + deploy daily-summary |
| `npm run deploy:discovery` | build:edge + deploy asset-discovery |
| `npm run preview` | vite preview |

---

## ⚙️ Konfigurasi / Config files

| File | Isi kunci / Key contents |
|---|---|
| `tsconfig.json` | Solution file, references `tsconfig.app.json` + `tsconfig.node.json`, `paths @/* → ./src/*` |
| `tsconfig.app.json` | target es2023, lib ES2023+DOM, bundler resolution, `verbatimModuleSyntax`, strict lint (`noUnusedLocals/Parameters`, `noFallthroughCasesInSwitch`), jsx react-jsx, include `src` |
| `tsconfig.node.json` | target es2023, lib ES2023, types node, include `vite.config.ts` |
| `eslint.config.js` | Flat config. TS/TSX extend `js.configs.recommended` + `tseslint.configs.recommended` + react-hooks + react-refresh. Browser globals. `react-refresh/only-export-components: error` (allow `badgeVariants`/`buttonVariants`/`tabsListVariants`/`useSidebar`/`useTheme`) |
| `vite.config.ts` | Plugins: react, tailwindcss, custom `yahooCrumbDevPlugin()` (dev-only Yahoo crumb mint). Resolve `@ → ./src`. Dev proxy `/api/yahoo` → `query1.finance.yahoo.com`, `/api/fng` → `api.alternative.me` |
| `wrangler.toml` | `name = "react-rabalaba"`, `compatibility_date = "2024-01-01"` (minimal; Pages Functions) |
| `components.json` | shadcn config: style `radix-nova`, `rsc:false`, `tsx:true`, baseColor neutral, cssVariables true, iconLibrary lucide, alias `@/components`/`@/lib/utils`/`@/components/ui`/`@/lib`/`@/hooks` |
| `.env.example` | Legacy/stale — `VITE_ACCESS_KEY`/`VITE_ACCESS_CODE`/`VITE_TRIAL_CODE`/`VITE_TRIAL_DURATION` (kosong; migrasi pindah ke DB `access_codes`) |
| `.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (browser client) |

---

## 🚀 Deployment target

| Target | Platform |
|---|---|
| SPA | Cloudflare Pages (`rabalaba.pages.dev`) |
| Edge Functions (3) | Supabase project `nravncsodgcxwkdaeqcw` |
| DB + Auth + pg_cron | Supabase Postgres |
| Cron wiring | `supabase/schedule-*.sql` (pg_cron + pg_net + Vault) |

> Detail deploy: [`07-deployment.md`](07-deployment.md).

---

## 🔗 Terkait / Related
- [`00-architecture.md`](00-architecture.md) — arsitektur
- [`07-deployment.md`](07-deployment.md) — cara deploy
- [`../README.md`](../README.md) — index
