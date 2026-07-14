# switch

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova wrapper and state selectors migrated successfully.

## Changed

- `src/components/ui/switch.tsx` now uses Base UI Switch Root/Thumb and `data-checked`/`data-unchecked` presence selectors.
- Radix `data-[state=checked]` consumer styles were changed to `data-checked` in `src/features/admin/components/journal-settings-dialog.tsx:347`, `src/features/admin/components/payment-method-dialog.tsx:244`, and `src/features/admin/components/plan-dialog.tsx:311`.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/switch.tsx` returned no matches.

## Left alone

- Controlled boolean state, validation, and persistence handlers in the admin dialogs were retained.
- No consumer depended on a dropped Radix-only prop.

## Behavior changes

- Base UI exposes checked state through presence attributes and its own semantic switch/form-input model; the boolean callback remains compatible.

## Verify by hand

- Toggle every journal setting plus payment-method and plan active/highlight switches.
- Confirm keyboard Space operation, focus rings, disabled state, colors, and thumb movement in light and dark themes.
