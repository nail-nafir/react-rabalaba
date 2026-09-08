/**
 * Generates an emoji flag from a 2-letter ISO country code.
 */
export function getEmojiFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌐";

  // Special cases for codes like EU or GLOBAL
  if (countryCode === "EU") return "🇪🇺";
  if (countryCode === "UK") countryCode = "GB"; // Yahoo sometimes uses UK

  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));

  try {
    return String.fromCodePoint(...codePoints);
  } catch {
    return "🌐";
  }
}

/**
 * Returns localized country name from a 2-letter ISO country code using standard Intl.DisplayNames.
 */
export function getCountryName(countryCode: string, lang = "id"): string {
  if (!countryCode) return "";
  if (countryCode === "EU") return lang === "id" ? "Uni Eropa" : "European Union";
  const normalized = countryCode === "UK" ? "GB" : countryCode;

  try {
    const displayNames = new Intl.DisplayNames([lang === "id" ? "id-ID" : "en-US", "en"], {
      type: "region",
    });
    return displayNames.of(normalized.toUpperCase()) || countryCode;
  } catch {
    return countryCode;
  }
}

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: "USD",
  EU: "EUR",
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  IE: "EUR",
  FI: "EUR",
  PT: "EUR",
  GR: "EUR",
  GB: "GBP",
  UK: "GBP",
  JP: "JPY",
  ID: "IDR",
  AU: "AUD",
  CN: "CNY",
  CA: "CAD",
  CH: "CHF",
  NZ: "NZD",
  SG: "SGD",
  HK: "HKD",
  KR: "KRW",
  IN: "INR",
  BR: "BRL",
  MX: "MXN",
  ZA: "ZAR",
  RU: "RUB",
  TR: "TRY",
  SE: "SEK",
  NO: "NOK",
};

/**
 * Returns 3-letter currency code for a country (e.g. US -> USD, EU -> EUR).
 * Falls back to countryCode if no specific mapping exists.
 */
export function getCurrencyCode(countryCode: string): string {
  if (!countryCode) return "";
  const upper = countryCode.toUpperCase();
  return COUNTRY_TO_CURRENCY[upper] || upper;
}

/**
 * Returns localized currency name from a 3-letter currency code using standard Intl.DisplayNames.
 */
export function getCurrencyName(currencyCode: string, lang = "id"): string {
  if (!currencyCode) return "";
  try {
    const displayNames = new Intl.DisplayNames(
      [lang === "id" ? "id-ID" : "en-US", "en"],
      { type: "currency" },
    );
    return displayNames.of(currencyCode.toUpperCase()) || currencyCode;
  } catch {
    return currencyCode;
  }
}

