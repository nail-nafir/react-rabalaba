# label

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova native-label wrapper migrated successfully.

## Changed

- `src/components/ui/label.tsx` replaced Radix Label with a native `<label>` while preserving `htmlFor`, styling, disabled-state selectors, and `select-none` behavior.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/label.tsx` returned no matches.

## Left alone

- Existing form consumers in the admin dialogs did not require changes because they already use native label props.
- `FieldLabel` and other form wrappers were outside this primitive migration.

## Behavior changes

- Label semantics now come directly from the browser; no Base UI Label primitive exists.
- No visible change is intended. The retained `select-none` class preserves the useful Radix double-click selection behavior.

## Verify by hand

- Click labels in admin forms and confirm the associated input, textarea, or control receives focus.
- Check disabled fields for the expected cursor and opacity treatment.
