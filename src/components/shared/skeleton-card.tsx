import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { TableCell } from "@/components/ui/table";

export function SkeletonCalendarItem() {
  return (
    <Card className="border border-border" aria-hidden="true">
      <CardContent className="flex items-center gap-3 px-4 py-4 sm:gap-4">
        <Skeleton className="size-7 shrink-0 rounded-lg sm:size-8" />
        <Skeleton className="h-5 w-20 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-1">
          <Skeleton className="h-4 w-3/4 max-w-64" />
          <Skeleton className="h-3 w-1/4 max-w-16" />
        </div>
        <Skeleton className="h-5 w-16 shrink-0 rounded-md" />
      </CardContent>
    </Card>
  );
}
export function SkeletonAssetSignalRow() {
  return (
    <>
      <TableCell>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-14" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-20 rounded-md" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-2 w-16 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-8 rounded-md" />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Skeleton className="h-2 w-16 rounded-full" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded-md" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-8 w-16" />
      </TableCell>
    </>
  );
}

export function SkeletonFollowHistoryRow() {
  return (
    <>
      <TableCell>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-28" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-12" />
      </TableCell>
      <TableCell>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-8 rounded-md" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded-md" />
      </TableCell>
      <TableCell>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-12 rounded-md" />
      </TableCell>
    </>
  );
}

/** Loading row for the admin auto-journal table (journal-asset-manager).
 *  Mirrors its 8 columns: added, added by, symbol, type, price, change, status,
 *  and the right-aligned action buttons. */
export function SkeletonJournalAssetRow() {
  return (
    <>
      <TableCell>
        <div className="space-y-1.5 py-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-14" />
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1.5 py-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-28" />
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1.5 py-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-28" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded-md" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded-md" />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
        </div>
      </TableCell>
    </>
  );
}

/** Loading row for the admin registered-users table (registered-users-table).
 *  Mirrors its 7 columns: joined (date+time), email, role, tier (+ code),
 *  last login (date+time), disclaimer, actions. */
export function SkeletonAdminUserRow() {
  return (
    <>
      <TableCell>
        <div className="space-y-1.5 py-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-14" />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 py-1">
          <Skeleton className="h-4 w-40" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded-md" />
      </TableCell>
      <TableCell>
        <div className="space-y-1.5 py-1">
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-3 w-20" />
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1.5 py-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-14" />
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1.5 py-1">
          <Skeleton className="h-5 w-12 rounded-md" />
          <Skeleton className="h-3 w-16" />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
        </div>
      </TableCell>
    </>
  );
}

/** Loading row for the admin payment-methods table (payment-methods-table).
 *  Mirrors its 5 columns: method (name), category, account, status, actions. */
export function SkeletonPaymentMethodRow() {
  return (
    <>
      <TableCell>
        <Skeleton className="h-4 w-28" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded-md" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-32" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded-md" />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
        </div>
      </TableCell>
    </>
  );
}

/** Loading row for the admin subscription-plans table (subscription-plans-table).
 *  Mirrors its 6 columns: plan (name), tier, price, highlight, active, actions. */
export function SkeletonSubscriptionPlanRow() {
  return (
    <>
      <TableCell>
        <Skeleton className="h-4 w-28" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded-md" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded-md" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded-md" />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
        </div>
      </TableCell>
    </>
  );
}

/** Loading row for the admin invitations table (invitations-table).
 *  Mirrors its 6 columns: invite (code+recipient), type, uses, expires (date+time), status, actions. */
export function SkeletonInvitationRow() {
  return (
    <>
      <TableCell>
        <div className="space-y-1.5 py-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded-md" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-10" />
      </TableCell>
      <TableCell>
        <div className="space-y-1.5 py-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-14" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded-md" />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
        </div>
      </TableCell>
    </>
  );
}

/** Loading row for the admin access-codes table (registered-users-table).
 *  Mirrors its 8 columns: created (date+time), code, type, note, max uses, used, trial days, actions. */
export function SkeletonAccessCodeRow() {
  return (
    <>
      <TableCell>
        <div className="space-y-1.5 py-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-14" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-24 rounded-md" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-12 rounded-md" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-28" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-8" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-8" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-8" />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
        </div>
      </TableCell>
    </>
  );
}
