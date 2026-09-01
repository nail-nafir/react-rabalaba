import type { CandlestickPattern } from "../types/learn";

export const CANDLESTICK_PATTERNS: CandlestickPattern[] = [
  {
    "id": "hammer",
    "nativeName": "Kanazuchi (金槌)",
    "category": "candlestick-single",
    "bias": "bullish",
    "difficulty": "beginner",
    "winRate": 67,
    "reliability": 4,
    "svgType": "hammer"
  },
  {
    "id": "shooting-star",
    "nativeName": "Nagareboshi (流れ星)",
    "category": "candlestick-single",
    "bias": "bearish",
    "difficulty": "beginner",
    "winRate": 66,
    "reliability": 4,
    "svgType": "shooting-star"
  },
  {
    "id": "inverted-hammer",
    "nativeName": "Tohba (逆さ槌)",
    "category": "candlestick-single",
    "bias": "bullish",
    "difficulty": "intermediate",
    "winRate": 62,
    "reliability": 3,
    "svgType": "inverted-hammer"
  },
  {
    "id": "doji",
    "nativeName": "Dōji (同時)",
    "category": "candlestick-single",
    "bias": "neutral",
    "difficulty": "beginner",
    "winRate": 59,
    "reliability": 3,
    "svgType": "doji"
  },
  {
    "id": "marubozu",
    "nativeName": "Marubōzu (丸坊主)",
    "category": "candlestick-single",
    "bias": "bilateral",
    "difficulty": "beginner",
    "winRate": 71,
    "reliability": 4,
    "svgType": "marubozu"
  },
  {
    "id": "bullish-engulfing",
    "nativeName": "Tsutsumi (包み線)",
    "category": "candlestick-dual",
    "bias": "bullish",
    "difficulty": "beginner",
    "winRate": 74,
    "reliability": 5,
    "svgType": "bullish-engulfing"
  },
  {
    "id": "bearish-engulfing",
    "nativeName": "In no Tsutsumi (陰の包み)",
    "category": "candlestick-dual",
    "bias": "bearish",
    "difficulty": "beginner",
    "winRate": 73,
    "reliability": 5,
    "svgType": "bearish-engulfing"
  },
  {
    "id": "tweezer-bottom-top",
    "nativeName": "Kenuki (毛抜き)",
    "category": "candlestick-dual",
    "bias": "bilateral",
    "difficulty": "intermediate",
    "winRate": 65,
    "reliability": 4,
    "svgType": "tweezer"
  },
  {
    "id": "piercing-line",
    "nativeName": "Kirikomi / Kabuse (切り込み / 被せ)",
    "category": "candlestick-dual",
    "bias": "bilateral",
    "difficulty": "intermediate",
    "winRate": 68,
    "reliability": 4,
    "svgType": "piercing-line"
  },
  {
    "id": "morning-star",
    "nativeName": "Sansei (三星) / Akebono (明けの明星)",
    "category": "candlestick-multi",
    "bias": "bilateral",
    "difficulty": "intermediate",
    "winRate": 78,
    "reliability": 5,
    "svgType": "morning-star"
  },
  {
    "id": "three-white-soldiers",
    "nativeName": "Aka Sanpei / Kuro Sanpei (赤三兵 / 黒三兵)",
    "category": "candlestick-multi",
    "bias": "bilateral",
    "difficulty": "intermediate",
    "winRate": 76,
    "reliability": 5,
    "svgType": "three-soldiers"
  },
  {
    "id": "rising-falling-three",
    "nativeName": "Sanpō (三法)",
    "category": "candlestick-multi",
    "bias": "bilateral",
    "difficulty": "advanced",
    "winRate": 72,
    "reliability": 4,
    "svgType": "rising-three"
  }
];
