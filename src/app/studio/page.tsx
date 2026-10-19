import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getSession, sessionCounts, type ProjectRow, type StudyRow } from "@/lib/data";
import { Badge, Card, EmptyState } from "@/components/ui";
import { NewProjectForm } from "./NewProjectForm";
import { StatusBadge } from "./StatusBadge";

export async function generateMetadata() {
  const t = await getTranslations("studio.dashboard");
  return { title: t("title") };
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";
  const t = await getTranslations("studio.dashboard");
  const { supabase, workspaceId } = await getSession();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });
  const all = (projects ?? []) as ProjectRow[];
  const visible = all.filter((p) => (showArchived ? p.archived_at : !p.archived_at));

  const { data: studiesData } = await supabase
    .from("studies")
    .select("id, project_id, title, slug, status, updated_at")
    .in("project_id", all.map((p) => p.id).length ? all.map((p) => p.id) : ["00000000-0000-0000-0000-000000000000"])
    .order("updated_at", { ascending: false });
  const studies = (studiesData ?? []) as Pick<StudyRow, "id" | "project_id" | "title" | "slug" | "status" | "updated_at">[];
  const counts = await sessionCounts(studies.map((s) => s.id));

  const byStatus = (["draft", "active", "paused", "closed"] as const).map((s) => ({
    status: s,
    n: studies.filter((x) => x.status === s).length,
  }));
  const totals = [...counts.values()].reduce((a, c) => ({ started: a.started + c.started, completed: a.completed + c.completed }), {
    started: 0,
    completed: 0,
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>
      </div>

      <section aria-label={t("overview")} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {byStatus.map(({ status, n }) => (
          <Card key={status} className="p-4">
            <p className="text-xs text-muted">{t(`status.${status}`)}</p>
            <p className="text-2xl font-semibold">{n}</p>
          </Card>
        ))}
        <Card className="p-4">
          <p className="text-xs text-muted">{t("participantsStarted")}</p>
          <p className="text-2xl font-semibold">{totals.started}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">{t("participantsCompleted")}</p>
          <p className="text-2xl font-semibold">{totals.completed}</p>
        </Card>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{showArchived ? t("archivedProjects") : t("projects")}</h2>
            <Link href={showArchived ? "/studio" : "/studio?archived=1"} className="text-sm text-accent hover:underline">
              {showArchived ? t("showActive") : t("showArchived")}
            </Link>
          </div>
          {visible.length === 0 ? (
            <EmptyState title={showArchived ? t("noArchived") : t("noProjects")}>{!showArchived && t("noProjectsHint")}</EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {visible.map((p) => {
                const ps = studies.filter((s) => s.project_id === p.id);
                return (
                  <li key={p.id}>
                    <Link href={`/studio/projects/${p.id}`} className="block rounded-xl border border-line bg-surface p-4 hover:border-accent/50">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium" dir="auto">
                          {p.name}
                        </p>
                        {p.archived_at && <Badge>{t("archived")}</Badge>}
                      </div>
                      {p.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted" dir="auto">
                          {p.description}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-muted">{t("studyCount", { n: ps.length })}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-3 font-semibold">{t("newProject")}</h2>
            <NewProjectForm workspaceId={workspaceId} />
          </Card>
          <section>
            <h2 className="mb-2 font-semibold">{t("recentStudies")}</h2>
            {studies.length === 0 ? (
              <p className="text-sm text-muted">{t("noStudies")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
                {studies.slice(0, 6).map((s) => {
                  const c = counts.get(s.id);
                  return (
                    <li key={s.id}>
                      <Link href={`/studio/studies/${s.id}`} className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-paper">
                        <span className="truncate text-sm" dir="auto">
                          {s.title}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {c && <span className="text-xs text-muted">{t("completedShort", { n: c.completed })}</span>}
                          <StatusBadge status={s.status} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
