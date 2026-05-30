/**
 * Shared layout formatting utilities.
 */

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

/**
 * Formats a Unix timestamp into a standard readable date string.
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Formats a Unix timestamp with time for intraday candles.
 * Uses the viewer's local timezone so hover labels match the user's clock.
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
}
