import type { TradingPlan, AssetType } from "@/types/asset";
import type { Outlook } from "@/features/signals/engine/signal-engine";
import { formatPrice, formatRatio } from "@/lib/formatters";

/**
 * Build a clean, copy-pasteable text summary of the trade setup.
 * Pure (no DOM) so it stays unit-testable.
 */
export function buildSignalText(
  symbol: string,
  outlook: Outlook,
  plan: TradingPlan,
  assetType: AssetType,
): string {
  const fp = (p: number) => formatPrice(p, assetType);
  const lines = [
    `${symbol} · ${outlook.signal.toUpperCase()} (${Math.round(outlook.strength)}%) · R:R 1:${formatRatio(plan.riskRewardRatio)}`,
    `Entry: ${fp(plan.entry)}`,
    `SL: ${fp(plan.stopLoss)}`,
    `TP1: ${fp(plan.takeProfit1)}`,
    `TP2: ${fp(plan.takeProfit2)}`,
  ];
  if (typeof plan.takeProfit3 === "number") {
    lines.push(`TP3: ${fp(plan.takeProfit3)}`);
  }
  lines.push("", "Not financial advice. DYOR.");
  return lines.join("\n");
}
