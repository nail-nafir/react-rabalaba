/**
 * Risk level — low → high. Value list is the source; the badge colors live in
 * ./colors (RISK_COLORS) and the confidence cutoffs that ASSIGN a level
 * (numeric, RISK_RULES) in constants/signals.ts.
 */
export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];
