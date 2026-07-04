/**
 * Localizable analysis descriptor — the engine emits a {@link AnalysisText}
 * (an i18n key plus interpolation params) instead of a pre-formatted English
 * sentence, so the detail dialog can render the narrative in the ACTIVE
 * language. This keeps the signal engine pure (no i18n dependency, still
 * trivially testable in Node) and makes the analysis copy switch instantly with
 * the language toggle instead of being baked in at fetch time.
 *
 * Sub-phrases that are themselves translatable (e.g. "strong" trend strength,
 * "overbought" RSI) are passed as `{ tkey }` params; the render layer
 * ({@link resolveAnalysisText}) translates them in the active language before
 * interpolating, mirroring the nested-`t()` pattern already used across the
 * detail dialog (see `dialog.crypto_context_desc`).
 */

import type { TFunction } from "i18next";

/** An interpolation value: a literal string/number, or a translatable sub-key. */
export type AnalysisParam = string | number | { tkey: string };

/** An i18n key under the `analysis.*` namespace plus its interpolation params. */
export interface AnalysisText {
  key: string;
  params?: Record<string, AnalysisParam>;
}

/**
 * Translate an {@link AnalysisText} in the active language. `{ tkey }` params are
 * resolved with `t()` first, then interpolated into the main key.
 */
export function resolveAnalysisText(t: TFunction, text: AnalysisText): string {
  if (!text.params) return t(text.key);
  const resolved: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(text.params)) {
    resolved[name] =
      value !== null && typeof value === "object" && "tkey" in value
        ? t(value.tkey)
        : value;
  }
  return t(text.key, resolved);
}
