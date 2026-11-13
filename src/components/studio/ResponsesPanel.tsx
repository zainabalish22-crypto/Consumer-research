"use client";

/**
 * The Responses tab, as in Google Forms: a summary with a chart per question, individual
 * responses one at a time, a table of everything, and the downloads (CSV files and SPSS syntax).
 */
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { codebookCsv, download, eventsCsv, participantsCsv, participantsTable, questionsOf } from "@/lib/study/export";
import { onDataChange, repo } from "@/lib/study/repo";
import { spssSyntax } from "@/lib/study/spss";
import type { Answer, L10n, Lang, Question, Session, Study } from "@/lib/study/types";
import { Button, Icon, IconButton } from "./ui";

type View = "summary" | "individual" | "table";

export function ResponsesPanel({ study }: { study: Study }) {
  const t = useTranslations("studio.data");
  const [all, setAll] = useState<Session[]>([]);
  const [includeTest, setIncludeTest] = useState(false);
  const [view, setView] = useState<View>("summary");
  const load = useCallback(() => repo.listSessions(study.id).then(setAll), [study.id]);
  useEffect(() => {
    load();
    return onDataChange(load);
  }, [load]);
  const sessions = useMemo(() => all.filter((s) => includeTest || !s.test), [all, includeTest]);
  const L: Lang = study.languages[0] ?? "en";
  const slug = study.name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "study";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <h2 className="font-display text-3xl font-light">{t("count", { n: sessions.length })}</h2>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-mist">
          <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} className="h-5 w-5 accent-[#FF6A2B]" />
          {t("includeTest")}
        </label>
        <div className="ms-auto flex flex-wrap gap-2" role="group" aria-label={t("downloads")}>
          <Button kind="primary" disabled={!sessions.length} onClick={() => download(`${slug}-participants.csv`, participantsCsv(study, sessions))}>
            {t("participants")}
          </Button>
          <Button disabled={!sessions.length} onClick={() => download(`${slug}-events.csv`, eventsCsv(sessions))}>
            {t("events")}
          </Button>
          <Button onClick={() => download(`${slug}-codebook.csv`, codebookCsv(study))}>{t("codebook")}</Button>
          <Button onClick={() => download(`${slug}-labels.sps`, spssSyntax(study, L))}>{t("spss")}</Button>
        </div>
      </div>

      <div role="tablist" aria-label={t("title")} className="flex gap-1 border-b border-line-2">
        {(["summary", "individual", "table"] as const).map((k) => (
          <button key={k} role="tab" type="button" aria-selected={view === k} onClick={() => setView(k)} className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${view === k ? "border-ice text-photon" : "border-transparent text-faint hover:text-photon"}`}>
            {t(k)}
          </button>
        ))}
      </div>

      {sessions.length === 0 ? (
        <p className="max-w-xl text-dim">{t("empty")}</p>
      ) : view === "summary" ? (
        <Summary study={study} sessions={sessions} L={L} />
      ) : view === "individual" ? (
        <Individual study={study} sessions={sessions} L={L} />
      ) : (
        <Table study={study} sessions={sessions} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

const tx = (v: L10n | undefined, L: Lang) => v?.[L] || v?.en || v?.ar || "";

function useLabels(L: Lang) {
  const ex = useTranslations("studio.extras");
  return (q: Question, value: string) => {
    if (value === "none" || value === "not_sure" || value === "prefer_not") return ex(value);
    return tx(q.options?.find((o) => o.value === value)?.label, L) || value;
  };
}

const answered = (a: Answer | undefined) => a !== undefined && a !== "" && !(Array.isArray(a) && a.length === 0);

/* ------------------------------------------------------------------ summary */

function Summary({ study, sessions, L }: { study: Study; sessions: Session[]; L: Lang }) {
  return (
    <div className="flex flex-col gap-4">
      {questionsOf(study).map((q) => (
        <QuestionSummary key={q.id} q={q} answers={sessions.map((s) => s.answers[q.variable]).filter(answered) as Answer[]} L={L} />
      ))}
    </div>
  );
}

/** One horizontal bar: label, a thin bar from the baseline, and the count as text. */
function Bar({ label, n, total, max }: { label: string; n: number; total: number; max: number }) {
  const pct = total ? Math.round((n / total) * 100) : 0;
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-3 py-1" title={`${label}: ${n} (${pct}%)`}>
      <span className="truncate text-sm text-mist">{label}</span>
      <span className="h-3.5">
        <span className="block h-full min-w-[2px] rounded-e-[4px] bg-ice" style={{ width: `${max ? (n / max) * 100 : 0}%` }} />
      </span>
      <span className="w-24 text-end font-mono text-xs text-dim" dir="ltr">
        {n} · {pct}%
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-faint">{label}</span>
      <span className="font-display text-2xl" dir="ltr">
        {value}
      </span>
    </div>
  );
}

function QuestionSummary({ q, answers, L }: { q: Question; answers: Answer[]; L: Lang }) {
  const t = useTranslations("studio.data");
  const qt = useTranslations("studio.qtypes");
  const label = useLabels(L);
  const n = answers.length;
  let body: React.ReactNode;

  if (n === 0) body = <p className="text-sm text-faint">{t("noAnswers")}</p>;
  else if (q.type === "single" || q.type === "dropdown" || q.type === "image" || q.type === "multiple") {
    const counts = new Map<string, number>();
    for (const o of q.options ?? []) counts.set(o.value, 0);
    for (const a of answers) for (const v of Array.isArray(a) ? a : [String(a)]) counts.set(v, (counts.get(v) ?? 0) + 1);
    const max = Math.max(...counts.values());
    body = <div>{[...counts].map(([v, c]) => <Bar key={v} label={label(q, v)} n={c} total={n} max={max} />)}</div>;
  } else if ((q.type === "likert" || q.type === "semantic") && q.scale) {
    const pts = Array.from({ length: q.scale.points }, (_, i) => String(i + 1));
    const counts = pts.map((p) => answers.filter((a) => String(a) === p).length);
    const nums = answers.map(Number).filter((x) => !Number.isNaN(x));
    const max = Math.max(...counts, 1);
    body = (
      <div className="flex flex-col gap-3">
        <div className="flex h-36 items-end gap-[2px]" role="img" aria-label={pts.map((p, i) => `${p}: ${counts[i]}`).join(", ")}>
          {pts.map((p, i) => (
            <div key={p} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${p}: ${counts[i]} (${Math.round((counts[i] / n) * 100)}%)`}>
              <span className="font-mono text-xs text-dim">{counts[i]}</span>
              <span className="w-full max-w-14 rounded-t-[4px] bg-ice" style={{ height: `${(counts[i] / max) * 75}%`, minHeight: counts[i] ? 2 : 0 }} />
              <span className="font-mono text-xs text-faint">{p}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between gap-4 text-xs text-faint">
          <span>{tx(q.scale.left, L)}</span>
          <span className="text-end">{tx(q.scale.right, L)}</span>
        </div>
        {nums.length > 0 && <Stat label={t("mean")} value={(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)} />}
      </div>
    );
  } else if (q.type === "slider" || q.type === "numeric") {
    const nums = answers.map(Number).filter((x) => !Number.isNaN(x)).sort((a, b) => a - b);
    const mid = nums.length ? (nums.length % 2 ? nums[(nums.length - 1) / 2] : (nums[nums.length / 2 - 1] + nums[nums.length / 2]) / 2) : 0;
    const f = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(2));
    body = nums.length ? (
      <div className="flex flex-wrap gap-x-10 gap-y-3">
        <Stat label={t("mean")} value={f(nums.reduce((a, b) => a + b, 0) / nums.length)} />
        <Stat label={t("median")} value={f(mid)} />
        <Stat label={t("minimum")} value={f(nums[0])} />
        <Stat label={t("maximum")} value={f(nums[nums.length - 1])} />
      </div>
    ) : null;
  } else if (q.type === "matrix") {
    const cols = q.options ?? [];
    body = (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-xs text-faint">
              <td />
              {cols.map((c) => (
                <th key={c.id} scope="col" className="p-2 text-center font-normal">
                  {tx(c.label, L)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(q.rows ?? []).map((r) => (
              <tr key={r.id} className="border-t border-line-2">
                <th scope="row" className="p-2 text-start font-normal text-mist">
                  {tx(r.label, L)}
                </th>
                {cols.map((c) => (
                  <td key={c.id} className="p-2 text-center font-mono" dir="ltr">
                    {answers.filter((a) => (a as Record<string, string>)[r.id] === c.value).length}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } else if (q.type === "ranking") {
    const rows = (q.options ?? [])
      .map((o) => {
        const ranks = answers.map((a) => (a as string[]).indexOf(o.value) + 1).filter((r) => r > 0);
        return { o, avg: ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : 0 };
      })
      .sort((a, b) => a.avg - b.avg);
    body = (
      <div className="flex flex-col">
        <span className="mb-1 text-xs text-faint">{t("avgRank")}</span>
        {rows.map(({ o, avg }) => (
          <div key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-line-2 py-2 text-sm">
            <span className="text-mist">{tx(o.label, L)}</span>
            <span className="font-mono" dir="ltr">
              {avg.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    );
  } else {
    body = (
      <ul className="flex max-h-72 flex-col gap-1.5 overflow-auto">
        {answers.slice(0, 200).map((a, i) => (
          <li key={i} className="rounded-md bg-steel px-3 py-2 text-sm" dir="auto">
            {String(a)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line-2 bg-carbon p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-[17px]" dir="auto">
          {tx(q.text, L) || q.variable}
        </h3>
        <span className="font-mono text-xs text-faint">
          <span dir="ltr">{q.variable}</span> · {qt(q.type)} · {t("answered", { n })}
        </span>
      </div>
      {body}
    </section>
  );
}

/* ------------------------------------------------------------------ individual */

function Individual({ study, sessions, L }: { study: Study; sessions: Session[]; L: Lang }) {
  const t = useTranslations("studio.data");
  const format = useFormatter();
  const label = useLabels(L);
  const [i, setI] = useState(0);
  const at = Math.min(i, sessions.length - 1);
  const s = sessions[at];
  const dur = s.finishedAt ? Math.round((Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 1000) : null;
  const show = (q: Question, a: Answer | undefined): string => {
    if (!answered(a)) return "";
    if (q.type === "matrix") return (q.rows ?? []).map((r) => `${tx(r.label, L)}: ${label(q, (a as Record<string, string>)[r.id] ?? "")}`).join(" · ");
    if (Array.isArray(a)) return a.map((v) => label(q, v)).join(q.type === "ranking" ? " → " : ", ");
    return q.options ? label(q, String(a)) : String(a);
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <IconButton label={t("previous")} disabled={at === 0} onClick={() => setI(at - 1)}>
          <span className="rtl:rotate-180">‹</span>
        </IconButton>
        <span className="font-mono text-sm" aria-live="polite">
          {t("responseOf", { i: at + 1, n: sessions.length })}
        </span>
        <IconButton label={t("next")} disabled={at >= sessions.length - 1} onClick={() => setI(at + 1)}>
          <span className="rtl:rotate-180">›</span>
        </IconButton>
        <span className="ms-auto">
          <IconButton label={t("deleteSession")} onClick={() => window.confirm(t("deleteSession")) && repo.deleteSession(s.id)}>
            {Icon.x}
          </IconButton>
        </span>
      </div>
      <p className="font-mono text-xs text-faint">
        <span dir="ltr">{s.id.slice(0, 8)}</span> · {s.test ? t("test") : t("real")} · {t(s.status === "screened" ? "screened" : s.status)} · {format.dateTime(new Date(s.startedAt), { dateStyle: "medium", timeStyle: "short" })}
        {dur !== null && (
          <>
            {" · "}
            <span dir="ltr">
              {Math.floor(dur / 60)}:{String(dur % 60).padStart(2, "0")}
            </span>
          </>
        )}
        {s.flags.length > 0 && <span className="text-warn"> · {t("flagged")}</span>}
      </p>
      {questionsOf(study).map((q) => {
        const text = show(q, s.answers[q.variable]);
        return (
          <section key={q.id} className="flex flex-col gap-1.5 rounded-lg border border-line-2 bg-carbon p-4">
            <h3 className="text-sm text-dim" dir="auto">
              {tx(q.text, L) || q.variable}
            </h3>
            <p className={text ? "text-[16px]" : "text-sm text-faint"} dir="auto">
              {text || t("notAnswered")}
            </p>
          </section>
        );
      })}
      {s.basket && s.basket.length > 0 && (
        <section className="flex flex-col gap-1.5 rounded-lg border border-line-2 bg-carbon p-4">
          <h3 className="text-sm text-dim">{t("basket")}</h3>
          {s.basket.map((b) => (
            <p key={b.product} dir="auto">
              {tx(study.shop?.products.find((p) => p.id === b.product)?.name, L) || b.product} × {b.qty}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ table */

function Table({ study, sessions }: { study: Study; sessions: Session[] }) {
  const { header, rows } = useMemo(() => participantsTable(study, sessions), [study, sessions]);
  return (
    <div className="max-h-[70vh] overflow-auto rounded-lg border border-line-2">
      <table className="border-collapse text-sm" dir="ltr">
        <thead className="sticky top-0 bg-steel font-mono text-xs text-mist">
          <tr>
            {header.map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap border-b border-line-2 px-3 py-2 text-start font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line-2">
              {r.map((c, j) => (
                <td key={j} className="max-w-[260px] truncate whitespace-nowrap px-3 py-2" dir="auto" title={String(c ?? "")}>
                  {j === 0 ? String(c).slice(0, 8) : String(c ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
