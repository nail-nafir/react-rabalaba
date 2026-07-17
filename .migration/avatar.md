# avatar

2026-07-14 — Golden pair via shadcn CLI; the stock Base Nova wrapper migrated successfully.

## Changed

- `src/components/ui/avatar.tsx` now uses Base UI Root, Image, and Fallback parts while retaining stock Base Nova size, group, badge, and fallback helpers.
- Leftover scan: `grep -n "radix-ui\|@radix-ui" src/components/ui/avatar.tsx` returned no matches.

## Left alone

- Testimonial avatar consumers already include `AvatarFallback` and required no API changes.
- User initials and membership-label logic were intentionally untouched.

## Behavior changes

- Base UI names the fallback delay prop `delay` instead of Radix `delayMs`; no current consumer used the old prop.
- Image loading and fallback behavior otherwise remain equivalent.

## Verify by hand

- Load testimonial cards and the testimonial dialog with a valid image and with a failed/missing image.
- Confirm default, small, and large sizes stay circular and fallback initials remain centered.
