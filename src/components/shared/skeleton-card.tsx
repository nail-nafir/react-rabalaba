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
        "flex flex-col rounded-xl border border-border/50 p-3 min-w-50 h-45",
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

export function SkeletonTableRow() {
  return (
    <>
      <TableCell>
        <Skeleton className="h-4 w-4" />
      </TableCell>
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
