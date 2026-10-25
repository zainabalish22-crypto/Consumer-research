import { notFound } from "next/navigation";
import { getSession, getStudy } from "@/lib/data";
import { StudyConfig } from "@/lib/study/schema";
import { signMedia } from "@/lib/study/media";
import { loadLibrary } from "@/lib/library/load";
import { buildSnapshot } from "@/lib/library/rows";
import { StudyRunner } from "@/components/participant/StudyRunner";
import { participantMessages } from "@/lib/participant-messages";

/**
 * Bare preview of the saved draft for the builder's live preview pane: no
 * studio menu, banners or toolbar, opened at the selected block. Nothing is saved.
 */
export default async function EmbeddedPreview({
  params,
  searchParams,
}: {
  params: Promise<{ studyId: string }>;
  searchParams: Promise<{ lang?: string; block?: string; condition?: string }>;
}) {
  const { studyId } = await params;
  const { lang, block, condition } = await searchParams;
  const data = await getStudy(studyId);
  if (!data) notFound();
  const parsed = StudyConfig.safeParse(data.study.draft_config);
  if (!parsed.success) {
    return <p className="p-6 text-center text-sm text-muted">{parsed.error.issues[0]?.message}</p>;
  }
  const { supabase } = await getSession();
  const { lib } = await loadLibrary(supabase, data.project.workspace_id);
  const config = { ...parsed.data, library: buildSnapshot(parsed.data, lib).snapshot };
  const mediaUrls = await signMedia(supabase, config);
  const language = lang === "ar" || lang === "en" ? lang : undefined;
  const target = config.blocks.find((b) => b.id === block);
  // A block shown only to some conditions is previewed as its first condition.
  const cond = condition && config.design.conditions.some((c) => c.id === condition) ? condition : target?.showTo?.[0];
  return (
    <StudyRunner
      key={`${block}:${language}:${cond}`}
      mode="preview"
      embedded
      startBlockId={block}
      overrides={cond ? { condition: cond } : undefined}
      config={config}
      messages={participantMessages}
      initialMediaUrls={mediaUrls}
      previewLanguage={language && config.settings.languages.includes(language) ? language : undefined}
    />
  );
}
