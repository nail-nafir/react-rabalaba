export type PatternBias = 'bullish' | 'bearish' | 'neutral' | 'bilateral';

export type PatternCategory =
  | 'candlestick-single'
  | 'candlestick-dual'
  | 'candlestick-multi'
  | 'chart-reversal'
  | 'chart-continuation'
  | 'indicator'
  | 'smc'
  | 'risk';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export interface CandlestickPattern {
  id: string;
  nativeName?: string;
  category: 'candlestick-single' | 'candlestick-dual' | 'candlestick-multi';
  bias: PatternBias;
  difficulty: DifficultyLevel;
  winRate: number; // percentage e.g. 72
  reliability: number; // 1 to 5
  svgType: string;
}

export interface ChartPattern {
  id: string;
  category: 'chart-reversal' | 'chart-continuation';
  bias: PatternBias;
  difficulty: DifficultyLevel;
  winRate: number;
  reliability: number;
  svgType: string;
}

export interface TradingStrategy {
  id: string;
  category: 'indicators' | 'smc' | 'market-structure' | 'multi-timeframe';
  difficulty: DifficultyLevel;
  svgType: string;
}

export interface QuizOption {
  id: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  category: 'candlestick' | 'chart-pattern' | 'indicator' | 'risk' | 'smc';
  difficulty: DifficultyLevel;
  svgType: string;
  options: QuizOption[];
}

export interface RiskCalculationInputs {
  accountBalance: number;
  riskPercentage: number;
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  assetType: 'crypto' | 'stock' | 'forex';
}

export interface RiskCalculationResults {
  riskAmount: number;
  perUnitRisk: number;
  riskPercentDistance: number;
  positionSizeUnits: number;
  positionTotalValue: number;
  rewardAmount: number;
  perUnitReward: number;
  rewardPercentDistance: number;
  riskRewardRatio: number;
  isLong: boolean;
  isValid: boolean;
}
