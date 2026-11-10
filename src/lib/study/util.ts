import type { L10n, Lang } from "./types";

export const uid = (prefix = "") => `${prefix}${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;

/** Text in the participant's language, falling back to the other language. */
export const tx = (t: L10n | undefined, lang: Lang) => (t ? t[lang] || t[lang === "ar" ? "en" : "ar"] || "" : "");

/** Seeded shuffle, so a participant sees the same order after a refresh. */
export function shuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A safe export variable name: letters, digits and underscores, starting with a letter. */
export function variableName(s: string) {
  const v = s
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return /^[a-z]/.test(v) ? v : `q_${v}`;
}

export const money = (n: number, currency: string, lang: Lang) =>
  new Intl.NumberFormat(lang === "ar" ? "ar-BH" : "en-BH", { style: "currency", currency, minimumFractionDigits: currency === "BHD" || currency === "KWD" || currency === "OMR" ? 3 : 2 }).format(n);
