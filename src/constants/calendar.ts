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
    color: "bg-red-500",
    badge: "bg-red-500/10 text-red-500 border-red-500/20",
  },
  medium: {
    label: "Medium Impact",
    color: "bg-yellow-500",
    badge: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  },
  low: {
    label: "Low Impact",
    color: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  },
};
