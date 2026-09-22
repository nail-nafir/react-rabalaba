import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border-dashed p-6 text-center text-balance",
        className
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn("flex max-w-sm flex-col items-center gap-2", className)}
      {...props}
    />
  )
}

const emptyMediaVariants = cva(
  "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-title"
      className={cn(
        "font-heading text-sm font-medium tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        "text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  )
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        "flex w-full max-w-sm min-w-0 flex-col items-center gap-2.5 text-sm text-balance",
        "[&>[data-slot=button][data-variant=default]]:h-9 [&>[data-slot=button][data-variant=default]]:min-h-9 [&>[data-slot=button][data-variant=default]]:rounded-lg [&>[data-slot=button][data-variant=default]]:px-2.5 [&>[data-slot=button][data-variant=default]]:gap-1.5 [&>[data-slot=button][data-variant=default]]:text-xs [&>[data-slot=button][data-variant=default]]:font-bold [&>[data-slot=button][data-variant=default]]:tracking-tight [&>[data-slot=button][data-variant=default]]:transition-all [&>[data-slot=button][data-variant=default]]:cursor-pointer",
        "[&>[data-slot=button][data-variant=secondary]]:h-9 [&>[data-slot=button][data-variant=secondary]]:min-h-9 [&>[data-slot=button][data-variant=secondary]]:rounded-lg [&>[data-slot=button][data-variant=secondary]]:px-2.5 [&>[data-slot=button][data-variant=secondary]]:gap-1.5 [&>[data-slot=button][data-variant=secondary]]:text-xs [&>[data-slot=button][data-variant=secondary]]:font-bold [&>[data-slot=button][data-variant=secondary]]:tracking-tight [&>[data-slot=button][data-variant=secondary]]:transition-all [&>[data-slot=button][data-variant=secondary]]:cursor-pointer",
        "[&>a]:h-9 [&>a]:min-h-9 [&>a]:rounded-lg [&>a]:px-2.5 [&>a]:gap-1.5 [&>a]:text-xs [&>a]:font-bold [&>a]:tracking-tight [&>a]:transition-all [&>a]:cursor-pointer",
        className
      )}
      {...props}
    />
  )
}

export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
}
