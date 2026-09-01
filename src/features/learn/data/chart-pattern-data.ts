import type { ChartPattern } from "../types/learn";

export const CHART_PATTERNS: ChartPattern[] = [
  {
    "id": "head-and-shoulders",
    "category": "chart-reversal",
    "bias": "bearish",
    "difficulty": "intermediate",
    "winRate": 81,
    "reliability": 5,
    "svgType": "head-and-shoulders"
  },
  {
    "id": "inverse-head-and-shoulders",
    "category": "chart-reversal",
    "bias": "bullish",
    "difficulty": "intermediate",
    "winRate": 83,
    "reliability": 5,
    "svgType": "inverse-head-and-shoulders"
  },
  {
    "id": "double-top",
    "category": "chart-reversal",
    "bias": "bearish",
    "difficulty": "beginner",
    "winRate": 75,
    "reliability": 4,
    "svgType": "double-top"
  },
  {
    "id": "double-bottom",
    "category": "chart-reversal",
    "bias": "bullish",
    "difficulty": "beginner",
    "winRate": 77,
    "reliability": 4,
    "svgType": "double-bottom"
  },
  {
    "id": "cup-and-handle",
    "category": "chart-continuation",
    "bias": "bullish",
    "difficulty": "intermediate",
    "winRate": 79,
    "reliability": 5,
    "svgType": "cup-and-handle"
  },
  {
    "id": "bull-flag",
    "category": "chart-continuation",
    "bias": "bullish",
    "difficulty": "beginner",
    "winRate": 82,
    "reliability": 5,
    "svgType": "bull-flag"
  },
  {
    "id": "bear-flag",
    "category": "chart-continuation",
    "bias": "bearish",
    "difficulty": "beginner",
    "winRate": 80,
    "reliability": 5,
    "svgType": "bear-flag"
  },
  {
    "id": "ascending-triangle",
    "category": "chart-continuation",
    "bias": "bullish",
    "difficulty": "intermediate",
    "winRate": 76,
    "reliability": 4,
    "svgType": "ascending-triangle"
  },
  {
    "id": "descending-triangle",
    "category": "chart-continuation",
    "bias": "bearish",
    "difficulty": "intermediate",
    "winRate": 74,
    "reliability": 4,
    "svgType": "descending-triangle"
  },
  {
    "id": "falling-wedge",
    "category": "chart-reversal",
    "bias": "bullish",
    "difficulty": "intermediate",
    "winRate": 75,
    "reliability": 4,
    "svgType": "falling-wedge"
  }
];
