import type { Accumulation, AssetType } from "@/types/asset";
import type { Outlook } from "./signals";
import type { NormalizedYahooCandle } from "@/services/adapters/yahoo-candles";
import { TIER_THRESHOLDS, ACCUMULATION } from "@/constants/signals";
import { calculateADDelta, calculateCMF, calculateMFI } from "./indicators";

/** Label that means "no directional flow read" — used to keep UI color in
 *  sync (mirrors NEUTRAL_POSITIONING_LABEL in smart-money.ts). */
export const NEUTRAL_FLOW_LABEL = "Neutral flow";

/** True when the flow read has no directional lean (color should be muted). */
export function isNeutralFlow(label: string): boolean {
  return label === NEUTRAL_FLOW_LABEL;
}

/** Asset classes whose daily volume is reliable enough for a flow read.
 *  Crypto uses smart-money (derivatives) instead; forex has no real Yahoo
 *  volume; commodity (futures roll) is too patchy to trust. */
export const ACCUMULATION_ASSET_TYPES: ReadonlySet<AssetType> = new Set([
  "id-stock",
  "us-stock",
]);

/** True when the accumulation flow-read applies to this asset class. */
export function supportsAccumulation(assetType: AssetType): boolean {
  return ACCUMULATION_ASSET_TYPES.has(assetType);
}

/**
 * Accumulation/distribution flow-read from daily OHLCV — works on any equity
 * with reliable daily volume (US & ID stocks). The Indonesian "bandarmology"
 * idea (reading who is quietly building or unwinding a position) asks the same
 * question; CMF/MFI/A-D were in fact built for equities.
 *
 * Free data has no broker summary, so flow is approximated from how price
 * closes within its range on volume, day after day:
 *  - adFlow: volume-weighted A/D over the FULL window (net flow direction).
 *  - cmf: Chaikin Money Flow, standard 20-day (recent flow).
 *  - mfi: Money Flow Index 14 (overbought/oversold of the flow itself).
 *  - upDownVolume: volume on up-closes vs down-closes (who is more eager).
 *  - spikeBias: which way price moved on unusual-volume days (z ≥ 2) — big
 *    prints have a direction.
 *
 * The composite score in [-1..1] nudges conviction modestly via
 * applyAccumulation (±MAX_CONVICTION_ADJ); it never flips a technical signal.
 * Returns null when there's not enough daily history or volume is too patchy
 * to trust (honesty over coverage). All functions pure.
 */
export function deriveAccumulation(
  dailyCandles: NormalizedYahooCandle[],
): Accumulation | null {
  const days = dailyCandles.length;
  if (days < ACCUMULATION.MIN_DAILY_CANDLES) return null;

  // Data-honesty gate: Yahoo volume is occasionally zero (halts, feed gaps —
  // common on .JK). A few are tolerable (flagged), too many make flow fiction.
  const zeroVolumeDays = dailyCandles.filter((c) => c.volume <= 0).length;
  const zeroVolumeRatio = zeroVolumeDays / days;
  if (zeroVolumeRatio > ACCUMULATION.ZERO_VOLUME_MAX_RATIO) return null;

  const highs = dailyCandles.map((c) => c.high);
  const lows = dailyCandles.map((c) => c.low);
  const closes = dailyCandles.map((c) => c.close);
  const volumes = dailyCandles.map((c) => c.volume);

  const adFlow = calculateADDelta(highs, lows, closes, volumes, days);
  const cmf = calculateCMF(
    highs,
    lows,
    closes,
    volumes,
    ACCUMULATION.CMF_PERIOD,
  );
  const mfi = calculateMFI(
    highs,
    lows,
    closes,
    volumes,
    ACCUMULATION.MFI_PERIOD,
  );
  const mfiNorm = (mfi - 50) / 50;

  // Volume balance: up day = close above the previous close.
  let upVolume = 0;
  let downVolume = 0;
  for (let i = 1; i < days; i++) {
    if (closes[i] > closes[i - 1]) upVolume += volumes[i];
    else if (closes[i] < closes[i - 1]) downVolume += volumes[i];
  }
  const totalDirVolume = upVolume + downVolume;
  const upDownVolume =
    totalDirVolume > 0 ? (upVolume - downVolume) / totalDirVolume : 0;

  // Spike bias: mean sign of the close-to-close move on volume-spike days.
  const meanVolume = volumes.reduce((s, v) => s + v, 0) / days;
  const volumeVariance =
    volumes.reduce((s, v) => s + (v - meanVolume) ** 2, 0) / days;
  const volumeStd = Math.sqrt(volumeVariance);
  let spikeBias = 0;
  if (volumeStd > 0) {
    let signSum = 0;
    let spikeCount = 0;
    for (let i = 1; i < days; i++) {
      const z = (volumes[i] - meanVolume) / volumeStd;
      if (z >= ACCUMULATION.VOLUME_Z_SPIKE) {
        signSum += Math.sign(closes[i] - closes[i - 1]);
        spikeCount += 1;
      }
    }
    if (spikeCount > 0) spikeBias = signSum / spikeCount;
  }

  const { WEIGHTS } = ACCUMULATION;
  const score = clampUnit(
    WEIGHTS.adFlow * adFlow +
      WEIGHTS.cmf * cmf +
      WEIGHTS.mfi * mfiNorm +
      WEIGHTS.upDownVolume * upDownVolume +
      WEIGHTS.spikeBias * spikeBias,
  );

  return {
    score,
    label: labelFor(score),
    // breakdown.mfi stays raw 0-100 for display; the score used mfiNorm.
    breakdown: { adFlow, cmf, mfi, upDownVolume, spikeBias },
    daysAnalyzed: days,
    reliable: zeroVolumeDays === 0,
  };
}

