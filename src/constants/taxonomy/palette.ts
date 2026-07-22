/**
 * Semantic color tokens — the single source for every status/direction hue in
 * the app. A "token" carries the representations the UI actually needs so a
 * domain map (signal, tier, risk, regime, …) never re-types emerald/rose/amber:
 *  - `bg` / `border` / `text` → the Tailwind triplet for a tinted badge/pill
 *    (`text` is the on-tint -400 shade every badge uses today)
 *  - `textStrong` → surface-aware inline emphasis (light 600 / dark 400) for
 *    P&L text that sits on the page background, not on a tint
 *  - `fill` → CSS custom-property string for recharts <Pie>/<Bar> fills
 * Change a hue once here and it propagates to badges, inline text AND charts.
 *
 * Everything here is plain object literals + property reads (no function calls),
 * so esbuild can tree-shake the color maps out of the pure auto-journal edge
 * bundle, which only ever pulls the value arrays from the taxonomy.
 */
export interface ColorToken {
  bg: string;
  border: string;
  text: string;
  textStrong: string;
  fill: string;
}

export const PALETTE = {
  positive: {
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    textStrong: "text-emerald-600 dark:text-emerald-400",
    fill: "var(--color-emerald-400)",
  },
  negative: {
    bg: "bg-rose-500/15",
    border: "border-rose-500/30",
    text: "text-rose-400",
    textStrong: "text-rose-600 dark:text-rose-400",
    fill: "var(--color-rose-400)",
  },
  warning: {
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    text: "text-amber-400",
    textStrong: "text-amber-600 dark:text-amber-400",
    fill: "var(--color-amber-400)",
  },
  neutral: {
    bg: "bg-muted-foreground/15",
    border: "border-muted-foreground/30",
    text: "text-muted-foreground",
    textStrong: "text-muted-foreground",
    fill: "var(--color-zinc-400)",
  },
  accent: {
    bg: "bg-primary/15",
    border: "border-primary/30",
    text: "text-primary",
    textStrong: "text-primary",
    fill: "var(--color-primary)",
  },
} satisfies Record<string, ColorToken>;

export type PaletteTone = keyof typeof PALETTE;

/** The {bg,text,border} shape badge consumers expect (`cn(c.bg, c.text, c.border)`). */
export interface BadgeColor {
  bg: string;
  text: string;
  border: string;
}

/** Pre-built badge triplet per tone — referenced (not computed) by the domain
 *  color maps so they stay tree-shakeable plain literals. */
export const BADGE = {
  positive: {
    bg: PALETTE.positive.bg,
    text: PALETTE.positive.text,
    border: PALETTE.positive.border,
  },
  negative: {
    bg: PALETTE.negative.bg,
    text: PALETTE.negative.text,
    border: PALETTE.negative.border,
  },
  warning: {
    bg: PALETTE.warning.bg,
    text: PALETTE.warning.text,
    border: PALETTE.warning.border,
  },
  neutral: {
    bg: PALETTE.neutral.bg,
    text: PALETTE.neutral.text,
    border: PALETTE.neutral.border,
  },
  accent: {
    bg: PALETTE.accent.bg,
    text: PALETTE.accent.text,
    border: PALETTE.accent.border,
  },
} satisfies Record<PaletteTone, BadgeColor>;

/** Join a badge triplet into a single className string (for inline ternaries
 *  that want one string rather than spreading bg/text/border). */
export const badgeClass = (c: BadgeColor): string =>
  `${c.bg} ${c.text} ${c.border}`;
