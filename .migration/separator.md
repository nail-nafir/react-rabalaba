# separator

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova wrapper migrated successfully.

## Changed

- `src/components/ui/separator.tsx` now uses `@base-ui/react/separator`, with Base presence selectors for horizontal and vertical orientation.
- Existing separator consumers retained their orientation and layout classes; none passed the removed `decorative` prop.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/separator.tsx` returned no matches.

## Left alone

- Page and table layouts using Separator were not otherwise restyled.
- Pure CSS borders elsewhere were not converted because they are unrelated layout details.

## Behavior changes

- Base UI Separator is always semantic (`role="separator"`); the previous wrapper defaulted Radix separators to decorative. Purely visual future rules should use an aria-hidden element or CSS border instead.

## Verify by hand

- Inspect horizontal separators on admin, subscription, calendar, and terminal pages and vertical separators in responsive layouts.
- Check the accessibility tree to confirm separators are exposed intentionally and do not receive keyboard focus.
