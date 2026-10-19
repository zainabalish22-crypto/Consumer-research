/**
 * CSV writing. Output is UTF-8 with a byte-order mark so Excel and SPSS open
 * Arabic text correctly; R and Python read it with encoding "UTF-8-BOM"/"utf-8-sig".
 */
import type { Column, SessionRecord } from "./columns";

export const BOM = "﻿";

/** Text cells starting with these characters can execute as spreadsheet formulas. */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown, isText = false): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (isText && FORMULA_START.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: (string | number | null)[][], textColumns: boolean[] = []): string {
  return (
    BOM +
    rows
      .map((row, r) => row.map((v, i) => csvCell(v, r > 0 && textColumns[i])).join(","))
      .join("\r\n") +
    "\r\n"
  );
}

export function wideCsv(columns: Column[], sessions: SessionRecord[]): string {
  const header = columns.map((c) => c.name);
  const body = sessions.map((s) => columns.map((c) => c.cell(s)));
  return toCsv([header, ...body], columns.map((c) => c.type === "string"));
}

/** Long-format event log: one row per event, with the ids involved as separate columns. */
export function eventLogCsv(
  events: { id: number; session_id: string; type: string; block_key: string | null; client_at: string | null; created_at: string; data: Record<string, unknown> }[],
): string {
  const header = ["event_id", "session_id", "type", "step_key", "block_id", "iteration", "client_time_utc", "server_time_utc", "asset_id", "media_time_sec", "progress_pct", "duration_ms", "other"];
  const known = new Set(["asset", "t", "pct", "ms"]);
  const rows = events.map((e) => {
    const [blockId, iteration] = (e.block_key ?? "").split("#");
    const other = Object.fromEntries(Object.entries(e.data ?? {}).filter(([k]) => !known.has(k)));
    return [
      e.id,
      e.session_id,
      e.type,
      e.block_key,
      blockId || null,
      iteration ?? null,
      e.client_at,
      e.created_at,
      (e.data?.asset as string) ?? null,
      typeof e.data?.t === "number" ? (e.data.t as number) : null,
      typeof e.data?.pct === "number" ? (e.data.pct as number) : null,
      typeof e.data?.ms === "number" ? (e.data.ms as number) : null,
      Object.keys(other).length ? JSON.stringify(other) : null,
    ];
  });
  return toCsv([header, ...rows]);
}

export function codebookCsv(columns: Column[]): string {
  const header = [
    "variable",
    "label_en",
    "label_ar",
    "type",
    "measure",
    "values_en",
    "values_ar",
    "source_block",
    "question_type",
    "rule",
  ];
  const rows = columns.map((c) => [
    c.name,
    c.label.en,
    c.label.ar,
    c.type,
    c.measure,
    (c.valueLabels ?? []).map((v) => `${v.value}=${v.en}`).join("; "),
    (c.valueLabels ?? []).map((v) => `${v.value}=${v.ar}`).join("; "),
    c.sourceBlock,
    c.questionType,
    c.rule ?? "",
  ]);
  return toCsv([header, ...rows]);
}
