import { cn } from "@/lib/utils";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  lottie?: string;
}

export function EmptyState({
  title = "No results found",
  description = "Try adjusting your filters or search query.",
  icon,
  action,
  className,
  lottie = "/animations/empty.lottie",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
          {icon}
        </div>
      ) : (
        <DotLottieReact
          src={lottie}
          className="mb-4 size-28"
          loop
          autoplay
        />
      )}
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
