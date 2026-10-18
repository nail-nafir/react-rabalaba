import { BADGE, type BadgeColor } from '@/constants/taxonomy/palette';

export type PatternBias = 'bullish' | 'bearish' | 'neutral' | 'bilateral';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export const BIAS_COLORS: Record<PatternBias, BadgeColor> = {
  bullish: BADGE.positive,
  bearish: BADGE.negative,
  neutral: BADGE.neutral,
  bilateral: BADGE.warning,
};

export const DIFFICULTY_COLORS: Record<DifficultyLevel, BadgeColor> = {
  beginner: BADGE.positive,
  intermediate: BADGE.warning,
  advanced: BADGE.negative,
};

export interface CandlestickPattern {
  id: string;
  nativeName?: string;
  category: 'candlestick_single' | 'candlestick_dual' | 'candlestick_multi';
  bias: PatternBias;
  difficulty: DifficultyLevel;
  svgType: string;
}

export interface ChartPattern {
  id: string;
  category: 'chart_reversal' | 'chart_continuation';
  bias: PatternBias;
  difficulty: DifficultyLevel;
  svgType: string;
}

export interface TradingStrategy {
  id: string;
  category: 'indicators' | 'smc' | 'market_structure' | 'multi_timeframe';
  difficulty: DifficultyLevel;
  svgType: string;
}

export interface QuizOption {
  id: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  category: 'candlestick' | 'chart_pattern' | 'indicator' | 'risk' | 'smc';
  difficulty: DifficultyLevel;
  svgType: string;
  options: QuizOption[];
}
