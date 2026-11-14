/**
 * Reading a researcher's CSV file, entirely in the browser.
 *
 * Arabic files exported from Excel are often not UTF-8, so the encoding is detected: a byte
 * order mark decides it when present; otherwise strict UTF-8 is tried, then Windows-1256 (the
 * usual Arabic Windows encoding). The separator (comma, semicolon or tab) is detected from the
 * first lines. Damaged rows are reported, never silently dropped or repaired.
 */
export type Encoding = "utf-8" | "utf-16le" | "utf-16be" | "windows-1256";
export type Delimiter = "," | ";" | "\t";

export type ParsedCsv = {
  header: string[];
  /** Data rows, each with exactly header.length cells. */
  rows: string[][];
  delimiter: Delimiter;
  /** 1-based line numbers (as in the file) of rows with the wrong number of cells; skipped. */
  badRows: number[];
  /** Rows that were completely empty; skipped. */
  emptyRows: number;
  /** Header cells that are empty or repeated. */
  headerProblems: { empty: number; duplicates: string[] };
};

export function decodeBytes(bytes: Uint8Array): { text: string; encoding: Encoding } {
  const bom = (...b: number[]) => b.every((v, i) => bytes[i] === v);
  if (bom(0xef, 0xbb, 0xbf)) return { text: new TextDecoder("utf-8").decode(bytes.subarray(3)), encoding: "utf-8" };
  if (bom(0xff, 0xfe)) return { text: new TextDecoder("utf-16le").decode(bytes.subarray(2)), encoding: "utf-16le" };
  if (bom(0xfe, 0xff)) return { text: new TextDecoder("utf-16be").decode(bytes.subarray(2)), encoding: "utf-16be" };
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("windows-1256").decode(bytes), encoding: "windows-1256" };
  }
}

/** Splits text into records, honouring quotes, doubled quotes and line breaks inside quotes. */
function records(text: string, delimiter: string): { cells: string[]; line: number }[] {
  const out: { cells: string[]; line: number }[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let startLine = 1;
  const endCell = () => {
    cells.push(cell);
    cell = "";
  };
  const endRecord = () => {
    endCell();
    out.push({ cells, line: startLine });
    cells = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else {
        if (c === "\n") line++;
        cell += c;
      }
      continue;
    }
    if (c === '"' && cell === "") quoted = true;
    else if (c === delimiter) endCell();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endRecord();
      line++;
      startLine = line;
    } else cell += c;
  }
  if (cell !== "" || cells.length > 0) endRecord();
  return out;
}

/** The separator that splits the first lines most consistently into more than one column. */
export function detectDelimiter(text: string): Delimiter {
  const sample = text.slice(0, 20000);
  let best: Delimiter = ",";
  let bestScore = -1;
  for (const d of [",", ";", "\t"] as const) {
    const recs = records(sample, d).slice(0, 12);
    if (recs.length === 0) continue;
    const n = recs[0].cells.length;
    if (n < 2) continue;
    const consistent = recs.filter((r) => r.cells.length === n).length / recs.length;
    const score = consistent * 1000 + n;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

export function parseCsv(text: string, delimiter: Delimiter = detectDelimiter(text)): ParsedCsv {
  const recs = records(text, delimiter);
  const first = recs.shift();
  const header = (first?.cells ?? []).map((h) => h.trim());
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const h of header) {
    if (h && seen.has(h)) duplicates.add(h);
    seen.add(h);
  }
  const rows: string[][] = [];
  const badRows: number[] = [];
  let emptyRows = 0;
  for (const r of recs) {
    if (r.cells.every((c) => c.trim() === "")) emptyRows++;
    else if (r.cells.length !== header.length) badRows.push(r.line);
    else rows.push(r.cells.map((c) => c.trim()));
  }
  return { header, rows, delimiter, badRows, emptyRows, headerProblems: { empty: header.filter((h) => !h).length, duplicates: [...duplicates] } };
}

/** CSV text for download: UTF-8 with a byte order mark so Excel shows Arabic correctly. */
export function toCsv(rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
