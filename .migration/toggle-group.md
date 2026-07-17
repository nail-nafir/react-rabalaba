# toggle-group

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova wrapper and rating consumer migrated successfully.

## Changed

- `src/components/ui/toggle-group.tsx` now uses Base UI ToggleGroup with Base Toggle items and retains Base Nova variant/size/spacing context.
- `src/features/testimonials/components/testimonial-dialog.tsx:335` removed Radix `type="single"`, wraps the controlled rating in a string array, and unwraps the first value in `onValueChange`.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/toggle-group.tsx` returned no matches.

## Left alone

- Testimonial validation still stores a numeric rating and maps an empty selection to `0`.
- No multiple-selection ToggleGroup exists in the application.

## Behavior changes

- Base UI always represents ToggleGroup values as arrays; single selection is the default and `multiple` enables multi-selection.
- Deselecting the active rating produces an empty array, which the consumer intentionally maps to the existing unrated value.

## Verify by hand

- Open the testimonial form, select ratings 1–5, change the selection, and deselect the active value.
- Confirm arrow/tab keyboard behavior, validation messages, star fill, focus rings, and mobile sizing.
