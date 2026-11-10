import NextLink from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SCENES } from "@/components/env3d/scenes";
import { HeroFigure } from "@/components/site/HeroFigure";
import { Mark, Wordmark } from "@/components/site/Logo";
import { SCENES_LIVE } from "@/config/site";
import { Link } from "@/i18n/navigation";

const SECTIONS = ["top", "modules", "environments", "engine", "data", "principles"] as const;

/** Small uppercase mono label (plain and untracked in Arabic). */
function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`tracked font-mono text-xs uppercase tracking-[0.16em] ${className}`}>{children}</span>;
}

/** Section heading: light display type; Arabic gets taller lines and no negative tracking. */
const H2 = "font-display text-[32px] font-light leading-[1.12] tracking-[-0.02em] sm:text-[44px] [:lang(ar)_&]:leading-[1.5] [:lang(ar)_&]:tracking-normal";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const other = locale === "ar" ? "en" : "ar";
  const modules = [
    { key: "village", status: "prototype" },
    { key: "shop", status: "design" },
    { key: "forms", status: "design" },
  ] as const;

  return (
    <div className="flex min-h-dvh bg-void text-photon">
      {/* Section rail, wide screens only */}
      <aside aria-label={t("nav.sections")} className="sticky top-0 hidden h-dvh w-[72px] shrink-0 flex-col items-center gap-14 border-e border-line pt-36 font-mono text-[13px] text-[#6c717a] lg:flex">
        {SECTIONS.map((id, i) => (
          <a key={id} href={`#${id}`} className="px-2 py-1 hover:text-photon">
            {String(i + 1).padStart(2, "0")}
          </a>
        ))}
      </aside>

      <div className="min-w-0 flex-1">
        <header id="top" className="flex flex-wrap items-center gap-x-8 gap-y-4 px-4 py-6 sm:px-12">
          <Link href="/" aria-label={t("nav.home")} className="hover:opacity-90">
            <Wordmark />
          </Link>
          <nav aria-label={t("nav.label")} className="tracked order-3 flex w-full flex-wrap gap-x-7 gap-y-1 text-sm uppercase tracking-[0.08em] text-mist md:order-none md:w-auto">
            <a href="#modules" className="py-2 hover:text-signal">{t("nav.modules")}</a>
            <a href="#environments" className="py-2 hover:text-signal">{t("nav.environments")}</a>
            <a href="#engine" className="py-2 hover:text-signal">{t("nav.engine")}</a>
            <a href="#data" className="py-2 hover:text-signal">{t("nav.data")}</a>
          </nav>
          <div className="ms-auto flex items-center gap-2 text-sm">
            <Link href="/" locale={other} lang={other} aria-label={t("nav.otherLanguageLabel")} className="px-3 py-3 hover:text-signal">
              {t("nav.otherLanguage")}
            </Link>
            {SCENES_LIVE && (
              <NextLink href="/prototype/scenes" className="tracked border border-photon px-4 py-[11px] uppercase tracking-[0.06em] hover:border-signal hover:text-signal">
                {t("nav.scenes")}
              </NextLink>
            )}
          </div>
        </header>

        <main>
          {/* Hero */}
          <section className="grid items-center gap-10 bg-[linear-gradient(#101115_1px,transparent_1px),linear-gradient(90deg,#101115_1px,transparent_1px)] bg-[size:56px_56px] px-4 pb-16 pt-8 sm:px-12 lg:grid-cols-2">
            <div className="flex max-w-[580px] flex-col gap-7">
              <Label className="text-signal">{t("hero.eyebrow")}</Label>
              <h1 className="font-display text-[44px] font-light leading-[1.04] tracking-[-0.03em] sm:text-[64px] xl:text-[72px] [:lang(ar)_&]:leading-[1.35] [:lang(ar)_&]:tracking-normal">
                {t("hero.titleA")} <span className="font-semibold">{t("hero.titleB")}</span>
              </h1>
              <p className="text-lg leading-[1.7] text-dim">{t("hero.body")}</p>
              <div className="flex flex-wrap gap-3">
                {SCENES_LIVE ? (
                  <>
                    <NextLink href="/prototype/scenes" className="tracked bg-photon px-6 py-4 font-semibold uppercase tracking-[0.05em] text-void hover:bg-white">
                      {t("hero.primary")}
                    </NextLink>
                    <a href="#modules" className="tracked border border-line-3 px-6 py-4 font-semibold uppercase tracking-[0.05em] hover:border-photon">
                      {t("hero.secondary")}
                    </a>
                  </>
                ) : (
                  <a href="#modules" className="tracked bg-photon px-6 py-4 font-semibold uppercase tracking-[0.05em] text-void hover:bg-white">
                    {t("hero.secondary")}
                  </a>
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

          {/* Fig. 01 Modules */}
          <section id="modules" className="flex scroll-mt-4 flex-col gap-8 border-t border-line px-4 py-[72px] sm:px-12">
            <h2 className={`max-w-[760px] ${H2}`}>
              <Label className="mb-4 block text-sm text-signal">{t("modules.fig")}</Label>
              {t("modules.title")}
            </h2>
            <div className="grid gap-px border border-line bg-line md:grid-cols-3">
              {modules.map(({ key, status }) => (
                <article key={key} className="flex flex-col gap-3 bg-void p-7">
                  <div className="flex items-center justify-between gap-3 font-mono text-xs">
                    <span dir="ltr" className="text-faint">{t(`modules.${key}.code`)}</span>
                    <span className={status === "prototype" ? "text-signal" : "text-faint"}>
                      <span aria-hidden="true">{status === "prototype" ? "● " : "○ "}</span>
                      {t(`modules.status.${status}`)}
                    </span>
                  </div>
                  <h3 className="font-display text-2xl font-normal">{t(`modules.${key}.name`)}</h3>
                  <p className="text-sm text-ice">{t(`modules.${key}.kind`)}</p>
                  <p className="text-[15px] leading-[1.65] text-dim">{t(`modules.${key}.body`)}</p>
                  <p className="mt-auto border-t border-line-2 pt-3 text-[13px] leading-[1.6] text-faint">
                    <span className="tracked font-mono text-[11px] uppercase tracking-[0.12em] text-mist">{t("modules.recordsLabel")}</span> · {t(`modules.${key}.records`)}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {/* Fig. 02 Environments */}
          <section id="environments" className="grid scroll-mt-4 items-start gap-12 border-t border-line px-4 py-[72px] sm:px-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="flex flex-col gap-5">
              <Label className="text-sm text-signal">{t("environments.fig")}</Label>
              <h2 className={H2}>{t("environments.title")}</h2>
              <p className="leading-[1.7] text-dim">{t("environments.body")}</p>
              <p className="leading-[1.7] text-dim">{t("environments.avatar")}</p>
              {SCENES_LIVE && (
                <NextLink href="/prototype/scenes" className="tracked mt-2 self-start border border-photon px-5 py-3 text-sm font-semibold uppercase tracking-[0.06em] hover:border-signal hover:text-signal">
                  {t("environments.open")}
                </NextLink>
              )}
            </div>
            <ol className="grid min-w-0 border-t border-line-2 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
              {SCENES.map((s, i) => (
                <li key={s.id} className="border-b border-line-2 sm:odd:border-e sm:odd:pe-6 sm:even:ps-6">
                  {(() => {
                    const row = (
                      <>
                        <span dir="ltr" className="font-mono text-xs text-faint">{String(i + 1).padStart(2, "0")}</span>
                        <span className="min-w-0 flex-1 text-[17px] group-hover:text-signal">{t(`environments.scenes.${s.id}`)}</span>
                        <span className="whitespace-nowrap font-mono text-[11px] text-faint">
                          {t(`environments.${s.setting}`)} · {t(`environments.${s.time === "night" ? "evening" : "day"}`)}
                        </span>
                      </>
                    );
                    const cls = "group flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4";
                    return SCENES_LIVE ? (
                      <NextLink href={`/prototype/scenes/${s.id}`} className={cls}>
                        {row}
                      </NextLink>
                    ) : (
                      <div className={cls}>{row}</div>
                    );
                  })()}
                </li>
              ))}
            </ol>
          </section>

          {/* Fig. 03 Engine */}
          <section id="engine" className="grid scroll-mt-4 items-center gap-12 border-t border-line px-4 py-[72px] sm:px-12 lg:grid-cols-2">
            <div className="flex flex-col gap-5">
              <Label className="text-sm text-signal">{t("engine.fig")}</Label>
              <h2 className={H2}>{t("engine.title")}</h2>
              <p className="leading-[1.7] text-dim">{t("engine.body")}</p>
            </div>
            <figure className="m-0 flex min-w-0 flex-col gap-4 border border-line-2 p-6">
              <figcaption className="font-mono text-xs leading-relaxed text-faint">{t("engine.caption")}</figcaption>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse font-mono text-[13px]">
                  <thead>
                    <tr className="text-faint">
                      <th scope="col" className="border-b border-line-2 p-2.5 text-start font-normal">{t("engine.sequence")}</th>
                      {[1, 2, 3].map((n) => (
                        <th key={n} scope="col" className="border-b border-line-2 p-2.5 text-start font-normal">{t("engine.brand", { n })}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map((row) => (
                      <tr key={row}>
                        <th scope="row" className="p-2.5 text-start font-normal text-faint">{row}</th>
                        {[1, 2, 3].map((col) => (
                          <td key={col} className={`p-2.5 ${row === col ? "text-signal" : ""}`}>
                            {row === col ? `${t("engine.ai")} ■` : t("engine.authentic")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[13px] text-faint">{t("engine.note")}</p>
            </figure>
          </section>

          {/* Fig. 04 Data */}
          <section id="data" className="grid scroll-mt-4 items-center gap-12 border-t border-line px-4 py-[72px] sm:px-12 lg:grid-cols-2">
            <div className="flex flex-col gap-5">
              <Label className="text-sm text-signal">{t("data.fig")}</Label>
              <h2 className={H2}>{t("data.title")}</h2>
              <p className="leading-[1.7] text-dim">{t("data.body")}</p>
            </div>
            <ul className="grid grid-cols-1 gap-px border border-line-2 bg-line-2 text-[13px] sm:grid-cols-2">
              {(
                [
                  ["participants.csv", "participants"],
                  ["events.csv", "events"],
                  ["codebook.csv", "codebook"],
                  ["labels.sps", "labels"],
                ] as const
              ).map(([file, key]) => (
                <li key={file} className="flex flex-col gap-1 bg-void p-5">
                  <span dir="ltr" className="self-start font-mono">{file}</span>
                  <span className="text-faint">{t(`data.files.${key}`)}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Both directions */}
          <section className="grid items-center gap-10 border-t border-line px-4 py-16 sm:px-12 lg:grid-cols-2">
            <p className="font-display text-[26px] font-light leading-[1.35] sm:text-[34px] [:lang(ar)_&]:leading-[1.7]">{t("bilingual.here")}</p>
            <p lang={t("bilingual.otherLang")} dir={t("bilingual.otherLang") === "ar" ? "rtl" : "ltr"} className="font-display text-[24px] font-light leading-[1.6] text-dim sm:text-[30px]">
              {t("bilingual.other")}
            </p>
          </section>

          {/* Principles */}
          <section id="principles" className="scroll-mt-4 border-t border-line px-4 py-12 sm:px-12">
            <h2 className="sr-only">{t("principles.title")}</h2>
            <ul className="grid gap-6 text-[14px] leading-[1.7] sm:grid-cols-2 lg:grid-cols-4">
              {(["free", "self", "sold", "ai"] as const).map((k, i) => (
                <li key={k} className="flex flex-col">
                  <span dir="ltr" className="self-start font-mono text-signal">{String(i + 1).padStart(2, "0")}</span>
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
          {SCENES_LIVE && (
            <NextLink href="/prototype/scenes" className="text-photon hover:text-signal">
              {t("footer.scenes")}
            </NextLink>
          )}
        </footer>
      </div>
    </div>
  );
}
