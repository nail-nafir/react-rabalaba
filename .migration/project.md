# Project migration report

2026-07-14 — The project is fully migrated from shadcn Radix Nova to stock Base Nova on branch `chore/base-ui-upgrade`.

## Dependency and configuration swap

- Added `@base-ui/react@1.6.0`; removed `radix-ui` and every Radix import.
- Upgraded `@supabase/supabase-js` to `2.110.4`, `@types/node` to `26.1.1`, `eslint` to `10.7.0`, `i18next` to `26.3.6`, `lucide-react` to `1.24.0`, `react-i18next` to `17.0.9`, `typescript-eslint` to `8.64.0`, `vite` to `8.1.4`, and `wrangler` to `4.110.0`.
- Added direct dev dependencies `esbuild@0.28.1` and `supabase@2.109.1`; local Supabase CLI reports `2.109.1`.
- Kept TypeScript `6.0.3` and Recharts `3.9.2` as planned. The shadcn chart refresh attempted `3.8.0`, then the project was explicitly restored to `3.9.2`.
- Changed `components.json` from `radix-nova` to `base-nova` while retaining Purple, Inter, aliases, and `src/index.css`.
- Vite 8 SSR teardown can crash Node 24 test workers after otherwise-passing files. The test script now uses Node's shared-process test isolation, preserving all 316 assertions and the three locked baseline failures.

## Component migration

- Migrated 21 primitive wrappers with the golden-pair CLI workflow and one commit per component: button, label, badge, breadcrumb, separator, avatar, checkbox, switch, progress, toggle, toggle-group, accordion, tabs, dialog, sheet, alert-dialog, popover, tooltip, dropdown-menu, select, and sidebar.
- Refreshed calendar, card, chart, field, input-group, input, skeleton, sonner, spinner, table, and textarea from the current Base Nova registry. Identical sources were left unchanged by the CLI.
- `shadcn info --json` reports `style: base-nova`, `base: base`, Purple/Inter/Lucide, and all 32 components.
- Final derived count: **0 wrappers remain on Radix**.

## Consumer sweep and intentional behavior changes

- Replaced trigger `asChild` composition with Base `render`; links and anchors use `buttonVariants` directly.
- All 18 Select roots provide `items`, all options are inside `SelectGroup`, former popper positioning uses `alignItemWithTrigger={false}`, and nullable values are guarded at domain boundaries.
- ToggleGroup uses an array value while preserving single rating selection; Accordion no longer receives Radix `type` or `collapsible` props.
- Removed terminal opener refs, fallback heading focus, `onCloseAutoFocus`, fallback metadata, and trigger-element arguments. Base UI restores focus to the previously focused element.
- AlertDialog uses stock behavior: Cancel closes, plain Action does not auto-close, and only pre-existing controlled business flows call `setOpen(false)`.
- Menu items use `onClick` and groups; normal items close, while radio/checkbox items retain Base UI's default open state.
- Replaced checked/open/width hooks with Base attributes and variables. The controlled disclaimer remains non-dismissible with no close button.
- Global leftovers scan is clean for Radix imports/names, `asChild`, `position="popper"`, Radix CSS variables/selectors, focus shims, and `IconPlaceholder`. The only remaining `onSelect` is React DayPicker's valid calendar callback.

## Verification

- `npm ci`: passed from the committed lockfile (`557` packages installed).
- npm 11 unpacked five bundled WASM fallbacks for platform-ineligible optional Tailwind/Rolldown packages and marked them orphaned; the generated directories were removed. Final `npm ls --depth=0` is clean with no extraneous or peer errors.
- `npm audit`: 0 vulnerabilities.
- `npm run lint`: passed.
- `npm run build`: passed on Vite `8.1.4`; the existing large-chunk warning remains intentionally out of scope.
- `npm run build:edge`: passed using direct `esbuild@0.28.1`.
- `npm test`: 313/316 passed. The only failures are the locked baseline IHSG label assertion and two testimonial schema assertions.
- Headless Chrome desktop/mobile QA passed 16 rendered scenarios across the stock wrappers plus landing, auth, subscription, and terminal: Select, Accordion, ToggleGroup, Switch, menu close/stay-open behavior, AlertDialog Action/Cancel, nested Dialog → AlertDialog, Dialog → Popover → Calendar, Sheet, Escape, outside press, scroll lock, mobile popup bounds, disclaimer dismissal blocking, and terminal default focus restoration.
- An authenticated admin browser session was unavailable, so admin visual data flows were covered by the same rendered wrapper harness plus global AST, TypeScript, and targeted ESLint audits. Those audits confirmed valid grouping, titles, render targets, controlled close logic, and no legacy shims.

## Final verdict

The repository is on stock `base-nova`, all 32 shadcn wrappers are current and detected, application-level styling is preserved, and no `radix-ui` dependency, import, selector, or compatibility layer remains.
