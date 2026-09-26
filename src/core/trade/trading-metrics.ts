export type TradingMetricsInput = {
  entry: number;
  stopLoss: number;
  target: number;
  riskBudget?: number;
};

export function calculateTradingMetrics({
  entry,
  stopLoss,
  target,
  riskBudget = 0,
}: TradingMetricsInput) {
  const validPrices = [entry, stopLoss, target].every(
    (value) => Number.isFinite(value) && value > 0,
  );
  const stopDistance = validPrices ? Math.abs(entry - stopLoss) : 0;
  const targetDistance = validPrices ? Math.abs(target - entry) : 0;
  const isLong = validPrices && target >= entry && stopLoss < entry;
  const isShort = validPrices && target <= entry && stopLoss > entry;
  const isValidSetup =
    stopDistance > 0 &&
    ((stopLoss < entry && target > entry) ||
      (stopLoss > entry && target < entry));
  const riskRewardRatio =
    stopDistance > 0 ? targetDistance / stopDistance : 0;
  const positionUnits =
    stopDistance > 0 && Number.isFinite(riskBudget) && riskBudget > 0
      ? riskBudget / stopDistance
      : 0;

  return {
    isLong,
    isShort,
    isValidSetup,
    stopDistance,
    targetDistance,
    stopPercentDistance:
      validPrices && entry > 0 ? (stopDistance / entry) * 100 : 0,
    targetPercentDistance:
      validPrices && entry > 0 ? (targetDistance / entry) * 100 : 0,
    riskRewardRatio,
    breakevenWinrate:
      riskRewardRatio > 0 ? (1 / (1 + riskRewardRatio)) * 100 : 50,
    positionUnits,
    totalPositionValue: positionUnits * (validPrices ? entry : 0),
    potentialReward: positionUnits * targetDistance,
  };
}
