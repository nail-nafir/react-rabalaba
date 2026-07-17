# dropdown-menu

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova wrapper and all menu consumers migrated successfully.

## Changed

- `src/components/ui/dropdown-menu.tsx` now maps Base UI Menu Root, Trigger, Portal, Positioner, Popup, groups, items, indicators, and submenu parts.
- `src/app/layouts/admin-layout.tsx:282`, `src/components/layout/user-menu.tsx:56`, and `src/features/admin/components/testimonials-table.tsx:330` replaced trigger `asChild` with `render`.
- Menu labels/items/submenus were placed inside `DropdownMenuGroup`; testimonial item handlers changed from Radix `onSelect` to Base `onClick`. Admin trigger state and width now use `data-popup-open` and `--anchor-width`.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/dropdown-menu.tsx` returned no matches.

## Left alone

- Authentication, language/theme state, testimonial moderation, and navigation handlers were retained.
- No `closeOnClick` compatibility props were added to radio or checkbox items.

## Behavior changes

- Plain menu items close by default. Base radio and checkbox items remain open by default, unlike Radix; language and theme menus intentionally follow this stock behavior.
- Base menus loop keyboard focus by default and use Base typeahead/event-detail semantics.

## Verify by hand

- Open admin, user, language, theme, and testimonial action menus with pointer and keyboard; verify arrows, Home/End, typeahead, submenu traversal, and focus return.
- Confirm plain actions close the menu while radio/checkbox choices stay open, and verify destructive actions still fire once.
- Check popup width alignment and edge collision on desktop and mobile.