function labelFor(score: number): string {
  const { SCORE_THRESHOLD, STRONG_THRESHOLD } = ACCUMULATION;
  if (score >= STRONG_THRESHOLD) return "Strong accumulation";
  if (score >= SCORE_THRESHOLD) return "Accumulation";
  if (score <= -STRONG_THRESHOLD) return "Strong distribution";
  if (score <= -SCORE_THRESHOLD) return "Distribution";
  return NEUTRAL_FLOW_LABEL;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function tierFor(strength: number): Outlook["tier"] {
  if (strength >= TIER_THRESHOLDS.A) return "A";
  if (strength >= TIER_THRESHOLDS.B) return "B";
  return "C";
}

function alignmentFor(strength: number): Outlook["technicalAlignment"] {
  if (strength >= TIER_THRESHOLDS.A) return "strong";
  if (strength >= TIER_THRESHOLDS.B) return "moderate";
  return "weak";
}

/**
 * Nudge a signal's conviction by how much the accumulation flow agrees with
 * its direction (bounded to ±MAX_CONVICTION_ADJ). Flow that supports the
 * trade boosts it; flow that opposes it dampens it and adds a note. Never
 * flips the signal. Returns a NEW outlook (mirrors applySmartMoney).
 */
export function applyAccumulation(
  outlook: Outlook,
  acc: Accumulation,
): Outlook {
  if (outlook.signal === "neutral") return outlook;

  const dir = outlook.signal === "long" ? 1 : -1;
  // agreement ∈ [-1..1]: + when the flow supports the signal, − when against.
  const agreement =
    Math.sign(acc.score) === dir ? Math.abs(acc.score) : -Math.abs(acc.score);
  if (agreement === 0) return outlook;

  const factor = 1 + agreement * ACCUMULATION.MAX_CONVICTION_ADJ;
  const directionScore = clampUnit(outlook.directionScore * factor);
  const strength = Math.max(
    0,
    Math.min(100, Math.round(outlook.strength * factor)),
  );

  const note =
    agreement > 0
      ? `Accumulation flow: ${acc.label} supports this ${outlook.signal.toUpperCase()} — conviction nudged up.`
      : `Accumulation flow: ${acc.label} opposes this ${outlook.signal.toUpperCase()} — conviction dampened.`;

  return {
    ...outlook,
    directionScore,
    strength,
    tier: tierFor(strength),
    technicalAlignment: alignmentFor(strength),
    reasons: {
      ...outlook.reasons,
      warnings: [...outlook.reasons.warnings, note],
    },
  };
}
