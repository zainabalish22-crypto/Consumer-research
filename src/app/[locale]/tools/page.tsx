import NextLink from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ToolShell } from "@/components/tools/ToolShell";
import { SCENES_LIVE } from "@/config/site";
import { Link } from "@/i18n/navigation";
import { ANALYSIS_TOOLS, STUDY_TOOLS } from "@/lib/tools/registry";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "tools" });
  return { title: `${t("title")} · Tessellum` };
}

const card = "group relative flex h-full flex-col gap-3 bg-carbon p-6 hover:bg-steel";

/** All tools on the platform. Each works on its own. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tools");
  const studyTools = STUDY_TOOLS.filter((x) => x.id !== "village" || SCENES_LIVE);
  return (
    <ToolShell>
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 sm:px-8">
        <div className="flex max-w-2xl flex-col gap-3">
          <h1 className="font-display text-4xl font-light">{t("title")}</h1>
          <p className="text-dim">{t("intro")}</p>
        </div>

        <section className="flex flex-col gap-4" aria-labelledby="analysis">
          <h2 id="analysis" className="tracked font-mono text-xs uppercase tracking-[0.16em] text-signal">
            {t("analysis")}
          </h2>
          <ul className="grid gap-px overflow-hidden rounded-lg border border-line-2 bg-line-2 md:grid-cols-2">
            {ANALYSIS_TOOLS.map((id) => (
              <li key={id}>
                <article className={card}>
                  <span className="font-mono text-xs text-faint">
                    <span aria-hidden="true">○ </span>
                    {t("status.building")}
                  </span>
                  <h3 className="font-display text-2xl">
                    <Link href={`/tools/${id}`} className="after:absolute after:inset-0 group-hover:text-signal">
                      {t(`${id}.name`)}
                    </Link>
                  </h3>
                  <p className="text-[15px] leading-relaxed text-dim">{t(`${id}.summary`)}</p>
                </article>
              </li>
            ))}
          </ul>
          <p className="text-sm text-faint">{t("signInNote")}</p>
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="study">
          <h2 id="study" className="tracked font-mono text-xs uppercase tracking-[0.16em] text-signal">
            {t("study")}
          </h2>
          <ul className="grid gap-px overflow-hidden rounded-lg border border-line-2 bg-line-2 md:grid-cols-3">
            {studyTools.map((tool) => (
              <li key={tool.id}>
                <article className={card}>
                  <span className="font-mono text-xs text-signal">
                    <span aria-hidden="true">● </span>
                    {t("status.ready")}
                  </span>
                  <h3 className="font-display text-2xl">
                    {tool.localized ? (
                      <Link href={tool.href} className="after:absolute after:inset-0 group-hover:text-signal">
                        {t(`${tool.id}.name`)}
                      </Link>
                    ) : (
                      <NextLink href={tool.href} className="after:absolute after:inset-0 group-hover:text-signal">
                        {t(`${tool.id}.name`)}
                      </NextLink>
                    )}
                  </h3>
                  <p className="text-[15px] leading-relaxed text-dim">{t(`${tool.id}.body`)}</p>
                </article>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </ToolShell>
  );
}
