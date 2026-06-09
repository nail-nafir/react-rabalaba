/**
 * Sentiment engine — Fear & Greed (alternative.me) context.
 *
 * Sentiment is deliberately NOT scored into directionScore: the F&G index is
 * lagging and crypto-heavy, so folding it into the technical score would add
 * noise and false precision. Instead it is surfaced two ways:
 *  - as a human-readable narrative (`generateSentimentAnalysis`), and
 *  - as a contextual risk warning at extremes that lean against the setup
 *    (`fearGreedContextWarning`), so users get the context for risk management.
 *
 * All functions are pure and have no dependency on the technical indicators,
 * which keeps this concern isolated and trivially testable.
 */

/** Net direction the score is leaning (sign of the regime-weighted score). */
export type SentimentBias = "bullish" | "bearish" | "neutral";

/** Fear & Greed extremes used for the contextual warning. */
const EXTREME_FEAR = 20;
const EXTREME_GREED = 80;

/**
 * A risk-management warning when sentiment is at an extreme that leans against
 * the current directional lean (extreme fear under a bearish lean → downside may
 * be limited; extreme greed under a bullish lean → mean-reversion risk). Returns
 * null when sentiment is unavailable, not extreme, or aligned with the lean.
 *
 * Behavior is identical to the inline F&G block previously in `computeSignal`:
 * it only fires when the score actually leans in the dangerous direction.
 */
export function fearGreedContextWarning(
  fearGreedValue: number | undefined | null,
  directionScore: number,
): string | null {
  if (fearGreedValue === undefined || fearGreedValue === null) return null;

  if (fearGreedValue <= EXTREME_FEAR && directionScore < 0) {
    return `Extreme Fear (F&G: ${fearGreedValue}) — oversold sentiment may limit further downside`;
  }
  if (fearGreedValue >= EXTREME_GREED && directionScore > 0) {
    return `Extreme Greed (F&G: ${fearGreedValue}) — elevated risk of mean reversion pullback`;
  }
  return null;
}

/**
 * Human-readable sentiment narrative for the detail dialog. Maps the F&G index
 * (0-100) into a qualitative band with an actionable note. Unchanged from the
 * previous inline implementation.
 */
export function generateSentimentAnalysis(fearGreed?: number): string {
  if (fearGreed === undefined || fearGreed === null)
    return "Market sentiment data unavailable. Consider external indicators for sentiment confirmation.";
  if (fearGreed <= 20)
    return `Fear & Greed Index at ${fearGreed} (Extreme Fear). Market may be approaching a contrarian buy opportunity.`;
  if (fearGreed <= 40)
    return `Fear & Greed Index at ${fearGreed} (Fear). Cautious market conditions. Watch for capitulation or reversal signals.`;
  if (fearGreed <= 60)
    return `Fear & Greed Index at ${fearGreed} (Neutral). Balanced market sentiment. Follow technical signals for direction.`;
  if (fearGreed <= 80)
    return `Fear & Greed Index at ${fearGreed} (Greed). Optimistic market. Trend may continue but watch for overextension.`;
  return `Fear & Greed Index at ${fearGreed} (Extreme Greed). Elevated risk of pullback. Consider tightening stops.`;
}
