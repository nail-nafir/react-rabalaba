# select

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova wrapper and every Select consumer migrated successfully.

## Changed

- `src/components/ui/select.tsx` now maps Base UI Root, Group, Value, Trigger, Portal, Positioner, Popup/List, Item, indicators, labels, separators, and scroll arrows.
- All Select roots now receive a shared `{ label, value }[]` `items` collection and render items inside `SelectGroup` in `src/app/layouts/admin-layout.tsx`, `src/app/layouts/auth-layout.tsx`, `src/components/shared/filter-group.tsx`, `src/features/admin/components/add-access-code-dialog.tsx`, `src/features/admin/components/add-invitation-dialog.tsx`, `src/features/admin/components/journal-settings-dialog.tsx`, `src/features/admin/components/payment-method-dialog.tsx`, `src/features/admin/components/plan-dialog.tsx`, `src/features/admin/components/testimonials-table.tsx`, `src/features/admin/components/user-dialog.tsx`, and `src/pages/terminal/index.tsx`.
- Radix `position="popper"` became `alignItemWithTrigger={false}` where used, and controlled handlers guard Base's nullable `onValueChange` result before writing domain state.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/select.tsx` returned no matches.

## Left alone

- Existing placeholders remain on `SelectValue`, and form schemas/domain values remain non-null strings.
- Translation, option ordering, validation, testimonial slot rules, and theme/language business logic were not otherwise changed.

## Behavior changes

- Base Select can return `null` and uses the root `items` collection to render labels that differ from values; consumers deliberately ignore null at non-null domain boundaries.
- Popup positioning and sizing use Base Positioner plus `--anchor-*`/`--available-*` variables; popper-like consumers opt out of item-to-trigger alignment explicitly.

## Verify by hand

- Exercise language/theme, filters, access/invitation kind, journal settings, payment category/icon, plan icon/CTA, testimonial status/slot, user tier/role/status, and terminal view selects.
- Verify placeholder text, current label, keyboard arrows, Home/End, typeahead, Escape, outside press, focus return, disabled items, long lists, and scroll arrows.
- Check mobile/desktop popup placement and confirm clearing or dismissal never writes an invalid null domain value.
