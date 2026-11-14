import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { SentimentExport } from "@/components/sentiment/SentimentExport";
import { SentimentResults } from "@/components/sentiment/SentimentResults";
import { SentimentUpload } from "@/components/sentiment/SentimentUpload";
import { PrivacyNote, ToolPage, ToolShell } from "@/components/tools/ToolShell";
import { currentUser } from "@/lib/auth";
import { isAnalysisTool, isStep } from "@/lib/tools/registry";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; tool: string; step: string }>;
}) {
  const { locale, tool, step } = await params;
  if (!isAnalysisTool(tool) || !isStep(step)) return {};
  const t = await getTranslations({ locale, namespace: "tools" });
  return { title: `${t(`steps.${step}`)} · ${t(`${tool}.name`)} · Tessellum` };
}

/**
 * Upload, results and export steps, on the shared page template. Steps that are not built
 * yet say so plainly.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; tool: string; step: string }>;
}) {
  const { locale, tool, step } = await params;
  if (!isAnalysisTool(tool) || !isStep(step) || step === "home") notFound();
  setRequestLocale(locale);
  // The working steps open only for signed-in researchers; the "about" page stays public.
  if (!(await currentUser()))
    redirect(
      `/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/tools/${tool}/${step}`)}`,
    );
  const t = await getTranslations("tools");
  return (
    <ToolShell>
      <ToolPage tool={tool} step={step}>
        {tool === "sentiment" && step === "upload" ? (
          <SentimentUpload />
        ) : tool === "sentiment" && step === "results" ? (
          <SentimentResults />
        ) : tool === "sentiment" && step === "export" ? (
          <SentimentExport />
        ) : (
          <section className="flex flex-col gap-2 rounded-lg border border-dashed border-line-3 p-8">
            <h2 className="font-display text-2xl">{t(`steps.${step}`)}</h2>
            <p className="text-mist">{t("notYet")}</p>
            <p className="max-w-2xl text-sm leading-relaxed text-faint">
              {t("notYetBody")}
            </p>
          </section>
        )}
        <PrivacyNote />
      </ToolPage>
    </ToolShell>
  );
}
