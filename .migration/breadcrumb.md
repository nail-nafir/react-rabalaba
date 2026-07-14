# breadcrumb

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova wrapper migrated successfully.

## Changed

- `src/components/ui/breadcrumb.tsx` replaced Radix Slot in `BreadcrumbLink` with Base UI `useRender`/`mergeProps`; structural nav, list, page, separator, and ellipsis parts remain semantic HTML.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/breadcrumb.tsx` returned no matches.

## Left alone

- `src/app/layouts/admin-layout.tsx` currently uses breadcrumb page/separator parts only, whose public API did not change.
- Route-label generation and admin layout styling were not part of this wrapper migration.

## Behavior changes

- Custom breadcrumb links must use `render` instead of `asChild`; the current admin breadcrumb has no runtime change.

## Verify by hand

- Navigate across admin pages and confirm the current page, separator visibility, wrapping, and accessible breadcrumb label.
- If a breadcrumb link is added, verify Tab and Enter operate on the rendered link.
