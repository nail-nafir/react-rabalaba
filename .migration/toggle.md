# toggle

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova wrapper migrated successfully.

## Changed

- `src/components/ui/toggle.tsx` replaced Radix Toggle with the Base UI primitive while retaining stock Base Nova variants and sizes.
- `src/components/ui/toggle-group.tsx` now consumes this Base Toggle as its item primitive.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/toggle.tsx` returned no matches.

## Left alone

- There are no standalone application Toggle consumers; rating behavior is documented with ToggleGroup.
- Application visual variants were not extended beyond stock Base Nova.

## Behavior changes

- Pressed state follows Base UI's `aria-pressed`/presence-state model, and change callbacks can receive Base event details.
- Current usage through ToggleGroup has no additional standalone behavior change.

## Verify by hand

- Toggle rating buttons on and off and confirm pressed styling and visible focus.
- Verify disabled toggles do not respond to pointer or keyboard input.
