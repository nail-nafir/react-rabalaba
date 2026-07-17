# tooltip

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova wrapper migrated successfully.

## Changed

- `src/components/ui/tooltip.tsx` now maps Base UI Provider, Root, Trigger, Portal, Positioner, Popup, and Arrow, using Base positioning variables and state hooks.
- The provider's existing instant-open product choice remains `delay={0}`; stock Base Nova content uses a 4px side offset.
- `src/components/ui/sidebar.tsx` consumes the Base Tooltip trigger through its stock render composition.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/tooltip.tsx` returned no matches.

## Left alone

- `src/app/providers/index.tsx` and admin tooltip content required no API change.
- No consumer used Radix `disableHoverableContent` or custom autofocus/outside callbacks.

## Behavior changes

- Tooltip delay naming is Base `delay`/`timeout`; trigger click-close and hoverable-popup behavior follow stock Base UI.
- The popup now sits 4px from its anchor instead of the old wrapper's 0px default.

## Verify by hand

- Hover and keyboard-focus collapsed admin sidebar items and confirm the tooltip appears instantly, is correctly placed, and closes on blur/click.
- Check the arrow, edge collision, pointer travel into content, Escape, and light/dark contrast.
