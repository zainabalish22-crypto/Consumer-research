import type { Question, Session, Study } from "./types";

/** CSV cell: quoted when needed; UTF-8 safe for Arabic. */
const cell = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

export function questionsOf(study: Study): Question[] {
  return study.blocks.flatMap((b) => (b.type === "questions" ? b.questions.filter((q) => q.type !== "info") : []));
}

/** Answer columns for one question: one column, or one per row (matrix), option (multiple) or rank. */
function columns(q: Question): { name: string; get: (s: Session) => unknown }[] {
  const a = (s: Session) => s.answers[q.variable];
  if (q.type === "matrix")
    return (q.rows ?? []).map((r, i) => ({ name: `${q.variable}_${i + 1}`, get: (s: Session) => (a(s) as Record<string, string> | undefined)?.[r.id] ?? "" }));
  if (q.type === "multiple")
    return (q.options ?? []).map((o) => ({ name: `${q.variable}_${o.value}`, get: (s: Session) => (a(s) === undefined ? "" : (a(s) as string[]).includes(o.value) ? 1 : 0) }));
  if (q.type === "ranking")
    return (q.options ?? []).map((o) => ({ name: `${q.variable}_rank_${o.value}`, get: (s: Session) => { const r = a(s) as string[] | undefined; return r ? r.indexOf(o.value) + 1 : ""; } }));
  return [{ name: q.variable, get: a }];
}

/** Participant-level file: one row per session. */
export function participantsCsv(study: Study, sessions: Session[]) {
  const { header, rows } = participantsTable(study, sessions);
  return csv([header, ...rows]);
}

/** The participant-level table (header and rows), also shown in the studio's table view. */
export function participantsTable(study: Study, sessions: Session[]): { header: string[]; rows: unknown[][] } {
  const qs = questionsOf(study);
  const cols = qs.flatMap(columns);
  const paramKeys = [...new Set(sessions.flatMap((s) => Object.keys(s.params)))].sort();
  const header = ["session_id", "study_version", "test", "status", "lang", "started_at", "finished_at", "duration_s", ...paramKeys.map((k) => `param_${k}`), ...cols.map((c) => c.name), "attention_failed", "basket_items", "basket_value", "products_viewed", "searches"];
  const rows = sessions.map((s) => {
    const dur = s.finishedAt ? Math.round((Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 1000) : "";
    const basket = s.basket ?? [];
    return [
      s.id,
      s.version,
      s.test ? 1 : 0,
      s.status,
      s.lang,
      s.startedAt,
      s.finishedAt ?? "",
      dur,
      ...paramKeys.map((k) => s.params[k] ?? ""),
      ...cols.map((c) => c.get(s)),
      s.flags.length ? s.flags.join(" ") : "",
      basket.reduce((n, b) => n + b.qty, 0),
      basket.reduce((n, b) => n + b.qty * b.price, 0).toFixed(3),
      new Set(s.events.filter((e) => e.type === "product_view").map((e) => e.data?.product)).size,
      s.events.filter((e) => e.type === "search").length,
    ];
  });
  return { header, rows };
}

/** Event log: one row per event. */
export function eventsCsv(sessions: Session[]) {
  const keys = [...new Set(sessions.flatMap((s) => s.events.flatMap((e) => Object.keys(e.data ?? {}))))].sort();
  const header = ["session_id", "test", "t_ms", "event", "block", ...keys];
  const rows = sessions.flatMap((s) => s.events.map((e) => [s.id, s.test ? 1 : 0, e.t, e.type, e.block ?? "", ...keys.map((k) => e.data?.[k] ?? "")]));
  return csv([header, ...rows]);
}

/** Codebook: variable, label in both languages, type, values. */
export function codebookCsv(study: Study) {
  const header = ["variable", "label_en", "label_ar", "type", "values"];
  const rows = questionsOf(study).flatMap((q) => {
    const values = (q.options ?? []).map((o) => `${o.value}=${o.label.en ?? o.label.ar ?? ""}`).join("; ");
    const scale = q.scale ? `1=${q.scale.left.en ?? ""} … ${q.scale.points}=${q.scale.right.en ?? ""}` : q.range ? `${q.range.min}–${q.range.max}` : "";
    return columns(q).map((c) => [c.name, q.text.en ?? "", q.text.ar ?? "", q.type, values || scale]);
  });
  return csv([header, ...rows]);
}

/** Export column names for one question. */
export const columnsOf = (q: Question) => columns(q).map((c) => c.name);

export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: name.endsWith(".sps") ? "text/plain;charset=utf-8" : "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
