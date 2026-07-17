# checkbox

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova wrapper migrated successfully.

## Changed

- `src/components/ui/checkbox.tsx` now uses Base UI Checkbox Root/Indicator and Base presence selectors such as `data-checked` and `data-indeterminate`.
- `src/features/market/components/disclaimer-dialog.tsx` retained its boolean `checked` contract and already normalizes the callback with `value === true`.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/checkbox.tsx` returned no matches.

## Left alone

- Disclaimer persistence and agreement business logic were not changed.
- No current consumer used Radix's string `"indeterminate"` checked value.

## Behavior changes

- Base UI represents indeterminate state with a separate `indeterminate` prop rather than a checked-value sentinel.
- The primitive renders its semantic checkbox control and hidden form input using Base UI's form model; current boolean behavior is unchanged.

## Verify by hand

- Open the disclaimer gate, toggle the checkbox with mouse and Space, and confirm the agreement button enables correctly.
- Confirm checked, unchecked, disabled, focus-visible, and invalid styles.
