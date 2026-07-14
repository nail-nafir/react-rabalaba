# progress

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova wrapper migrated successfully.

## Changed

- `src/components/ui/progress.tsx` now uses Base UI Root, Track, Indicator, Label, and Value parts.
- Indicator width is computed by Base UI; the former manual Radix `translateX` percentage calculation was removed.
- `src/components/shared/page-loader.tsx` retained its existing `Progress` usage because the value contract remains compatible.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/progress.tsx` returned no matches.

## Left alone

- Page-loading timing and application state were not changed.
- No consumer relied on Radix `data-state`, `data-value`, or `data-max` attributes.

## Behavior changes

- Status hooks are now Base presence attributes (`data-progressing`, `data-complete`, `data-indeterminate`).
- Base UI owns min/max-aware indicator sizing and indeterminate semantics instead of the wrapper's manual transform.

## Verify by hand

- Exercise 0%, partial, 100%, and indeterminate progress values and confirm track/indicator sizing.
- Trigger the page loader and confirm its animation, layout, and accessible value text.
