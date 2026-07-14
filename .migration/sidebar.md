# sidebar

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova wrapper and admin navigation consumer migrated successfully.

## Changed

- `src/components/ui/sidebar.tsx` was reset to the stock Base Nova source, including Base `useRender` composition for renderable menu buttons and Base Sheet/Tooltip dependencies.
- `src/app/layouts/admin-layout.tsx:191` migrated brand and navigation `SidebarMenuButton` links from `asChild` to `render={<Link />}` while preserving active state and content.
- `src/hooks/use-mobile.ts` was refreshed to the stock companion hook, initializing mobile state after mount and returning a stable boolean.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/sidebar.tsx` returned no matches.

## Left alone

- Sidebar route definitions, authorization, cookie name/lifetime, collapse mode, and product styling were retained.
- Sheet and Tooltip behavior are documented in their own component reports.

## Behavior changes

- Custom menu-button elements use Base `render` instead of Radix slotting; links remain semantic anchors.
- Mobile detection begins as unknown/false until the first client effect, matching the stock Base Nova hydration-safe hook; sidebar keyboard shortcut and cookie persistence remain unchanged.

## Verify by hand

- On desktop, expand/collapse with the button and Cmd/Ctrl+B; navigate every item and confirm active styling, tooltips, and cookie persistence after reload.
- On mobile, open the Sheet sidebar, navigate, close via Escape/outside press, and rotate/resize across the breakpoint.
- Confirm brand, nested groups, user menu, focus order, and link semantics in collapsed and expanded modes.
