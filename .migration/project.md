# Project reconciliation report

2026-07-17 — The former `chore/base-ui-upgrade` work is reconciled with the newer `main` product tree on `chore/base-ui-upgrade-reconcile`.

## Git reconciliation

- Created safety ref `backup/main-before-base-ui-reconcile-20260717` at `main@3e02b5abf71f111bf2466bbc6db95b2dd44b2dd1`.
- Recorded all 29 commits from `chore/base-ui-upgrade` through the `e20ff60` `ours` merge. This preserves ancestry without replacing the newer `main` tree.
- Ported only missing Base UI semantics. Newer logout confirmation, terminal URL behavior, follow-history sorting/badges, empty states, copy, and market summary remain authoritative.
- Kept the old branch and all ten pre-existing stashes unchanged. No push, deployment, schema, RLS, or Edge Function change was performed.

## Dependency and configuration result

- Final UI stack is `@base-ui/react@1.6.0` with shadcn `base-nova`; no `radix-ui` dependency or import remains.
- Kept the newer `main` dependency choices, including `@supabase/supabase-js@2.110.5`, TypeScript `6.0.3`, Recharts `3.9.2`, and the existing shared-process test script.
- Added direct dev dependencies `esbuild@0.28.1` and `supabase@2.109.1`; the local Supabase CLI reports `2.109.1`.
- Preserved Purple, Inter, Lucide, aliases, and `src/index.css`.
- `npm ci` reproduced the lockfile with 557 packages. npm 11 unpacked five bundled WASM fallbacks from platform-ineligible optional Tailwind/Rolldown packages at the top level; those generated extraneous directories were removed. The final `npm ls --depth=0` tree is clean and has no peer errors.
- `npm audit` reports zero vulnerabilities. Registry verification covered 556 signed packages and 173 attestations.

## Wrapper reconciliation

- Audited all 32 installed wrappers with shadcn `add --dry-run` and `--diff`, without bulk overwrite or `shadcn migrate radix`.
- Applied registry-semantic updates to Checkbox, Sheet, Sidebar, Switch, Table, and Tabs. Formatting-only changes and the registry's attempted Recharts downgrade were ignored.
- Preserved the 21 per-component migration reports from the old branch and added this reconciliation-level report.
- `shadcn info` reports `style: base-nova`, `base: base`, Purple/Inter/Lucide, and all 32 components.

## Consumer reconciliation

- All 18 Select roots now provide `items`, wrap options in `SelectGroup`, use `alignItemWithTrigger={false}`, and guard nullable values at form/domain boundaries.
- Menu content is grouped; the five testimonial actions use `onClick`. Normal items close while checkbox/radio items retain Base UI's stock stay-open behavior.
- Replaced stale state and width hooks with `data-popup-open`, `data-checked`, and `--anchor-width`.
- Removed terminal `fallbackFocusRef`, `openerRef`, `onCloseAutoFocus`, `onDetailCloseAutoFocus`, trigger-element arguments, and fallback focus metadata. Base UI now owns focus restoration.
- Controlled logout confirmation and the non-dismissible disclaimer remain product behavior, not compatibility shims.
- Static scans are clean for Radix dependencies/imports, `asChild`, `position="popper"`, `--radix-*`, stale open/checked selectors, focus shims, and `IconPlaceholder`. The only remaining `onSelect` is React DayPicker's calendar callback.

## Verification

- `npm run lint`: passed.
- `npm run build`: passed on Vite `8.1.4`.
- `npm run build:edge`: passed using direct `esbuild@0.28.1`.
- `npm test`: 314/316 passed. The only failures are the two existing testimonial-schema assertions; no new failure was introduced.
- Terminal URL tests pass 9/9, including parser, canonicalization, close behavior, and history-origin handling.
- Headless Chrome QA passed on desktop and mobile for Select, menu close/stay-open behavior, AlertDialog Action/Cancel, Switch, ToggleGroup, Accordion, Sheet, Sidebar collapse/mobile sheet, nested Dialog → AlertDialog, Dialog → Popover → Calendar, Escape, outside press, scroll lock, popup bounds, and default focus restoration.
- Real-page QA passed for landing, auth, subscription, anonymous admin-route protection, terminal mobile Select, non-dismissible disclaimer, and terminal detail URL Back/Forward with row focus restoration. No authenticated admin session was used; admin component interactions were covered by the same stock wrapper harness plus AST, TypeScript, and ESLint audits.

## Final verdict

The reconciled tree is on stock Base Nova with 32 detected wrappers, the newer `main` product behavior is preserved, and no Radix dependency, import, selector, or focus compatibility layer remains.
