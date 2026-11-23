import NextLink from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HeroFigure } from "@/components/site/HeroFigure";
import { Mark, Wordmark } from "@/components/site/Logo";
import { SCENES_LIVE } from "@/config/site";
import { Link } from "@/i18n/navigation";

/** Small uppercase mono label (plain and untracked in Arabic). */
function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`tracked font-mono text-xs uppercase tracking-[0.16em] ${className}`}>{children}</span>;
}

/** Section heading: light display type; Arabic gets taller lines and no negative tracking. */
const H2 = "font-display text-[32px] font-light leading-[1.12] tracking-[-0.02em] sm:text-[44px] [:lang(ar)_&]:leading-[1.5] [:lang(ar)_&]:tracking-normal";

/**
 * The homepage: what Asdaa Lab is, and the five tools in one line each. Every detail (scenes,
 * the experimental engine, exported files, what each tool records) lives on the tool's own page.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const other = locale === "ar" ? "en" : "ar";
  const tools = [
    { key: "village", status: "prototype" },
    { key: "shop", status: "prototype" },
    { key: "forms", status: "prototype" },
    { key: "network", status: "design" },
    { key: "sentiment", status: "design" },
  ] as const;

  return (
    <div className="flex min-h-dvh flex-col bg-void text-photon">
      <header className="flex flex-wrap items-center gap-x-8 gap-y-4 px-4 py-6 sm:px-12">
        <Link href="/" aria-label={t("nav.home")} className="hover:opacity-90">
          <Wordmark />
        </Link>
        <nav aria-label={t("nav.label")} className="tracked text-sm uppercase tracking-[0.08em] text-mist">
          <Link href="/tools" className="py-2 hover:text-signal">
            {t("nav.tools")}
          </Link>
        </nav>
        <div className="ms-auto flex items-center gap-2 text-sm">
          <Link href="/" locale={other} lang={other} aria-label={t("nav.otherLanguageLabel")} className="px-3 py-3 hover:text-signal">
            {t("nav.otherLanguage")}
          </Link>
          <Link href="/studio" className="tracked border border-photon px-4 py-[11px] uppercase tracking-[0.06em] hover:border-signal hover:text-signal">
            {t("nav.studio")}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="grid items-center gap-10 bg-[linear-gradient(#101115_1px,transparent_1px),linear-gradient(90deg,#101115_1px,transparent_1px)] bg-[size:56px_56px] px-4 pb-16 pt-8 sm:px-12 lg:grid-cols-2">
          <div className="flex max-w-[580px] flex-col gap-7">
            <Label className="text-signal">{t("hero.eyebrow")}</Label>
            <h1 className="font-display text-[44px] font-light leading-[1.04] tracking-[-0.03em] sm:text-[64px] xl:text-[72px] [:lang(ar)_&]:leading-[1.35] [:lang(ar)_&]:tracking-normal">
              {t("hero.titleA")} <span className="font-semibold">{t("hero.titleB")}</span>
            </h1>
            <p className="text-lg leading-[1.7] text-dim">{t("hero.body")}</p>
            <div className="flex flex-wrap gap-3">
              <a href="#tools" className="tracked bg-photon px-6 py-4 font-semibold uppercase tracking-[0.05em] text-void hover:bg-white">
                {t("hero.secondary")}
              </a>
              {SCENES_LIVE && (
                <NextLink href="/prototype/scenes" className="tracked border border-line-3 px-6 py-4 font-semibold uppercase tracking-[0.05em] hover:border-photon">
                  {t("hero.primary")}
                </NextLink>
              )}
            </div>
          </div>
          <figure className="m-0">
            <div role="img" aria-label={t("hero.figureLabel")} className="relative mx-auto aspect-[56/52] w-full max-w-[560px]">
              <HeroFigure />
              <span aria-hidden="true" dir="ltr" className="absolute start-0 top-[18%] font-mono text-[11px] text-faint">{t("hero.axisTop")}</span>
              <span aria-hidden="true" dir="ltr" className="absolute bottom-[14%] start-0 font-mono text-[11px] text-faint">{t("hero.axisBottom")}</span>
              <span aria-hidden="true" dir="ltr" className="absolute end-0 top-[52%] font-mono text-[11px] text-signal-soft">{t("hero.point")}</span>
              <span aria-hidden="true" dir="ltr" className="absolute inset-x-0 bottom-0 text-center font-mono text-[11px] text-faint">{t("hero.factors")}</span>
            </div>
          </figure>
        </section>

        {/* The five tools, one line each; details are on each tool's page. */}
        <section id="tools" className="flex scroll-mt-4 flex-col gap-8 border-t border-line px-4 py-[72px] sm:px-12">
          <h2 className={`max-w-[760px] ${H2}`}>{t("modules.title")}</h2>
          <ul className="grid gap-px border border-line bg-line md:grid-cols-2 xl:grid-cols-3">
            {tools.map(({ key, status }) => (
              <li key={key}>
                <article className="group relative flex h-full flex-col gap-3 bg-void p-7 hover:bg-carbon">
                  <span className={`font-mono text-xs ${status === "prototype" ? "text-signal" : "text-faint"}`}>
                    <span aria-hidden="true">{status === "prototype" ? "● " : "○ "}</span>
                    {t(`modules.status.${status}`)}
                  </span>
                  <h3 className="font-display text-2xl font-normal">
                    {/* The whole card is the link (the stretched ::after covers it). */}
                    <Link href={`/tools/${key}`} className="after:absolute after:inset-0 group-hover:text-signal">
                      {t(`modules.${key}.name`)}
                    </Link>
                  </h3>
                  <p className="text-[15px] leading-[1.65] text-dim">{t(`modules.${key}.kind`)}</p>
                  <span aria-hidden="true" className="tracked mt-auto font-mono text-xs uppercase tracking-[0.12em] text-signal">
                    {t("modules.open")} →
                  </span>
                </article>
              </li>
            ))}
            {/* Fills the last cell of the grid so no bare gap shows */}
            <li>
              <Link href="/tools" className="group flex h-full flex-col justify-end gap-2 bg-void p-7 hover:bg-carbon">
                <span className="font-display text-2xl group-hover:text-signal">{t("tools.title")}</span>
                <span className="text-[15px] leading-[1.65] text-dim">{t("tools.intro")}</span>
                <span aria-hidden="true" className="tracked font-mono text-xs uppercase tracking-[0.12em] text-signal">
                  {t("modules.open")} →
                </span>
              </Link>
            </li>
          </ul>
        </section>

        {/* Principles */}
        <section className="border-t border-line px-4 py-12 sm:px-12">
          <h2 className="sr-only">{t("principles.title")}</h2>
          <ul className="grid gap-6 text-[14px] leading-[1.7] sm:grid-cols-2 lg:grid-cols-4">
            {(["free", "self", "sold", "ai"] as const).map((k, i) => (
              <li key={k} className="flex flex-col">
                <span dir="ltr" className="self-start font-mono text-signal">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="tracked font-mono uppercase tracking-[0.08em]">{t(`principles.${k}.name`)}</span>
                <span className="text-faint">{t(`principles.${k}.body`)}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line px-4 py-8 text-[13px] text-faint sm:px-12">
        <Mark size={22} className="text-photon" />
        <p className="max-w-3xl flex-1">{t("footer.status")}</p>
      </footer>
    </div>
  );
}
