import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  variant?: "default" | "dialog";
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  variant = "default",
}: EmptyStateProps) {
  const isDialog = variant === "dialog";

  const displayTitle = title ?? (isDialog ? undefined : "Nothing here yet");
  const displayDescription =
    description ??
    (isDialog
      ? undefined
      : "Try tweaking your filters or changing your search query.");

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        isDialog ? "min-h-[224px] py-6 sm:py-8" : "py-16",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center text-muted-foreground",
          isDialog
            ? "mb-5 h-14 w-14 rounded-xl border border-border bg-muted"
            : "mb-6 h-28 w-28 rounded-3xl border border-border/50 bg-muted/20",
        )}
      >
        {icon ?? (
          <Inbox
            className={isDialog ? "h-6 w-6" : "h-14 w-14 text-muted-foreground"}
          />
        )}
      </div>
      {displayTitle && (
        <h3 className="text-sm font-medium text-foreground">{displayTitle}</h3>
      )}
      {displayDescription && (
        <p
          className={cn(
            "text-muted-foreground max-w-sm text-sm",
            isDialog ? "" : "mt-2",
          )}
        >
          {displayDescription}
        </p>
      )}
      {action && <div className={cn(isDialog ? "mt-5" : "mt-4")}>{action}</div>}
    </div>
  );
}
