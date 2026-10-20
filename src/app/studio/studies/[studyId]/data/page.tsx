import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getSession, getStudy } from "@/lib/data";
import { Badge, Card, EmptyState } from "@/components/ui";
import { StatusBadge } from "../../../StatusBadge";
import { ExclusionToggle, DeleteTestSessions, ExportLinks } from "./DataControls";

const PAGE_SIZE = 50;
const FILTERS = ["all", "completed", "incomplete", "excluded", "test"] as const;

export default async function DataPage({
  params,
  searchParams,
}: {
  params: Promise<{ studyId: string }>;
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const { studyId } = await params;
  const sp = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(sp.filter ?? "") ? (sp.filter as (typeof FILTERS)[number]) : "all";
  const page = Math.max(0, Number(sp.page) || 0);
  const t = await getTranslations("data");
  const locale = await getLocale();
  const data = await getStudy(studyId);
  if (!data) notFound();
  const { supabase } = await getSession();

  // Summary counts (one lightweight query per bucket).
  const count = async (apply: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    const { count: n } = await apply(base());
    return n ?? 0;
  };
  function base() {
    return supabase.from("participant_sessions").select("id", { count: "exact", head: true }).eq("study_id", studyId);
  }
  const [real, completed, test, excluded, declined, withdrawn, screened] = await Promise.all([
    count((q) => q.eq("is_test", false)),
    count((q) => q.eq("is_test", false).eq("status", "completed")),
    count((q) => q.eq("is_test", true)),
    count((q) => q.eq("is_test", false).eq("excluded", true)),
    count((q) => q.eq("is_test", false).eq("status", "declined")),
    count((q) => q.eq("is_test", false).eq("status", "withdrawn")),
    count((q) => q.eq("is_test", false).eq("status", "screened_out")),
  ]);
  const current = data.versions[0];
  const { data: currentVersion } = current
    ? await supabase.from("study_versions").select("config").eq("id", current.id).single()
    : { data: null };
  const conditions = ((currentVersion?.config as { design?: { conditions?: { id: string; label?: string }[] } } | null)?.design?.conditions ?? []);
  const perCondition = await Promise.all(
    conditions.map(async (c) => ({
      ...c,
      started: await count((q) => q.eq("is_test", false).eq("condition", c.id)),
      completed: await count((q) => q.eq("is_test", false).eq("condition", c.id).eq("status", "completed")),
    })),
  );

  let q = supabase
    .from("participant_sessions")
    .select("id, status, is_test, excluded, exclusion_reason, language, device_class, started_at, ended_at, study_version_id, condition", { count: "exact" })
    .eq("study_id", studyId)
    .order("started_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (filter === "test") q = q.eq("is_test", true);
  else {
    q = q.eq("is_test", false);
    if (filter === "completed") q = q.eq("status", "completed");
    if (filter === "incomplete") q = q.neq("status", "completed");
    if (filter === "excluded") q = q.eq("excluded", true);
  }
  const { data: sessions, count: total } = await q;
  const versionNo = new Map(data.versions.map((v) => [v.id, v.version_number]));
  const pages = Math.ceil((total ?? 0) / PAGE_SIZE);

  const stats = [
    { k: "started", v: real },
    { k: "completed", v: completed },
    { k: "completionRate", v: real ? `${Math.round((completed / real) * 100)}%` : "–" },
    { k: "declined", v: declined },
    { k: "screened", v: screened },
    { k: "withdrawn", v: withdrawn },
    { k: "excluded", v: excluded },
    { k: "test", v: test },
  ];

  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-muted">
        <Link href={`/studio/studies/${studyId}`} className="hover:underline" dir="auto">
          ← {data.study.title}
        </Link>
      </nav>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <StatusBadge status={data.study.status} />
        <span className="flex-1" />
        <Link href={`/studio/studies/${studyId}/analytics`} className="rounded-lg border border-line bg-surface px-2.5 py-1 text-sm hover:bg-paper">
          {t("toAnalytics")}
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8" aria-label={t("summary")}>
        {stats.map((s) => (
          <Card key={s.k} className="p-4">
            <p className="text-xs text-muted">{t(`stats.${s.k}`)}</p>
            <p className="text-2xl font-semibold tabular-nums">{s.v}</p>
          </Card>
        ))}
      </section>
      <p className="-mt-3 text-xs text-muted">{t("statsNote")}</p>

      {perCondition.length > 1 && (
        <Card className="flex flex-col gap-2">
          <h2 className="font-semibold">{t("byCondition")}</h2>
          <table className="w-full max-w-lg text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th scope="col" className="py-1 text-start font-medium">{t("cols.condition")}</th>
                <th scope="col" className="py-1 text-start font-medium">{t("stats.started")}</th>
                <th scope="col" className="py-1 text-start font-medium">{t("stats.completed")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {perCondition.map((c) => (
                <tr key={c.id}>
                  <td className="py-1.5" dir="auto">{c.label || c.id}</td>
                  <td className="py-1.5 tabular-nums">{c.started}</td>
                  <td className="py-1.5 tabular-nums">{c.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("export.title")}</h2>
        <ExportLinks studyId={studyId} hasVersions={data.versions.length > 0} />
      </Card>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">{t("sessions")}</h2>
          <div className="flex flex-wrap gap-1 text-sm">
            {FILTERS.map((f) => (
              <Link
                key={f}
                href={`?filter=${f}`}
                className={f === filter ? "rounded-md bg-accent px-2.5 py-1 text-white" : "rounded-md border border-line bg-surface px-2.5 py-1"}
              >
                {t(`filters.${f}`)}
              </Link>
            ))}
          </div>
        </div>
        {filter === "test" && test > 0 && <DeleteTestSessions studyId={studyId} />}
        {!sessions?.length ? (
          <EmptyState title={t("noSessions")}>{t("noSessionsHint")}</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-paper text-xs text-muted">
                <tr>
                  {["session", "version", "condition", "status", "language", "device", "started", "duration", "flags"].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 text-start font-medium">
                      {t(`cols.${h}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 font-mono text-xs" dir="ltr">
                      {s.id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2">{versionNo.get(s.study_version_id) ?? "–"}</td>
                    <td className="px-3 py-2 font-mono text-xs" dir="ltr">{s.condition ?? "–"}</td>
                    <td className="px-3 py-2">
                      <Badge tone={s.status === "completed" ? "ok" : s.status === "in_progress" ? "neutral" : "warn"}>{t(`sessionStatus.${s.status}`)}</Badge>
                    </td>
                    <td className="px-3 py-2 uppercase">{s.language}</td>
                    <td className="px-3 py-2">{s.device_class ? t(`device.${s.device_class}`) : "–"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(s.started_at).toLocaleString(locale)}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {s.ended_at ? `${Math.round((Date.parse(s.ended_at) - Date.parse(s.started_at)) / 1000)} ${t("sec")}` : "–"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {s.is_test && <Badge tone="accent">{t("testFlag")}</Badge>}
                        {!s.is_test && <ExclusionToggle studyId={studyId} sessionId={s.id} excluded={s.excluded} reason={s.exclusion_reason ?? ""} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-3 text-sm">
            {page > 0 && <Link href={`?filter=${filter}&page=${page - 1}`}>← {t("prev")}</Link>}
            <span className="text-muted">{t("pageOf", { page: page + 1, pages })}</span>
            {page < pages - 1 && <Link href={`?filter=${filter}&page=${page + 1}`}>{t("next")} →</Link>}
          </div>
        )}
      </section>
    </div>
  );
}
