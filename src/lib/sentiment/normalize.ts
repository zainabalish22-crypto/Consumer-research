/**
 * Reading the researcher's own sentiment labels. The tool does not classify text: it only
 * recognises the label a human already gave, in its common spellings in Arabic and English,
 * or a number from -1 to 1. Anything it does not recognise is reported for the researcher to
 * map by hand; it is never guessed.
 */
export type Sentiment = "positive" | "negative" | "neutral";

/** Arabic text compared without diacritics, tatweel, or hamza and ta-marbuta variants. */
export function fold(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

const WORDS: Record<Sentiment, string[]> = {
  positive: ["positive", "pos", "+", "ايجابي", "ايجابيه", "موجب", "موجبه", "ايجابى"],
  negative: ["negative", "neg", "-", "سلبي", "سلبيه", "سالب", "سالبه", "سلبى"],
  neutral: ["neutral", "neu", "neut", "محايد", "محايده", "حيادي", "حياديه"],
};
const LOOKUP = new Map<string, Sentiment>();
for (const [k, list] of Object.entries(WORDS) as [Sentiment, string[]][]) for (const w of list) LOOKUP.set(fold(w), k);

/** Numbers within this distance of zero count as neutral. */
export const NEUTRAL_BAND = 0.05;

export type Label = { sentiment: Sentiment; score: number | null } | null;

/**
 * One label cell. Words give a category and no score; numbers from -1 to 1 give a score and
 * the category it falls in. `custom` holds the researcher's own mappings for other spellings.
 */
export function readLabel(raw: string, custom?: Map<string, Sentiment>): Label {
  const key = fold(raw);
  if (!key) return null;
  const mapped = custom?.get(key) ?? LOOKUP.get(key);
  if (mapped) return { sentiment: mapped, score: null };
  // Arabic-Indic digits and the Arabic decimal separator are accepted.
  const ascii = key.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/٫/g, ".").replace(/−/g, "-");
  if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(ascii)) {
    const n = Number(ascii);
    if (n >= -1 && n <= 1) return { sentiment: n > NEUTRAL_BAND ? "positive" : n < -NEUTRAL_BAND ? "negative" : "neutral", score: n };
  }
  return null;
}

/** Every distinct value in a label column that could not be read, with how often it occurs. */
export function unreadValues(values: string[], custom?: Map<string, Sentiment>): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v.trim()) continue;
    if (!readLabel(v, custom)) counts.set(v.trim(), (counts.get(v.trim()) ?? 0) + 1);
  }
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
}

/** Guesses which columns hold the text, the label and the optional groupings, from their names. */
export function guessColumns(header: string[]): Partial<Record<"text" | "label" | "label2" | "account" | "category" | "language" | "dialect" | "date", string>> {
  // Whole words only: "time" must not match inside "sentiment". The Arabic article is ignored.
  const bare = (w: string) => w.replace(/^ال/, "");
  const words = (h: string) => fold(h).split(/[\s_.\/-]+/).map(bare);
  const find = (...names: string[]) => header.find((h) => names.some((n) => bare(fold(h)) === bare(fold(n)))) ?? header.find((h) => names.some((n) => words(h).includes(bare(fold(n)))));
  const label = find("sentiment", "label", "التصنيف", "المشاعر", "تصنيف");
  return {
    text: find("text", "content", "post", "tweet", "comment", "النص", "المنشور", "التغريده", "التعليق"),
    label,
    label2: header.find((h) => h !== label && /(label|sentiment|coder|تصنيف|مرمز|مرمّز).*(2|b|ثاني)|coder ?2|المرمز الثاني/i.test(h)),
    account: find("account", "user", "username", "author", "الحساب", "المستخدم", "الكاتب"),
    category: find("category", "group", "topic", "الفئه", "المجموعه", "الموضوع"),
    language: find("language", "lang", "اللغه"),
    dialect: find("dialect", "country", "اللهجه", "البلد", "الدوله"),
    date: find("date", "time", "created", "التاريخ", "الوقت"),
  };
}
