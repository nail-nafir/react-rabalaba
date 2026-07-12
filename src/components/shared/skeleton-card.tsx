import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell } from "@/components/ui/table";

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border/50 p-3 min-w-50",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-5 w-12 rounded" />
      </div>
      <Skeleton className="h-8 w-24 mb-4" />
      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-5 w-16 rounded" />
      </div>
    </div>
  );
}

export function SkeletonCryptoCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border/50 p-3 min-w-52 row-span-3",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-5 w-16 rounded" />
      </div>

      <div className="flex flex-col items-center w-full py-1 gap-1.5 mb-4">
        <Skeleton className="h-12.5 w-12.5 rounded-full shrink-0" />
        <div className="flex justify-center gap-4 text-[11px] w-full">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-muted-foreground/30" />
            <Skeleton className="h-3 w-10" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-muted-foreground/30" />
            <Skeleton className="h-3 w-10" />
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <div className="flex justify-between items-center w-full">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-8" />
        </div>
        <Skeleton className="h-2.5 w-full rounded-md" />
      </div>
    </div>
  );
}

export function SkeletonIndexCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border/50 p-3 min-w-52 row-span-3",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-12 rounded" />
      </div>

      <div className="w-full h-20 mb-4 flex items-center justify-center">
        <Skeleton className="w-full h-full rounded-sm" />
      </div>

      <div className="mt-auto flex flex-row items-end justify-between w-full">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-4 w-12 rounded mb-0.5" />
      </div>
    </div>
  );
}

export function SkeletonCalendarItem() {
  return (
    <div className="flex items-center gap-4 p-4 rounded border border-border">
      <div className="flex flex-col items-center min-w-15">
        <Skeleton className="h-4 w-10" />
      </div>
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-5 w-14 rounded" />
      <Skeleton className="h-4 w-4 rounded" />
    </div>
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
        <Skeleton className="h-4 w-12" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-12" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-8 rounded" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded" />
      </TableCell>
      <TableCell>
        <div className="flex justify-end pr-4">
          <Skeleton className="h-5 w-14" />
        </div>
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
        <Skeleton className="h-5 w-8 rounded" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded" />
      </TableCell>
      <TableCell>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-12 rounded" />
      </TableCell>
    </>
  );
}

/** Loading row for the admin auto-journal table (journal-asset-manager).
 *  Mirrors its 7 columns: added (date+time), symbol (symbol+name), type, price,
 *  change, status, and the right-aligned action buttons. Matches the terminal's
 *  skeleton-row loading style. */
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
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded-md" />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
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
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
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
        <Skeleton className="h-4 w-28 py-1" />
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
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
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
        <Skeleton className="h-4 w-28 py-1" />
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
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
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
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
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
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      </TableCell>
    </>
  );
}
