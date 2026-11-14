/**
 * Turning the researcher's labelled rows into the numbers on the results page. Nothing here
 * classifies text: every figure is a count or an average of labels the researcher supplied.
 */
import { readLabel, type Sentiment } from "./normalize.ts";
import { chiSquare, type ChiSquare } from "./stats.ts";

export type GroupKey = "account" | "category" | "language" | "dialect";
export const GROUP_KEYS: GroupKey[] = ["category", "account", "language", "dialect"];

/** The parts of a dataset the calculations need (see session.ts). */
export type DatasetInput = {
  header: string[];
  rows: string[][];
  mapping: Partial<Record<"text" | "label" | "label2" | "date" | GroupKey, string>>;
  custom: [string, Sentiment][];
  resolved?: [number, Sentiment][];
};

/** One counted text. `sentiment` is the final label; `primary` the first coder's label as read. */
export type Rec = { row: number; text: string; sentiment: Sentiment; primary: Sentiment; score: number | null; label2: Sentiment | null; date: string; groups: Record<GroupKey, string> };

export type Counts = Record<Sentiment, number>;
export type Summary = {
  n: number;
  counts: Counts;
  /** Average on a scale from -1 (all negative) to 1 (all positive). */
  mean: number;
};

/** Below this many texts, a group's figures are too unstable to compare. */
export const SMALL_GROUP = 10;

export function buildRecords(d: DatasetInput): { records: Rec[]; blank: number; unread: number; numeric: boolean } {
  const col = (name?: string) => (name ? d.header.indexOf(name) : -1);
  const iText = col(d.mapping.text);
  const iLabel = col(d.mapping.label);
  const iLabel2 = col(d.mapping.label2);
  const iDate = col(d.mapping.date);
  const iGroup = Object.fromEntries(GROUP_KEYS.map((k) => [k, col(d.mapping[k])])) as Record<GroupKey, number>;
  const custom = new Map(d.custom);
  const resolved = new Map(d.resolved ?? []);
  const records: Rec[] = [];
  let blank = 0;
  let unread = 0;
  let scored = 0;
  for (const [ri, r] of d.rows.entries()) {
    const raw = iLabel >= 0 ? r[iLabel] : "";
    if (!raw.trim()) {
      blank++;
      continue;
    }
    const l = readLabel(raw, custom);
    if (!l) {
      unread++;
      continue;
    }
    if (l.score !== null) scored++;
    records.push({
      row: ri,
      text: iText >= 0 ? r[iText] : "",
      sentiment: resolved.get(ri) ?? l.sentiment,
      primary: l.sentiment,
      score: l.score,
      label2: iLabel2 >= 0 ? (readLabel(r[iLabel2], custom)?.sentiment ?? null) : null,
      date: iDate >= 0 ? r[iDate] : "",
      groups: Object.fromEntries(GROUP_KEYS.map((k) => [k, iGroup[k] >= 0 ? r[iGroup[k]].trim() : ""])) as Record<GroupKey, string>,
    });
  }
  // Scores are averaged as given only when every label is a number; otherwise categories are used.
  return { records, blank, unread, numeric: records.length > 0 && scored === records.length };
}

const VALUE: Record<Sentiment, number> = { positive: 1, neutral: 0, negative: -1 };

export function summarise(records: Rec[], numeric: boolean): Summary {
  const counts: Counts = { positive: 0, negative: 0, neutral: 0 };
  let sum = 0;
  for (const r of records) {
    counts[r.sentiment]++;
    sum += numeric && r.score !== null ? r.score : VALUE[r.sentiment];
  }
  return { n: records.length, counts, mean: records.length ? sum / records.length : 0 };
}

export type GroupRow = Summary & { name: string; small: boolean };
export type Comparison = {
  key: GroupKey;
  groups: GroupRow[];
  /** Rows with no value in this column. */
  missing: number;
  /** Test across groups with at least SMALL_GROUP texts; null when fewer than two qualify. */
  test: ChiSquare | null;
  /** How many groups were large enough to enter the test. */
  tested: number;
};

export function compare(records: Rec[], key: GroupKey, numeric: boolean): Comparison {
  const by = new Map<string, Rec[]>();
  let missing = 0;
  for (const r of records) {
    const g = r.groups[key];
    if (!g) {
      missing++;
      continue;
    }
    if (!by.has(g)) by.set(g, []);
    by.get(g)!.push(r);
  }
  const groups = [...by]
    .map(([name, recs]) => ({ name, ...summarise(recs, numeric), small: recs.length < SMALL_GROUP }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  const big = groups.filter((g) => !g.small);
  return { key, groups, missing, test: chiSquare(big.map((g) => [g.counts.positive, g.counts.neutral, g.counts.negative])), tested: big.length };
}

export type TrendPoint = Summary & { start: string };
export type Trend = { unit: "day" | "week" | "month"; points: TrendPoint[]; unreadDates: number };

/**
 * Dates are read only in year-first forms (2026-03-14, 2026/03/14, with or without a time),
 * because 03/04/2026 means different days in different countries and guessing would be wrong
 * for half the files. Other forms are counted as unread and reported.
 */
export function parseDate(s: string): Date | null {
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(s.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date : null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function trend(records: Rec[], numeric: boolean): Trend | null {
  const dated: { t: Date; r: Rec }[] = [];
  let unreadDates = 0;
  for (const r of records) {
    if (!r.date.trim()) continue;
    const t = parseDate(r.date);
    if (t) dated.push({ t, r });
    else unreadDates++;
  }
  if (dated.length === 0) return unreadDates ? { unit: "day", points: [], unreadDates } : null;
  const times = dated.map((x) => x.t.getTime());
  const days = (Math.max(...times) - Math.min(...times)) / 864e5;
  const unit = days <= 31 ? "day" : days <= 180 ? "week" : "month";
  const bucket = (d: Date) => {
    if (unit === "day") return iso(d);
    if (unit === "month") return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
    // Weeks start on Monday.
    const back = (d.getUTCDay() + 6) % 7;
    return iso(new Date(d.getTime() - back * 864e5));
  };
  const by = new Map<string, Rec[]>();
  for (const { t, r } of dated) {
    const k = bucket(t);
    if (!by.has(k)) by.set(k, []);
    by.get(k)!.push(r);
  }
  const points = [...by].sort(([a], [b]) => a.localeCompare(b)).map(([start, recs]) => ({ start, ...summarise(recs, numeric) }));
  return { unit, points, unreadDates };
}
