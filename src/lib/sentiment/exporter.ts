/**
 * The three files the sentiment tool exports. Built as plain text, so they can be tested
 * without a browser. Every file is UTF-8 with a byte order mark, so Excel shows Arabic.
 */
import { toCsv } from "@/lib/tools/csv";
import { readAlpha, type Agreement } from "./agreement.ts";
import { compare, GROUP_KEYS, summarise, type Rec, type DatasetInput, type GroupKey, type Counts } from "./aggregate.ts";
import type { Sentiment } from "./normalize.ts";

export type Strings = {
  headers: { row: string; text: string; final: string; first: string; second: string; source: string; date: string; group: Record<GroupKey, string> };
  source: { first: string; second: string; researcher: string; none: string };
  status: { counted: string; blank: string; unrecognised: string };
  sentiment: Record<Sentiment, string>;
  summary: { metric: string; value: string; group: string; n: string; mean: string; positive: string; neutral: string; negative: string };
  metrics: { texts: string; net: string; alpha: string; percent: string; pairs: string; disagreements: string; left: string; test: string; p: string; v: string };
  note: { title: string; generated: string; file: string; method: string[]; agreement: string; alphaReading: Record<ReturnType<typeof readAlpha>, string>; cautions: string[]; none: string; labels: { counts: string; net: string; mean: string; alpha: string; percent: string; texts: string; rows: string; columns: string; disagreements: string } };
};

/** One row per uploaded row, including blank and unrecognised ones, with a status column. */
export function dataCsv(d: DatasetInput, recsByRow: Map<number, Rec>, s: Strings): string {
  const resolved = new Map(d.resolved ?? []);
  const header = [s.headers.row, s.headers.text, s.headers.final, s.headers.first, s.headers.second, s.headers.source, ...GROUP_KEYS.map((k) => s.headers.group[k]), s.headers.date];
  const col = (name?: string) => (name ? d.header.indexOf(name) : -1);
  const iText = col(d.mapping.text);
  const iLabel2 = col(d.mapping.label2);
  const iDate = col(d.mapping.date);
  const iGroup = Object.fromEntries(GROUP_KEYS.map((k) => [k, col(d.mapping[k])])) as Record<GroupKey, number>;
  const rows = d.rows.map((r, ri) => {
    const rec = recsByRow.get(ri);
    const status = rec ? s.status.counted : r[col(d.mapping.label)]?.trim() ? s.status.unrecognised : s.status.blank;
    const second = iLabel2 >= 0 ? r[iLabel2] : "";
    const final = rec ? rec.sentiment : "";
    // The final label is the researcher's choice where one was made, otherwise the first coder's.
    const source = !rec ? s.source.none : resolved.has(ri) ? s.source.researcher : s.source.first;
    return [
      ri + 1,
      iText >= 0 ? r[iText] : "",
      rec ? s.sentiment[final as Sentiment] : status,
      rec ? s.sentiment[rec.primary] : "",
      second ? (s.sentiment[second as Sentiment] ?? second) : "",
      source,
      ...GROUP_KEYS.map((k) => (iGroup[k] >= 0 ? r[iGroup[k]] : "")),
      iDate >= 0 ? r[iDate] : "",
    ];
  });
  return toCsv([header, ...rows]);
}

/** Summary figures and the group comparison, one table. */
export function summaryCsv(d: DatasetInput, records: Rec[], numeric: boolean, ag: Agreement | null, leftOut: number, s: Strings): string {
  const total = summarise(records, numeric);
  const rows: (string | number)[][] = [[s.summary.metric, s.summary.value]];
  rows.push([s.metrics.texts, total.n]);
  rows.push([s.sentiment.positive, total.counts.positive], [s.sentiment.neutral, total.counts.neutral], [s.sentiment.negative, total.counts.negative]);
  rows.push([s.metrics.net, total.mean.toFixed(3)]);
  rows.push([s.metrics.left, leftOut]);
  if (ag) {
    rows.push([s.metrics.pairs, ag.pairs], [s.metrics.percent, ag.percent.toFixed(1)], [s.metrics.alpha, ag.alpha === null ? "" : ag.alpha.toFixed(3)]);
    rows.push([s.metrics.disagreements, ag.disagreements.length]);
  }
  for (const k of GROUP_KEYS) {
    if (!d.mapping[k]) continue;
    const c = compare(records, k, numeric);
    rows.push([]);
    rows.push([s.summary.group, s.summary.n, s.summary.positive, s.summary.neutral, s.summary.negative, s.summary.mean, s.headers.group[k]]);
    for (const g of c.groups) rows.push([g.name, g.n, g.counts.positive, g.counts.neutral, g.counts.negative, g.mean.toFixed(3), g.small ? "small" : ""]);
    if (c.test) rows.push([s.metrics.test, `chi2=${c.test.chi2.toFixed(3)}`, `df=${c.test.df}`, `p=${c.test.p.toFixed(4)}`, `V=${c.test.cramersV.toFixed(3)}`]);
  }
  return toCsv(rows);
}

/** Plain-language methods note, to adapt for a methods chapter. */
export function methodNote(d: DatasetInput, total: { n: number; counts: Counts; mean: number }, ag: Agreement | null, numeric: boolean, s: Strings, when: string): string {
  const lines: string[] = [];
  lines.push(`# ${s.note.title}`, "", `${s.note.generated}: ${when}`, `${s.note.file}: ${d.header.length} ${s.note.labels.columns}, ${d.rows.length} ${s.note.labels.rows}`, "");
  lines.push(`## ${s.note.method[0]}`, "", ...s.note.method.slice(1).map((m) => `- ${m}`), "");
  lines.push(`## ${s.note.agreement}`, "");
  const L = s.note.labels;
  if (ag && ag.alpha !== null) lines.push(`- ${L.alpha}: ${ag.alpha.toFixed(3)} (${s.note.alphaReading[readAlpha(ag.alpha)]})`, `- ${ag.percent.toFixed(1)}% ${L.percent} (${ag.pairs} ${L.texts}, ${ag.disagreements.length} ${L.disagreements})`);
  else lines.push(`- ${s.note.none}`);
  lines.push("", `## ${L.counts}`, "", `- ${total.n}: positive ${total.counts.positive}, neutral ${total.counts.neutral}, negative ${total.counts.negative}`, `- ${numeric ? L.mean : L.net}: ${total.mean.toFixed(3)}`, "");
  lines.push(`## ${s.note.cautions[0]}`, "", ...s.note.cautions.slice(1).map((c) => `- ${c}`), "");
  return lines.join("\n");
}
