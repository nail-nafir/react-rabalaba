# alert-dialog

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova wrapper and confirmation consumers migrated successfully.

## Changed

- `src/components/ui/alert-dialog.tsx` now maps Base UI Root, Trigger, Portal, Backdrop, Popup, Close, Title, and Description. `AlertDialogAction` is the stock plain Button; Cancel renders Base Close.
- Trigger composition migrated from `asChild` to `render` in `src/features/admin/components/delete-access-code-dialog.tsx:53`, `src/features/admin/components/disclaimer-editor.tsx:162`, `src/features/admin/components/journal-assets-table.tsx:196`, `src/features/admin/components/payment-methods-table.tsx:230`, `src/features/admin/components/registered-users-table.tsx:166`, `src/features/admin/components/subscription-plans-table.tsx:259`, and `src/features/testimonials/components/testimonial-dialog.tsx:403`.
- `src/features/admin/components/testimonials-table.tsx` retained its controlled business flows, and the testimonial delete action removed its Radix-only `preventDefault` close shim.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/alert-dialog.tsx` returned no matches.

## Left alone

- Existing explicitly controlled dialogs that already call `setOpen(false)` kept that business logic.
- Async success/error handling was not expanded solely to emulate Radix auto-close behavior.

## Behavior changes

- Stock Base Nova `AlertDialogAction` does not close the dialog automatically; uncontrolled confirmations remain open after Action until Cancel or another close path is used.
- `AlertDialogCancel` still closes. Base UI initially focuses the first tabbable element rather than guaranteeing Radix's Cancel-first behavior.

## Verify by hand

- Exercise user, code, asset, payment-method, plan, disclaimer, and testimonial confirmations; confirm uncontrolled Action stays open and Cancel closes.
- Verify controlled invitation/testimonial flows still close only where their existing handlers request it.
- Check initial focus, focus trap, Escape behavior, pending disabled states, and nested AlertDialog inside Testimonial Dialog.
