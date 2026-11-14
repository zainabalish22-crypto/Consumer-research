import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PrivacyNote, ToolPage, ToolShell } from "@/components/tools/ToolShell";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { ANALYSIS_TOOLS, TOOL_COPY, isAnalysisTool } from "@/lib/tools/registry";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => ANALYSIS_TOOLS.map((tool) => ({ locale, tool })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; tool: string }> }) {
  const { locale, tool } = await params;
  if (!isAnalysisTool(tool)) return {};
  const t = await getTranslations({ locale, namespace: "tools" });
  return { title: `${t(`${tool}.name`)} · Tessellum`, description: t(`${tool}.summary`) };
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line-2 bg-carbon p-6">
      <h2 className="tracked font-mono text-xs uppercase tracking-[0.16em] text-faint">{title}</h2>
      <ul className="flex flex-col gap-3 text-[15px] leading-relaxed text-mist">
        {items.map((x, i) => (
          <li key={i} className="flex gap-3">
            <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 bg-ice" />
            <span>{x}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A tool's own page: what it does, what you need, what you get, and where to start. */
export default async function Page({ params }: { params: Promise<{ locale: string; tool: string }> }) {
  const { locale, tool } = await params;
  if (!isAnalysisTool(tool)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("tools");
  const copy = TOOL_COPY[tool];
  return (
    <ToolShell>
      <ToolPage tool={tool} step="home">
        <p className="max-w-3xl text-lg leading-relaxed text-dim">{t(`${tool}.summary`)}</p>
        {copy.disclaimer && (
          <p role="note" className="flex gap-3 rounded-lg border border-warn/60 bg-carbon p-4 text-[15px] leading-relaxed">
            <span aria-hidden="true" className="font-mono text-warn">
              !
            </span>
            {t(`${tool}.${copy.disclaimer}`)}
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <List title={t("need")} items={copy.need.map((k) => t(`${tool}.${k}`))} />
          <List title={t("get")} items={copy.get.map((k) => t(`${tool}.${k}`))} />
        </div>
        <List title={t("limits")} items={copy.limits.map((k) => t(`${tool}.${k}`))} />
        <PrivacyNote />
        <div className="flex flex-col gap-3">
          <Link href={`/tools/${tool}/upload`} className="tracked inline-flex min-h-12 items-center self-start bg-photon px-6 font-semibold uppercase tracking-[0.05em] text-void hover:bg-white">
            {t("start")}
          </Link>
          <p className="text-sm text-faint">{t("signInNote")}</p>
        </div>
      </ToolPage>
    </ToolShell>
  );
}
