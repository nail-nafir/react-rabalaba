import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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
    .map(char => 127397 + char.charCodeAt(0));
    
  try {
    return String.fromCodePoint(...codePoints);
  } catch {
    return "🌐";
  }
}
