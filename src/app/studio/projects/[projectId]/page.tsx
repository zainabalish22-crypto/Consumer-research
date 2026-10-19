import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession, sessionCounts, type ProjectRow, type StudyRow } from "@/lib/data";
import { Badge, Card, EmptyState } from "@/components/ui";
import { StatusBadge } from "../../StatusBadge";
import { ProjectDetailsForm, ProjectActions, NewStudyForm } from "./ProjectForms";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const t = await getTranslations("studio.projects");
  const { supabase } = await getSession();
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) notFound();
  const p = project as ProjectRow;
  const { data: studiesData } = await supabase
    .from("studies")
    .select("id, title, status, slug, updated_at, current_version_id")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });
  const studies = (studiesData ?? []) as StudyRow[];
  const counts = await sessionCounts(studies.map((s) => s.id));

  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-muted">
        <Link href="/studio" className="hover:underline">
          {t("breadcrumb")}
        </Link>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" dir="auto">
            {p.name}
          </h1>
          {p.archived_at && <Badge>{t("archived")}</Badge>}
        </div>
        <ProjectActions projectId={p.id} projectName={p.name} archived={!!p.archived_at} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("studies")}</h2>
          {studies.length === 0 ? (
            <EmptyState title={t("noStudies")}>{t("noStudiesHint")}</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {studies.map((s) => {
                const c = counts.get(s.id);
                return (
                  <li key={s.id}>
                    <Link
                      href={`/studio/studies/${s.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 hover:border-accent/50"
                    >
                      <span className="font-medium" dir="auto">
                        {s.title}
                      </span>
                      <span className="flex items-center gap-3 text-xs text-muted">
                        {c && t("counts", { started: c.started, completed: c.completed })}
                        <StatusBadge status={s.status} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <Card className="mt-4">
            <h2 className="mb-3 font-semibold">{t("newStudy")}</h2>
            <NewStudyForm projectId={p.id} />
          </Card>
        </section>

        <aside>
          <Card>
            <h2 className="mb-3 font-semibold">{t("details")}</h2>
            <ProjectDetailsForm project={p} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
