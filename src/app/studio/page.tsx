import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getSession, sessionCounts, type ProjectRow, type StudyRow } from "@/lib/data";
import { Badge, Card, EmptyState, cx } from "@/components/ui";
import { NewProjectForm } from "./NewProjectForm";
import { StatusBadge } from "./StatusBadge";

export async function generateMetadata() {
  const t = await getTranslations("studio.dashboard");
  return { title: t("title") };
}

const FILTERS = ["all", "active", "draft", "closed"] as const;

function relative(iso: string, locale: string) {
  const diff = (Date.parse(iso) - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return new Date(iso).toLocaleDateString(locale);
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ archived?: string; show?: string }> }) {
  const { archived, show } = await searchParams;
  const showArchived = archived === "1";
  const filter = (FILTERS as readonly string[]).includes(show ?? "") ? (show as (typeof FILTERS)[number]) : "all";
  const t = await getTranslations("studio.dashboard");
  const locale = await getLocale();
  const { supabase, workspaceId, profile } = await getSession();

  const { data: projects } = await supabase.from("projects").select("*").eq("workspace_id", workspaceId).order("updated_at", { ascending: false });
  const all = (projects ?? []) as ProjectRow[];
  const visible = all.filter((p) => (showArchived ? p.archived_at : !p.archived_at));
  const projectName = new Map(all.map((p) => [p.id, p.name]));

  const { data: studiesData } = await supabase
    .from("studies")
    .select("id, project_id, title, slug, status, updated_at")
    .in("project_id", all.length ? all.map((p) => p.id) : ["00000000-0000-0000-0000-000000000000"])
    .order("updated_at", { ascending: false });
  const studies = (studiesData ?? []) as Pick<StudyRow, "id" | "project_id" | "title" | "slug" | "status" | "updated_at">[];
  const counts = await sessionCounts(studies.map((s) => s.id));
  const totals = [...counts.values()].reduce((a, c) => ({ started: a.started + c.started, completed: a.completed + c.completed, test: a.test + c.test }), { started: 0, completed: 0, test: 0 });
  const live = studies.filter((s) => s.status === "active").length;
  const drafts = studies.filter((s) => s.status === "draft").length;
  const listed = studies.filter((s) => filter === "all" || s.status === filter || (filter === "closed" && s.status === "paused"));

  // Getting started: every step is worked out from the researcher's own data.
  const steps = [
    { key: "project", done: all.length > 0 },
    { key: "study", done: studies.length > 0 },
    { key: "publish", done: studies.some((s) => s.status !== "draft") },
    { key: "test", done: totals.test > 0 },
    { key: "real", done: totals.started > 0 },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const name = (profile?.display_name as string | undefined)?.split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold" dir="auto">
            {name ? t("hello", { name }) : t("title")}
          </h1>
          <p className="text-sm text-muted">{t("summary", { live, completed: totals.completed })}</p>
        </div>
        <details className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-strong [&::-webkit-details-marker]:hidden">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t("newProject")}
          </summary>
          <Card className="absolute end-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] shadow-lg">
            <NewProjectForm workspaceId={workspaceId} />
          </Card>
        </details>
      </div>

      <section aria-label={t("overview")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted">{t("liveStudies")}</p>
          <p className="text-3xl font-bold tabular-nums">{live}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">{t("participantsStarted")}</p>
          <p className="text-3xl font-bold tabular-nums">{totals.started}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">{t("completionRate")}</p>
          <p className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">{totals.started ? `${Math.round((totals.completed / totals.started) * 100)}%` : "–"}</span>
            {totals.started > 0 && <span className="text-sm text-muted">{t("ofStarted", { n: totals.completed, total: totals.started })}</span>}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">{t("drafts")}</p>
          <p className="text-3xl font-bold tabular-nums">{drafts}</p>
        </Card>
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <section className="min-w-0 flex-[999_1_32rem] overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
            <h2 className="font-semibold">{t("studies")}</h2>
            <nav aria-label={t("filterStudies")} className="flex gap-1 text-sm">
              {FILTERS.map((f) => (
                <Link
                  key={f}
                  href={f === "all" ? "/studio" : `/studio?show=${f}`}
                  aria-current={filter === f ? "page" : undefined}
                  className={cx("rounded-full px-3 py-1", filter === f ? "bg-ink text-white" : "bg-paper hover:bg-line")}
                >
                  {t(`filters.${f}`)}
                </Link>
              ))}
            </nav>
          </div>
          {listed.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">{t("noStudies")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-5 py-2 text-start font-medium">{t("colStudy")}</th>
                    <th scope="col" className="px-3 py-2 text-start font-medium">{t("colStatus")}</th>
                    <th scope="col" className="px-3 py-2 text-start font-medium">{t("colParticipants")}</th>
                    <th scope="col" className="px-5 py-2 text-start font-medium">{t("colUpdated")}</th>
                  </tr>
                </thead>
                <tbody>
                  {listed.map((s) => {
                    const c = counts.get(s.id);
                    const pct = c && c.started ? Math.round((c.completed / c.started) * 100) : 0;
                    return (
                      <tr key={s.id} className="border-t border-line/70 hover:bg-paper">
                        <td className="px-5 py-3">
                          <Link href={`/studio/studies/${s.id}`} className="font-semibold hover:underline" dir="auto">
                            {s.title}
                          </Link>
                          <p className="text-xs text-muted" dir="auto">
                            {projectName.get(s.project_id)}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="min-w-40 px-3 py-3">
                          {c && c.started > 0 ? (
                            <>
                              <p className="text-xs">{t("finishedOf", { n: c.completed, total: c.started })}</p>
                              <div className="mt-1.5 h-1.5 rounded-full bg-line" aria-hidden>
                                <div className="h-1.5 rounded-full bg-accent" style={{ width: `${pct}%` }} />
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-muted">{t("noParticipantsYet")}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-muted">{relative(s.updated_at, locale)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="flex min-w-0 flex-[1_1_18rem] flex-col gap-6">
          {doneCount < steps.length && (
            <Card className="flex flex-col gap-3">
              <h2 className="font-semibold">{t("gettingStarted")}</h2>
              <ol className="flex flex-col gap-2 text-sm">
                {steps.map((s) => (
                  <li key={s.key} className="flex items-start gap-2.5">
                    <span
                      className={cx("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border", s.done ? "border-accent bg-accent text-white" : "border-line-strong")}
                      aria-hidden
                    >
                      {s.done && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <path d="M5 12l5 5 9-10" />
                        </svg>
                      )}
                    </span>
                    <span className={s.done ? "text-muted line-through" : ""}>
                      {t(`steps.${s.key}`)}
                      <span className="sr-only"> ({s.done ? t("done") : t("notDone")})</span>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="h-1.5 rounded-full bg-line" aria-hidden>
                <div className="h-1.5 rounded-full bg-shop" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
              </div>
              <p className="text-xs text-muted">{t("stepsDone", { n: doneCount, total: steps.length })}</p>
            </Card>
          )}

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{showArchived ? t("archivedProjects") : t("projects")}</h2>
              <Link href={showArchived ? "/studio" : "/studio?archived=1"} className="text-sm text-accent hover:underline">
                {showArchived ? t("showActive") : t("showArchived")}
              </Link>
            </div>
            {visible.length === 0 ? (
              <EmptyState title={showArchived ? t("noArchived") : t("noProjects")}>{!showArchived && t("noProjectsHint")}</EmptyState>
            ) : (
              <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {visible.map((p) => (
                  <li key={p.id}>
                    <Link href={`/studio/projects/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium" dir="auto">
                          {p.name}
                        </span>
                        <span className="text-xs text-muted">{t("studyCount", { n: studies.filter((s) => s.project_id === p.id).length })}</span>
                      </span>
                      {p.archived_at && <Badge>{t("archived")}</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
