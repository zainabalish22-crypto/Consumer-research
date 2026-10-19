import { notFound } from "next/navigation";
import { getStudy } from "@/lib/data";
import type { StudyConfig } from "@/lib/study/schema";
import { Builder } from "./Builder";

export default async function StudyPage({ params }: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await params;
  const data = await getStudy(studyId);
  if (!data) notFound();
  const { study, project, versions } = data;
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
      // Drafts may be incomplete; the builder validates live and shows issues.
      initialConfig={study.draft_config as StudyConfig}
      versions={versions}
    />
  );
}
