import { getTranslations, setRequestLocale } from "next-intl/server";
import { ToolShell } from "@/components/tools/ToolShell";
import { brandName } from "@/config/brand";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return { title: `${t("title")} · ${brandName(locale)}`, description: t("lead") };
}

const TOOLS = ["village", "shop", "forms", "network", "sentiment"] as const;
const H2 = "font-display text-2xl font-light sm:text-3xl";

/** About Asdaa Lab: what it is, who it is for, what it does and how it handles data. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const how = t.raw("about.how.items") as string[];
  return (
    <ToolShell>
      <main className="mx-auto flex max-w-3xl flex-col gap-12 px-4 py-12 sm:px-8">
        <header className="flex flex-col gap-4">
          <h1 className="font-display text-4xl font-light sm:text-5xl">{t("about.title")}</h1>
          <p className="text-lg leading-[1.7] text-dim">{t("about.lead")}</p>
          <p className="text-[15px] leading-[1.7] text-faint">{t("about.name")}</p>
        </header>

        <section className="flex flex-col gap-3" aria-labelledby="who">
          <h2 id="who" className={H2}>
            {t("about.who.title")}
          </h2>
          <p className="leading-[1.7] text-dim">{t("about.who.body")}</p>
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="what">
          <h2 id="what" className={H2}>
            {t("about.what")}
          </h2>
          <ul className="grid gap-px overflow-hidden rounded-lg border border-line-2 bg-line-2">
            {TOOLS.map((k) => (
              <li key={k}>
                <Link href={`/tools/${k}`} className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 bg-carbon px-5 py-4 hover:bg-steel">
                  <span className="text-[17px] group-hover:text-signal">{t(`modules.${k}.name`)}</span>
                  <span className="text-sm text-dim">{t(`modules.${k}.kind`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="how">
          <h2 id="how" className={H2}>
            {t("about.how.title")}
          </h2>
          <ul className="flex flex-col gap-3 leading-[1.7] text-dim">
            {how.map((item, i) => (
              <li key={i} className="flex gap-3">
                <span aria-hidden="true" className="mt-[11px] h-1.5 w-1.5 shrink-0 bg-ice" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="principles">
          <h2 id="principles" className={H2}>
            {t("principles.title")}
          </h2>
          <ul className="grid gap-6 text-[14px] leading-[1.7] sm:grid-cols-2">
            {(["free", "self", "sold", "ai"] as const).map((k) => (
              <li key={k} className="flex flex-col">
                <span className="tracked font-mono uppercase tracking-[0.08em]">{t(`principles.${k}.name`)}</span>
                <span className="text-faint">{t(`principles.${k}.body`)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-4 border-t border-line-2 pt-8">
          <p className="text-sm leading-relaxed text-faint">{t("footer.status")}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/tools" className="tracked inline-flex min-h-12 items-center bg-photon px-6 font-semibold uppercase tracking-[0.05em] text-void hover:bg-white">
              {t("hero.secondary")}
            </Link>
            <Link href="/sign-up" className="tracked inline-flex min-h-12 items-center border border-line-3 px-6 font-semibold uppercase tracking-[0.05em] hover:border-photon">
              {t("auth.signUp")}
            </Link>
          </div>
        </section>
      </main>
    </ToolShell>
  );
}
