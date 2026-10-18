import type { QuizQuestion } from "../types/learn";

const LETTERS = ["a", "b", "c", "d"] as const;

type QuizRow = Omit<QuizQuestion, "options"> & {
  answer: (typeof LETTERS)[number];
};

// Option copy lives at learn.quiz.questions.<id>.options.q<N>_<letter>.
const ROWS: QuizRow[] = [
  { id: "quiz_1", category: "candlestick", difficulty: "beginner", svgType: "hammer", answer: "b" },
  { id: "quiz_2", category: "chart_pattern", difficulty: "intermediate", svgType: "head_and_shoulders", answer: "b" },
  { id: "quiz_3", category: "indicator", difficulty: "intermediate", svgType: "rsi_divergence", answer: "b" },
  { id: "quiz_4", category: "risk", difficulty: "beginner", svgType: "atr_strategy", answer: "b" },
  { id: "quiz_5", category: "smc", difficulty: "advanced", svgType: "smc_strategy", answer: "b" },
  { id: "quiz_6", category: "candlestick", difficulty: "intermediate", svgType: "shooting_star", answer: "b" },
  { id: "quiz_7", category: "candlestick", difficulty: "beginner", svgType: "bullish_engulfing", answer: "b" },
  { id: "quiz_8", category: "chart_pattern", difficulty: "beginner", svgType: "double_bottom", answer: "b" },
  { id: "quiz_9", category: "chart_pattern", difficulty: "intermediate", svgType: "bull_flag", answer: "a" },
  { id: "quiz_10", category: "chart_pattern", difficulty: "intermediate", svgType: "ascending_triangle", answer: "b" },
  { id: "quiz_11", category: "indicator", difficulty: "intermediate", svgType: "bollinger_strategy", answer: "b" },
  { id: "quiz_12", category: "smc", difficulty: "advanced", svgType: "mtf_strategy", answer: "a" },
  { id: "quiz_13", category: "candlestick", difficulty: "beginner", svgType: "morning_star", answer: "b" },
  { id: "quiz_14", category: "chart_pattern", difficulty: "intermediate", svgType: "cup_and_handle", answer: "c" },
  { id: "quiz_15", category: "indicator", difficulty: "beginner", svgType: "ema_strategy", answer: "a" },
  { id: "quiz_16", category: "chart_pattern", difficulty: "intermediate", svgType: "falling_wedge", answer: "b" },
  { id: "quiz_17", category: "candlestick", difficulty: "intermediate", svgType: "tweezer", answer: "c" },
  { id: "quiz_18", category: "smc", difficulty: "advanced", svgType: "smc_strategy", answer: "a" },
  { id: "quiz_19", category: "chart_pattern", difficulty: "intermediate", svgType: "rising_wedge", answer: "b" },
  { id: "quiz_20", category: "chart_pattern", difficulty: "advanced", svgType: "triple_bottom", answer: "a" },
  { id: "quiz_21", category: "chart_pattern", difficulty: "intermediate", svgType: "symmetrical_triangle", answer: "c" },
  { id: "quiz_22", category: "candlestick", difficulty: "intermediate", svgType: "evening_star", answer: "b" },
  { id: "quiz_23", category: "candlestick", difficulty: "intermediate", svgType: "dark_cloud_cover", answer: "b" },
  { id: "quiz_24", category: "candlestick", difficulty: "intermediate", svgType: "bullish_harami", answer: "a" },
  { id: "quiz_25", category: "indicator", difficulty: "intermediate", svgType: "macd_strategy", answer: "b" },
  { id: "quiz_26", category: "indicator", difficulty: "intermediate", svgType: "stochastic_strategy", answer: "c" },
  { id: "quiz_27", category: "smc", difficulty: "advanced", svgType: "liquidity_sweep_strategy", answer: "b" },
  { id: "quiz_28", category: "smc", difficulty: "advanced", svgType: "order_block_strategy", answer: "b" },
  { id: "quiz_29", category: "smc", difficulty: "advanced", svgType: "fvg_strategy", answer: "a" },
  { id: "quiz_30", category: "smc", difficulty: "intermediate", svgType: "premium_discount_strategy", answer: "b" },
  { id: "quiz_31", category: "risk", difficulty: "beginner", svgType: "atr_strategy", answer: "b" },
  { id: "quiz_32", category: "risk", difficulty: "beginner", svgType: "expectancy_strategy", answer: "b" },
  { id: "quiz_33", category: "risk", difficulty: "beginner", svgType: "expectancy_strategy", answer: "b" },
  { id: "quiz_34", category: "risk", difficulty: "intermediate", svgType: "trading_cost_strategy", answer: "b" },
];

export const QUIZ_QUESTIONS: QuizQuestion[] = ROWS.map(({ answer, ...question }) => ({
  ...question,
  options: LETTERS.map((letter) => ({
    id: `${question.id.replace("quiz_", "q")}_${letter}`,
    isCorrect: letter === answer,
  })),
}));
