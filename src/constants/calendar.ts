import { BADGE, type BadgeColor } from "@/constants/taxonomy/palette";
import type { EventImpact } from "@/types/calendar";

export const IMPACT_LEVELS: Record<
  EventImpact | "all",
  {
    label: string;
    labelKey: string;
    color: string;
    badge: string;
    badgeColor: BadgeColor;
  }
> = {
  all: {
    label: "All Impact",
    labelKey: "calendar.impact.all",
    color: "",
    badge: `${BADGE.neutral.bg} ${BADGE.neutral.text} ${BADGE.neutral.border}`,
    badgeColor: BADGE.neutral,
  },
  high: {
    label: "High Impact",
    labelKey: "calendar.impact.high",
    color: "bg-rose-500",
    badge: `${BADGE.negative.bg} ${BADGE.negative.text} ${BADGE.negative.border}`,
    badgeColor: BADGE.negative,
  },
  medium: {
    label: "Medium Impact",
    labelKey: "calendar.impact.medium",
    color: "bg-amber-500",
    badge: `${BADGE.warning.bg} ${BADGE.warning.text} ${BADGE.warning.border}`,
    badgeColor: BADGE.warning,
  },
  low: {
    label: "Low Impact",
    labelKey: "calendar.impact.low",
    color: "bg-emerald-500",
    badge: `${BADGE.positive.bg} ${BADGE.positive.text} ${BADGE.positive.border}`,
    badgeColor: BADGE.positive,
  },
};
