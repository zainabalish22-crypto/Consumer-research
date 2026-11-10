import { defineRouting } from "next-intl/routing";

/** English and Arabic, each with its own address (/en, /ar). Arabic pages are right to left. */
export const routing = defineRouting({
  locales: ["en", "ar"],
  defaultLocale: "en",
});

export type Locale = (typeof routing.locales)[number];
export const dirOf = (locale: string) => (locale === "ar" ? "rtl" : "ltr");
