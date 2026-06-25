/**
 * Bilingual DB content helper. Copy that moved from i18n into Supabase (subscription
 * plans, payment notes, disclaimer clauses) is stored as a localized JSONB map —
 * `{ en: ..., id: ... }` — instead of two i18n files. `pickLocale` resolves the
 * ACTIVE i18n language to the right value with a graceful fallback chain so a
 * missing translation never renders blank.
 *
 * Read the active language from `i18n.language` (react-i18next) at the call site,
 * e.g. `pickLocale(plan.name, i18n.language, "")`.
 */

/** A `{ en, id }` map of localized values (string, or string[] for lists). */
export type Localized<T = string> = Record<string, T>;

/** Order tried after the requested language + its base before giving up. */
const FALLBACK_LANGS = ["id", "en"];

/**
 * Resolve `value[lang]`, falling back: exact lang → base lang (`en-US`→`en`) →
 * id → en → first present value → `fallback`. Returns `fallback` for a
 * null/non-object input so callers can pass a safe default (e.g. `""` or `[]`).
 */
export function pickLocale<T>(
  value: Localized<T> | null | undefined,
  lang: string,
  fallback?: T,
): T | undefined {
  if (!value || typeof value !== "object") return fallback;
  const base = lang.split("-")[0];
  if (value[lang] != null) return value[lang];
  if (value[base] != null) return value[base];
  for (const key of FALLBACK_LANGS) {
    if (value[key] != null) return value[key];
  }
  const first = Object.values(value)[0];
  return first != null ? first : fallback;
}
