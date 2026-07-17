# badge

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova wrapper migrated successfully.

## Changed

- `src/components/ui/badge.tsx` replaced Radix Slot composition with Base UI `useRender`/`mergeProps` and the `render` prop.
- Existing variants and application badge styling were retained by the stock Base Nova source.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/badge.tsx` returned no matches.

## Left alone

- Existing badge consumers do not use `asChild`, so their markup and domain-specific colors were intentionally unchanged.
- Unrelated status and taxonomy helpers were not modified.

## Behavior changes

- Future element substitution uses `render` instead of `asChild`; current consumers have no behavioral change.

## Verify by hand

- Inspect status, tier, subscription, and testimonial badges in light and dark themes.
- Confirm linked/rendered badges remain keyboard focusable if a future consumer uses `render`.
