# popover

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova wrapper and calendar trigger migrated successfully.

## Changed

- `src/components/ui/popover.tsx` now composes Base UI Portal, Positioner, Popup, Trigger, and Anchor behavior with Base CSS variables and presence-state hooks.
- `src/features/admin/components/add-invitation-dialog.tsx:328` replaced `PopoverTrigger asChild` with Base `render` composition around the date button.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/popover.tsx` returned no matches.

## Left alone

- The non-Radix Calendar wrapper, date parsing, validation, and clear-date behavior were not changed by this primitive migration.
- No application consumer used the removed standalone Radix Anchor part.

## Behavior changes

- Positioning now uses Base UI Positioner variables and collision handling; focus and dismissal use Base root/popup contracts.
- No Radix autofocus compatibility handler was added.

## Verify by hand

- Open the invitation date picker from keyboard and pointer, select and clear a date, then close with Escape and outside press.
- Check placement near viewport edges, focus return, scroll behavior, and the nested Dialog → Popover → Calendar stack.
