import { Crown, Hourglass, Lock } from "lucide-react";
import type { LicenseTier } from "@/hooks/use-premium-access";

/** Per-tier badge icon + color classes (uniform bg/text/border per tier). */
export const TIER_BADGE: Record<
  LicenseTier,
  { icon: React.ElementType; className: string }
> = {
  free: {
    icon: Lock,
    className: "bg-muted/50 text-muted-foreground border-border",
  },
  trial: {
    icon: Hourglass,
    className: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  },
  premium: {
    icon: Crown,
    className: "bg-primary/10 text-primary border-primary/30",
  },
};
