# dialog

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova wrapper and dialog focus consumers migrated successfully.

## Changed

- `src/components/ui/dialog.tsx` now maps Base UI Root, Trigger, Portal, Backdrop, Popup, Close, Title, and Description; trigger/close composition uses `render`.
- `src/features/follow-trade/components/trade-detail-dialog.tsx:159` migrated `DialogClose` composition and removed the Radix `onCloseAutoFocus` contract. `src/features/trading-plan/components/asset-detail-dialog.tsx`, `src/features/market/components/market-terminal-content.tsx`, and `src/features/journal/components/journal-terminal-content.tsx` stopped threading that callback.
- The manual opener/fallback-focus system was removed from `src/features/terminal/hooks/use-terminal-dialog-url.ts`, `src/features/terminal/lib/dialog-url.ts`, `src/pages/terminal/index.tsx`, `src/components/layout/search-command.tsx`, `src/features/market/components/asset-signal-table.tsx`, `src/features/journal/components/top-performers.tsx`, `src/features/follow-trade/components/follow-history-table.tsx`, and `tests/terminal-dialog-url.test.mjs`.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/dialog.tsx` returned no matches.

## Left alone

- Dialog business logic, form submission, URL-driven open state, disclaimer non-dismissal, and nested non-Radix Calendar content were retained.
- Other dialogs with compatible `open`/`onOpenChange` props required no mechanical changes.

## Behavior changes

- Dialogs now use stock Base UI focus restoration to the trigger or previously focused element; the terminal's custom stored opener and heading fallback were intentionally removed.
- Radix autofocus event handlers are replaced by Base `initialFocus`/`finalFocus` props when explicit targeting is needed; no compatibility shim was added.

## Verify by hand

- Open and close terminal asset/trade dialogs by close button, Escape, and browser Back; confirm Base focus restoration and no focus trap leak.
- Test nested testimonial AlertDialog and invitation Popover/Calendar, then verify disclaimer dialogs remain non-dismissible.
- Check every Dialog has an accessible title and that outside-click behavior matches its controlled state.
