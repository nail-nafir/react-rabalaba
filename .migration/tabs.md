# tabs

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova wrapper migrated successfully.

## Changed

- `src/components/ui/tabs.tsx` now maps Base UI Root, List, Tab, and Panel parts and uses `data-active`/`data-hidden` state hooks.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/tabs.tsx` returned no matches.

## Left alone

- No application Tabs consumer currently exists, so no call-site migration was required.
- No demo route or temporary consumer was added solely for migration.

## Behavior changes

- Stock Base UI tabs use manual activation by default: arrow keys move focus, while Space/Enter activates the focused tab. Radix defaulted to automatic activation on focus.
- A future automatic-activation consumer must opt in with `activateOnFocus` on `TabsList`.

## Verify by hand

- Smoke-test a Tabs instance: Tab into the list, move with arrow keys, confirm the panel does not change until Space/Enter, and verify disabled tabs are skipped.
- Check horizontal and vertical layouts plus visible focus and active styling.
