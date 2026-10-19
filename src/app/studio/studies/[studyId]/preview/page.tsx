import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { getSession, getStudy } from "@/lib/data";
import { StudyConfig } from "@/lib/study/schema";
import { signMedia } from "@/lib/study/media";
import { loadLibrary } from "@/lib/library/load";
import { buildSnapshot } from "@/lib/library/rows";
import { StudyRunner } from "@/components/participant/StudyRunner";
import { participantMessages } from "@/lib/participant-messages";
import { Alert } from "@/components/ui";

/** Researcher preview of the current draft. Nothing is saved. */
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ studyId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { studyId } = await params;
  const { lang } = await searchParams;
  const t = await getTranslations("builder");
  const data = await getStudy(studyId);
  if (!data) notFound();
  const parsed = StudyConfig.safeParse(data.study.draft_config);
  if (!parsed.success) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="danger">{t("previewInvalid")}</Alert>
        <ul className="list-disc ps-6 text-sm">
          {parsed.error.issues.slice(0, 20).map((i, n) => (
            <li key={n}>
              <code dir="ltr">{i.path.join(".")}</code>: {i.message}
            </li>
          ))}
        </ul>
        <Link href={`/studio/studies/${studyId}`} className="text-accent underline">
          {t("backToBuilder")}
        </Link>
      </div>
    );
  }
  const { supabase } = await getSession();
  // Preview uses the current library (publishing snapshots it into the version).
  const { lib } = await loadLibrary(supabase, data.project.workspace_id);
  const config = { ...parsed.data, library: buildSnapshot(parsed.data, lib).snapshot };
  const mediaUrls = await signMedia(supabase, config);
  const previewLanguage = lang === "ar" || lang === "en" ? lang : undefined;
  return (
    <div className="-mx-4 -my-6">
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2 text-sm">
        <Link href={`/studio/studies/${studyId}`} className="text-accent hover:underline">
          ← {t("backToBuilder")}
        </Link>
        <span className="text-muted">{t("previewNotice")}</span>
      </div>
      <StudyRunner
        mode="preview"
        config={config}
        messages={participantMessages}
        initialMediaUrls={mediaUrls}
        previewLanguage={previewLanguage && config.settings.languages.includes(previewLanguage) ? previewLanguage : undefined}
      />
    </div>
  );
}
