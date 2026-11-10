"use client";

import { useLocale, useTranslations } from "next-intl";
import { Wordmark } from "@/components/site/Logo";
import { Link, usePathname } from "@/i18n/navigation";

/** The researcher studio frame: dark, with the brand, language switch and the storage notice. */
export function StudioShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("studio");
  const nav = useTranslations("nav");
  const locale = useLocale();
  const path = usePathname();
  const other = locale === "ar" ? "en" : "ar";
  return (
    <div className="min-h-dvh bg-void text-photon">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line px-4 py-4 sm:px-8">
        <Link href="/" aria-label={nav("home")}>
          <Wordmark />
        </Link>
        <Link href="/studio" className="tracked font-mono text-xs uppercase tracking-[0.16em] text-signal hover:text-signal-soft">
          {t("title")}
        </Link>
        <Link href={path} locale={other} lang={other} className="ms-auto px-3 py-3 text-sm hover:text-signal">
          {nav("otherLanguage")}
        </Link>
      </header>
      <p className="flex items-center gap-2 border-b border-line bg-carbon px-4 py-2 text-[13px] text-dim sm:px-8">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-warn" />
        {t("local")}
      </p>
      {children}
    </div>
  );
}
