# sheet

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova wrapper migrated successfully.

## Changed

- `src/components/ui/sheet.tsx` now composes Base UI Dialog primitives for Root, Trigger, Close, Portal, Backdrop, and Popup while retaining side-specific Base Nova transitions.
- `src/components/ui/sidebar.tsx` continues to consume Sheet for its mobile presentation with a hidden accessible title and description.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/sheet.tsx` returned no matches.

## Left alone

- There are no direct application Sheet consumers outside Sidebar.
- Sidebar state, cookie persistence, and navigation data were handled in the separate Sidebar migration.

## Behavior changes

- Sheet dismissal, focus trapping, and focus restoration now follow stock Base Dialog behavior.
- Custom trigger/close elements must use `render` instead of `asChild`.

## Verify by hand

- At a mobile viewport, open and close the admin sidebar with its trigger, close button/outside press, and Escape.
- Confirm focus stays trapped while open, returns after close, scrolling is locked, and all four side transitions remain correct.
