import type { TradingStrategy } from "../types/learn";

export const TRADING_STRATEGIES: TradingStrategy[] = [
  {
    "id": "moving-average-cross",
    "category": "indicators",
    "difficulty": "beginner",
    "svgType": "ema-strategy"
  },
  {
    "id": "rsi-divergence-mastery",
    "category": "indicators",
    "difficulty": "intermediate",
    "svgType": "rsi-divergence"
  },
  {
    "id": "bollinger-squeeze-breakout",
    "category": "indicators",
    "difficulty": "intermediate",
    "svgType": "bollinger-strategy"
  },
  {
    "id": "smc-market-structure",
    "category": "smc",
    "difficulty": "advanced",
    "svgType": "smc-strategy"
  },
  {
    "id": "atr-dynamic-risk",
    "category": "market-structure",
    "difficulty": "beginner",
    "svgType": "atr-strategy"
  },
  {
    "id": "multi-timeframe-framework",
    "category": "multi-timeframe",
    "difficulty": "intermediate",
    "svgType": "mtf-strategy"
  }
];
