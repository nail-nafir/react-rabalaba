/**
 * Shared layout formatting utilities.
 */

/**
 * Format a Date object as YYYY-MM-DD in local time.
 */
export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Formats asset prices beautifully with dynamic decimal adjustment.
 * Handles Indonesian stocks in Rupiah and international assets in USD.
 * Dynamically scales decimal places for tiny assets (like SHIB or DOGE) to avoid rounding to 0.
 */
export function formatPrice(price: number, assetType?: string): string {
  if (assetType === "id-stock") {
    return `Rp${price.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
  }
  if (price === 0) return "$0.00";
  if (price < 1) {
    const leadingZeros = Math.max(0, -Math.floor(Math.log10(price)) - 1);
    const decimals = Math.min(10, leadingZeros + 4);
    return `$${price.toFixed(decimals)}`;
  }
  if (price < 100) return `$${price.toFixed(2)}`;
  return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/**
 * Formats a risk:reward style ratio, dropping trailing zeros (2.00 -> "2",
 * 1.75 -> "1.75", 2.50 -> "2.5").
 */
export function formatRatio(value: number): string {
  return parseFloat(value.toFixed(2)).toString();
}

/**
 * Formats transaction volume into a clean, human-readable abbreviation (K, M, B, T).
 */
export function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000_000)
    return `${(vol / 1_000_000_000_000).toFixed(1)}T`;
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(1)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toString();
}

/** Numeric day/month (e.g. "01/06"); order follows the given locale. */
export function formatDayMonth(timestamp: number, locale?: string): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
}

/** Locale-aware full date, e.g. "1 Juni 2026" (id) / "June 1, 2026" (en). */
export function formatDateFull(timestamp: number, locale?: string): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Clock time HH:MM (24h, local), e.g. "05:46". */
export function formatClock(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}
