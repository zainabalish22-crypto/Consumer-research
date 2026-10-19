import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitch } from "@/components/LanguageSwitch";

export default async function Home() {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const features = ["questionnaires", "experiments", "bilingual", "export", "free"] as const;
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between">
        <span className="font-semibold">{tc("platformName")}</span>
        <div className="flex items-center gap-2">
          <LanguageSwitch />
          <Link href="/login" className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-surface">
            {t("signIn")}
          </Link>
        </div>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-6 py-16">
        <h1 className="max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">{t("headline")}</h1>
        <p className="max-w-2xl text-lg text-muted">{t("lede")}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/login?mode=signup"
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-strong"
          >
            {t("cta")}
          </Link>
          <Link href="/login" className="rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-medium">
            {t("signIn")}
          </Link>
        </div>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {features.map((f) => (
            <li key={f} className="rounded-xl border border-line bg-surface p-4">
              <p className="font-medium">{t(`features.${f}.title`)}</p>
              <p className="mt-1 text-sm text-muted">{t(`features.${f}.body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-line py-4 text-xs text-muted">{t("footer")}</footer>
    </main>
  );
}
