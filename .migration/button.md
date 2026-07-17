# button

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova wrapper and its consumers migrated successfully.

## Changed

- `src/components/ui/button.tsx` now uses the real `@base-ui/react/button` primitive and exposes Base UI `render` composition through its native props.
- Link-style buttons were converted to semantic `Link`/`a` elements with `buttonVariants` in `src/app/layouts/admin-layout.tsx:367`, `src/components/layout/header.tsx:58`, `src/features/testimonials/components/testimonial-section.tsx:85`, `src/pages/invite/index.tsx:173`, `src/pages/subscription/components/payment-dialog.tsx:106`, and `src/pages/subscription/index.tsx:198`.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/button.tsx` returned no matches.

## Left alone

- Ordinary button consumers kept their existing `variant`, `size`, loading, and click handlers because those public props remain compatible.
- Unrelated registry wrappers and application styling were not changed as part of this component migration.

## Behavior changes

- Navigation CTAs are now real links instead of buttons with slotted anchors, preserving native link semantics and avoiding a forced `role="button"`.
- Base UI supplies the native button interaction behavior for actual `Button` instances.

## Verify by hand

- Tab through header, invitation, subscription, testimonial, and admin navigation links; confirm Enter navigates and focus rings remain visible.
- Click ordinary, disabled, destructive, and icon buttons and confirm their prior behavior and sizing.
