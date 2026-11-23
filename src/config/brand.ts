/** The platform's name, in each language. Page titles and the wordmark read it from here. */
export const BRAND = { en: "Asdaa Lab", ar: "أصداء لاب" } as const;

export const brandName = (locale: string) => (locale === "ar" ? BRAND.ar : BRAND.en);
