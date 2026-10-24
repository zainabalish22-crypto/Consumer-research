import { notFound } from "next/navigation";
import { getSession, getStudy } from "@/lib/data";
import { normalizeDraft } from "@/lib/study/factories";
import { loadLibrary } from "@/lib/library/load";
import { aiEnabled } from "@/lib/ai/assistant";
import { Builder } from "./Builder";

export default async function StudyPage({ params }: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await params;
  const data = await getStudy(studyId);
  if (!data) notFound();
  const { study, project, versions } = data;
  const { supabase } = await getSession();
  const { lib } = await loadLibrary(supabase, project.workspace_id);
  return (
    <Builder
      study={{
        id: study.id,
        title: study.title,
        status: study.status,
        slug: study.slug,
        projectId: project.id,
        projectName: project.name,
      }}
      // Drafts may be incomplete or from an older version; defaults are filled and the builder validates live.
      initialConfig={normalizeDraft(study.draft_config)}
      versions={versions}
      library={lib}
      aiEnabled={aiEnabled()}
    />
  );
}
