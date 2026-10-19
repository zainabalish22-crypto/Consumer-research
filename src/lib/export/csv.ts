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
