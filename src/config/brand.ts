/**
 * The platform's name, in each language. Page titles and the wordmark read it from here.
 * (Internal storage names such as the browser database "tessellum" keep the old name on
 * purpose: changing them would hide studies researchers have already saved.)
 */
export const BRAND = { en: "Asdaa Lab", ar: "أصداء لاب" } as const;

export const brandName = (locale: string) => (locale === "ar" ? BRAND.ar : BRAND.en);
