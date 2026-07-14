# accordion

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova wrapper and FAQ consumer migrated successfully.

## Changed

- `src/components/ui/accordion.tsx` now maps Base UI Root, Item, Header, Trigger, and Panel parts with Base open/closed animation hooks.
- `src/pages/landing/index.tsx:208` removed Radix `type="single"` and `collapsible`; the default Base single mode matches the FAQ's intended collapsible behavior.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/accordion.tsx` returned no matches.

## Left alone

- FAQ translation data, item ordering, and visual styling were retained.
- No controlled or multiple Accordion consumer required value-array conversion.

## Behavior changes

- Base UI single mode is always collapsible and controlled/default values are arrays.
- Base UI no longer provides Radix-style roving arrow-key focus between accordion triggers; triggers remain reachable with normal Tab navigation.

## Verify by hand

- On the landing FAQ, open, switch, and close items with pointer, Enter, and Space.
- Confirm only one panel is open, animation height is correct, Tab reaches every trigger, and focus remains visible.
