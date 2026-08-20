import type { TFunction } from "i18next";
import type { AnalysisText } from "@/types/engine";

/** Translate an engine analysis descriptor in the active UI language. */
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
