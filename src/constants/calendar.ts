import type { EventImpact } from "@/types/calendar";

export const IMPACT_LEVELS: Record<
  EventImpact | "all",
  { label: string; color: string; badge: string }
> = {
  all: {
    label: "All Impact",
    color: "",
    badge: "bg-muted text-muted-foreground border-border",
  },
  high: {
    label: "High Impact",
    color: "bg-rose-500",
    badge: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  },
  medium: {
    label: "Medium Impact",
    color: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
  low: {
    label: "Low Impact",
    color: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  },
};
