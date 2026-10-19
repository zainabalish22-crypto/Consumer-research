import type { Language, LocalizedText } from "./schema";

/** Resolve localized study text, falling back to the other language when empty. */
export function lt(text: LocalizedText | undefined, lang: Language, fallback?: Language): string {
  if (!text) return "";
  const primary = text[lang]?.trim();
  if (primary) return text[lang]!;
  if (fallback && text[fallback]?.trim()) return text[fallback]!;
  return "";
}

/** True when a localized text is missing a translation for one of the study languages. */
export function missingLanguages(text: LocalizedText | undefined, langs: readonly Language[]): Language[] {
  return langs.filter((l) => !text?.[l]?.trim());
}

export const dirFor = (lang: Language) => (lang === "ar" ? "rtl" : "ltr");
