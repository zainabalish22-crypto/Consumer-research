import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getSession, getStudy } from "@/lib/data";
import { loadExportData } from "@/lib/export/load";
import { computeAnalytics, type Bar, type Label } from "@/lib/analytics/compute";
import type { Language } from "@/lib/study/schema";
import { lt } from "@/lib/study/text";
import { Card, EmptyState } from "@/components/ui";
import { StatusBadge } from "../../../StatusBadge";
import { Funnel, GroupedColumns, Ring, StackedBar } from "./charts";

/**
 * Basic analytics from recorded sessions. Charts are plain HTML bars with the
 * numbers written next to them, so they work with screen readers, RTL and
 * print, and add no chart library to the bundle.
 */
export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ studyId: string }>;
  searchParams: Promise<{ test?: string; excluded?: string }>;
}) {
  const { studyId } = await params;
  const sp = await searchParams;
  const includeTest = sp.test === "1";
  const includeExcluded = sp.excluded === "1";
  const t = await getTranslations("analytics");
  const td = await getTranslations("data");
  const tb = await getTranslations("builder.blockTypes");
  const locale = (await getLocale()) as Language;
  const data = await getStudy(studyId);
  if (!data) notFound();
  const { supabase } = await getSession();

  const L = (x: Label) => (typeof x === "string" ? x : lt(x, locale, locale === "ar" ? "en" : "ar"));
  const header = (
    <>
      <nav className="text-sm text-muted">
        <Link href={`/studio/studies/${studyId}`} className="hover:underline" dir="auto">
          ← {data.study.title}
        </Link>
      </nav>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <StatusBadge status={data.study.status} />
        <span className="flex-1" />
        <Link href={`/studio/studies/${studyId}/data`} className="rounded-lg border border-line bg-surface px-2.5 py-1 text-sm hover:bg-paper">
          {t("toData")}
        </Link>
      </div>
    </>
  );

  if (!data.versions.length) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <EmptyState title={t("notPublished")}>{t("notPublishedHint")}</EmptyState>
      </div>
    );
  }

  const exp = await loadExportData(supabase, studyId, includeTest);
  const sessions = exp.sessions.filter((s) => includeExcluded || !s.excluded);
  const a = computeAnalytics(exp.versions[0].config, sessions);
  const testCount = sessions.filter((s) => s.is_test).length;

  const toggle = (key: "test" | "excluded", on: boolean) => {
    const q = new URLSearchParams();
    if (key === "test" ? !on : includeTest) q.set("test", "1");
    if (key === "excluded" ? !on : includeExcluded) q.set("excluded", "1");
    const s = q.toString();
    return s ? `?${s}` : "?";
  };
  const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "–");
  const blockName = (b: { name: string; type: string }) => b.name || tb(b.type);
  const fmt = (n: number | null, d = 1) => (n === null ? "–" : n.toLocaleString(locale, { maximumFractionDigits: d }));

  return (
    <div className="flex flex-col gap-6">
      {header}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={toggle("test", includeTest)} className={includeTest ? "rounded-md bg-accent px-2.5 py-1 text-white" : "rounded-md border border-line bg-surface px-2.5 py-1"} aria-pressed={includeTest}>
          {t("includeTest")}
        </Link>
        <Link href={toggle("excluded", includeExcluded)} className={includeExcluded ? "rounded-md bg-accent px-2.5 py-1 text-white" : "rounded-md border border-line bg-surface px-2.5 py-1"} aria-pressed={includeExcluded}>
          {t("includeExcluded")}
        </Link>
      </div>
      <p className="-mt-3 text-xs text-muted">{t("note", { version: exp.versions[0].version_number })}</p>
      {includeTest && testCount > 0 && (
        <p role="note" className="rounded-lg border border-[#d97706]/40 bg-[#fffbeb] px-3 py-2 text-sm text-[#92400e]">
          {t("testWarning", { n: testCount })}
        </p>
      )}

      {a.sessions === 0 ? (
        <EmptyState title={t("noData")}>{t("noDataHint")}</EmptyState>
      ) : (
        <>
          <section className="flex flex-col gap-2" aria-label={t("summary")}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card className="p-4">
                <p className="text-sm text-muted">{t("stats.started")}</p>
                <p className="text-3xl font-bold tabular-nums">{fmt(a.totals.started, 0)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted">{t("stats.completed")}</p>
                <p className="text-3xl font-bold tabular-nums">{fmt(a.totals.completed, 0)}</p>
              </Card>
              <Card className="flex items-center gap-3 p-4">
                <Ring pct={a.totals.rate} label={a.totals.rate === null ? t("stats.completionRate") : `${fmt(a.totals.rate)}%`} />
                <div>
                  <p className="text-sm text-muted">{t("stats.completionRate")}</p>
                  <p className="text-3xl font-bold tabular-nums">{a.totals.rate === null ? "–" : `${fmt(a.totals.rate, 0)}%`}</p>
                </div>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted">{t("stats.medianMinutes")}</p>
                <p className="text-3xl font-bold tabular-nums">{fmt(a.totals.medianMinutes)}</p>
              </Card>
            </div>
            <p className="flex flex-wrap gap-x-5 gap-y-1 px-1 text-sm text-muted">
              {(["inProgress", "declined", "screened", "withdrawn"] as const).map((k) => (
                <span key={k}>
                  {t(`stats.${k}`)}: <span className="font-semibold text-ink tabular-nums">{fmt(a.totals[k], 0)}</span>
                </span>
              ))}
            </p>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title={t("overTime")}>
              <BarTable
                head={[t("date"), t("stats.started"), t("stats.completed")]}
                rows={a.daily.slice(-60).map((d) => ({
                  key: d.date,
                  label: new Date(`${d.date}T00:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" }),
                  value: d.started,
                  extra: [String(d.completed)],
                }))}
                max={Math.max(...a.daily.map((d) => d.started))}
              />
              {a.daily.length > 60 && <p className="text-xs text-muted">{t("lastDays", { n: 60 })}</p>}
            </Section>

            {a.conditions.length > 0 && (
              <Section title={t("byCondition")}>
                <GroupedColumns
                  series={[t("stats.started"), t("stats.completed")]}
                  groups={a.conditions.map((c) => ({
                    key: c.id,
                    label: c.label,
                    values: [c.started, c.completed],
                    caption: t("conditionCaption", { started: c.started, completed: c.completed, rate: pct(c.completed, c.started) }),
                  }))}
                />
              </Section>
            )}

            <Section title={t("devices")}>
              <BarTable
                head={[td("cols.device"), t("sessions")]}
                rows={a.devices.map((d) => ({ key: String(d.label), label: d.label === "unknown" ? "–" : td(`device.${d.label}`), value: d.count, extra: [] }))}
                max={a.sessions}
              />
              <BarTable
                head={[td("cols.language"), t("sessions")]}
                rows={a.languages.map((d) => ({ key: String(d.label), label: String(d.label).toUpperCase(), value: d.count, extra: [] }))}
                max={a.sessions}
              />
            </Section>
          </div>

          <Section title={t("funnel")} hint={t("funnelHint")}>
            <Funnel
              total={a.totals.started}
              rows={a.funnel.map((f, i) => ({ key: f.blockId, label: `${i + 1}. ${blockName(f)}`, value: f.reached }))}
              dropNote={(from, to, lost) => t("biggestDrop", { from, to, n: lost })}
            />
          </Section>

          <Section title={t("timePerBlock")} hint={t("timeHint")}>
            <BarTable
              head={[t("block"), t("medianSeconds"), "n"]}
              rows={a.timePerBlock
                .filter((b) => b.n > 0)
                .map((b) => ({ key: b.blockId, label: blockName(b), value: b.median ?? 0, display: fmt(b.median), extra: [String(b.n)] }))}
              max={Math.max(1, ...a.timePerBlock.map((b) => b.median ?? 0))}
            />
          </Section>

          {a.environments.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">{t("shopping")}</h2>
              {a.environments.map((e) => (
                <Section key={e.blockId} title={e.name === e.kind ? tb(e.kind) : e.name} hint={t("envN", { n: e.n })}>
                  {e.kind === "village" && (
                    <>
                      <BarTable
                        head={[t("store"), t("entered"), t("approached"), t("boughtFrom")]}
                        rows={e.stores.map((s, i) => ({ key: String(i), label: L(s.label), value: s.entered, extra: [String(s.approached), String(s.bought)] }))}
                        max={a.sessions}
                      />
                      <p className="text-sm text-muted">{t("itemsMean", { n: fmt(e.itemsMean) })}</p>
                    </>
                  )}
                  {e.kind === "store_choice" && (
                    <BarTable
                      head={[t("store"), t("chosen"), "%"]}
                      rows={e.bars.map((b, i) => ({ key: String(i), label: b.label === "none" ? t("none") : L(b.label), value: b.count, extra: [pct(b.count, e.n)] }))}
                      max={e.n}
                    />
                  )}
                  {e.kind === "social_feed" && (
                    <BarTable
                      head={[t("post"), t("likedCount"), t("savedCount"), t("hiddenCount"), t("medianSeconds")]}
                      rows={e.posts.map((p, i) => ({ key: String(i), label: L(p.label), value: p.liked, extra: [String(p.saved), String(p.hidden), fmt(p.medianSec)] }))}
                      max={Math.max(1, e.n)}
                    />
                  )}
                  {e.kind === "online_shop" && (
                    <>
                      <p className="text-sm">
                        {t("checkoutLine", { started: e.checkoutStarted, done: e.checkedOut, n: e.n })} · {t("itemsMean", { n: fmt(e.itemsMean) })}
                      </p>
                      <BarTable
                        head={[t("product"), t("bought"), t("seen"), t("pageOpened")]}
                        rows={e.products.map((p, i) => ({ key: String(i), label: L(p.label), value: p.bought, extra: [String(p.viewed), String(p.detail)] }))}
                        max={Math.max(1, e.n)}
                      />
                    </>
                  )}
                </Section>
              ))}
            </section>
          )}

          {a.questions.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">{t("questions")}</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {a.questions.map((q) => (
                  <Section key={`${q.blockId}:${q.variable}`} title={L(q.text) || q.variable} hint={`${q.variable} · n = ${q.n}`}>
                    {q.kind === "choice" && !q.multi && (
                      <StackedBar
                        total={q.n}
                        parts={q.bars.map((b: Bar, i) => ({
                          key: String(i),
                          label: b.label === "notSure" ? t("notSure") : b.label === "preferNot" ? t("preferNot") : L(b.label),
                          count: b.count,
                        }))}
                      />
                    )}
                    {q.kind === "choice" && q.multi && (
                      <>
                        <BarTable
                          head={[t("answer"), t("count"), "%"]}
                          rows={q.bars.map((b: Bar, i) => ({
                            key: String(i),
                            label: b.label === "notSure" ? t("notSure") : b.label === "preferNot" ? t("preferNot") : L(b.label),
                            value: b.count,
                            extra: [pct(b.count, q.n)],
                          }))}
                          max={Math.max(1, q.n)}
                        />
                        {q.multi && <p className="text-xs text-muted">{t("multiNote")}</p>}
                      </>
                    )}
                    {q.kind === "numeric" && (
                      <>
                        <p className="text-sm tabular-nums">
                          {t("numericLine", { mean: fmt(q.stats.mean, 2), median: fmt(q.stats.median, 2), sd: fmt(q.stats.sd, 2), min: fmt(q.stats.min, 2), max: fmt(q.stats.max, 2) })}
                        </p>
                        <BarTable head={[t("value"), t("count")]} rows={q.bins.map((b, i) => ({ key: String(i), label: String(b.label), value: b.count, extra: [] }))} max={Math.max(1, ...q.bins.map((b) => b.count))} />
                      </>
                    )}
                    {(q.kind === "matrix" || q.kind === "ranking") && (
                      <BarTable
                        head={[t("item"), q.kind === "matrix" ? t("mean") : t("meanRank"), "n"]}
                        rows={q.rows.map((r, i) => ({ key: String(i), label: L(r.label), value: r.mean ?? 0, display: fmt(r.mean, 2), extra: [String(r.n)] }))}
                        max={Math.max(1, ...q.rows.map((r) => r.mean ?? 0))}
                      />
                    )}
                    {q.kind === "text" && <p className="text-sm text-muted">{t("textNote")}</p>}
                  </Section>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="flex min-w-0 flex-col gap-3">
      <div>
        <h3 className="font-semibold" dir="auto">
          {title}
        </h3>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}

/** A table whose first numeric column is also drawn as a bar (decorative; the number is the data). */
function BarTable({
  head,
  rows,
  max,
}: {
  head: string[];
  rows: { key: string; label: string; value: number; display?: string; extra: string[] }[];
  max: number;
}) {
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className={i === 0 ? "py-1 text-start font-medium" : "py-1 ps-3 text-end font-medium"}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="align-middle">
              <th scope="row" className="w-1/2 py-1 pe-2 text-start font-normal">
                <span className="block truncate" dir="auto" title={r.label}>
                  {r.label}
                </span>
                <span aria-hidden className="mt-0.5 block h-2 rounded-full bg-paper">
                  <span className="block h-2 rounded-full bg-accent" style={{ width: `${max > 0 ? Math.min(100, (r.value / max) * 100) : 0}%` }} />
                </span>
              </th>
              <td className="py-1 ps-3 text-end tabular-nums">{r.display ?? r.value}</td>
              {r.extra.map((x, i) => (
                <td key={i} className="py-1 ps-3 text-end tabular-nums text-muted">
                  {x}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
