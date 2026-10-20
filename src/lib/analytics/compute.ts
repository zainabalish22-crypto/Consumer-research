/**
 * Basic study analytics, computed from recorded sessions only (the same data
 * the exports use). Pure functions so they can be tested without a database.
 */
import type { Block, LocalizedText, Question, StudyConfig } from "@/lib/study/schema";
import { SPECIAL_CODES, isQuestionBlock } from "@/lib/study/schema";
import { libraryOf } from "@/lib/study/environment";
import { likertValues } from "@/lib/study/answers";
import type { SessionRecord } from "@/lib/export/columns";

export type Label = LocalizedText | string;

export interface Bar {
  label: Label;
  count: number;
}

export type QuestionSummary =
  | { kind: "choice"; blockId: string; variable: string; text: LocalizedText; type: string; n: number; multi: boolean; bars: Bar[] }
  | { kind: "numeric"; blockId: string; variable: string; text: LocalizedText; type: string; n: number; stats: NumericStats; bins: Bar[] }
  | { kind: "matrix"; blockId: string; variable: string; text: LocalizedText; type: string; n: number; rows: { label: LocalizedText; n: number; mean: number | null }[] }
  | { kind: "ranking"; blockId: string; variable: string; text: LocalizedText; type: string; n: number; rows: { label: LocalizedText; n: number; mean: number | null }[] }
  | { kind: "text"; blockId: string; variable: string; text: LocalizedText; type: string; n: number };

export interface NumericStats {
  mean: number | null;
  median: number | null;
  sd: number | null;
  min: number | null;
  max: number | null;
}

export type EnvironmentSummary =
  | { kind: "village"; blockId: string; name: string; n: number; stores: { label: Label; approached: number; entered: number; bought: number }[]; itemsMean: number | null }
  | { kind: "store_choice"; blockId: string; name: string; n: number; bars: Bar[] }
  | { kind: "online_shop"; blockId: string; name: string; n: number; checkedOut: number; checkoutStarted: number; products: { label: Label; viewed: number; detail: number; bought: number }[]; itemsMean: number | null };

export interface Analytics {
  /** Sessions included (after the test / excluded filters). */
  sessions: number;
  totals: { started: number; completed: number; rate: number | null; declined: number; screened: number; withdrawn: number; inProgress: number; medianMinutes: number | null };
  daily: { date: string; started: number; completed: number }[];
  conditions: { id: string; label: string; started: number; completed: number }[];
  devices: Bar[];
  languages: Bar[];
  funnel: { blockId: string; type: string; name: string; reached: number }[];
  timePerBlock: { blockId: string; type: string; name: string; n: number; median: number | null }[];
  questions: QuestionSummary[];
  environments: EnvironmentSummary[];
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function stats(values: number[]): NumericStats {
  if (!values.length) return { mean: null, median: null, sd: null, min: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const sd = values.length > 1 ? Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1)) : null;
  return { mean: round(mean), median: round(median), sd: sd === null ? null : round(sd), min: sorted[0], max: sorted.at(-1)! };
}

/** Up to `count` equal-width bins; integer data with a small range gets one bin per value. */
export function histogram(values: number[], count = 10): Bar[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (values.every(Number.isInteger) && max - min < 15) {
    const out: Bar[] = [];
    for (let v = min; v <= max; v++) out.push({ label: String(v), count: values.filter((x) => x === v).length });
    return out;
  }
  if (min === max) return [{ label: String(min), count: values.length }];
  const width = (max - min) / count;
  const bins = Array.from({ length: count }, (_, i) => ({ from: min + i * width, count: 0 }));
  for (const v of values) bins[Math.min(count - 1, Math.floor((v - min) / width))].count += 1;
  return bins.map((b) => ({ label: `${round(b.from)}–${round(b.from + width)}`, count: b.count }));
}

/** All values of a question's variable, including every repetition level (variable_level). */
function valuesOf(s: SessionRecord, block: Block, variable: string): unknown[] {
  if (!block.repeat) return variable in s.answers ? [s.answers[variable]] : [];
  return Object.entries(s.answers)
    .filter(([k]) => k.startsWith(`${variable}_`))
    .map(([, v]) => v);
}

const special = (q: { special?: { notSure: boolean; preferNot: boolean } }): (Bar & { code: number })[] => [
  ...(q.special?.notSure ? [{ label: "notSure", count: 0, code: SPECIAL_CODES.notSure }] : []),
  ...(q.special?.preferNot ? [{ label: "preferNot", count: 0, code: SPECIAL_CODES.preferNot }] : []),
];

function summarizeQuestion(block: Block, q: Question, sessions: SessionRecord[]): QuestionSummary {
  const base = { blockId: block.id, variable: q.variable, text: q.text, type: q.type };
  const answers = sessions.flatMap((s) => valuesOf(s, block, q.variable)).filter((v) => v !== null && v !== undefined && v !== "");
  switch (q.type) {
    case "single":
    case "dropdown":
    case "multiple":
    case "image_choice":
    case "likert":
    case "semantic": {
      const options: (Bar & { code: number })[] =
        q.type === "likert" || q.type === "semantic"
          ? likertValues(q).map((v, i) => ({
              label: q.type === "likert" && q.labels[i] && (q.labels[i].en || q.labels[i].ar) ? q.labels[i] : String(v),
              count: 0,
              code: v,
            }))
          : q.options.map((o) => ({ label: o.label, count: 0, code: o.value }));
      const all = [...options, ...("special" in q ? special(q) : [])];
      const multi = q.type === "multiple" || (q.type === "image_choice" && q.multiple);
      for (const a of answers) {
        for (const v of Array.isArray(a) ? a : [a]) {
          const bar = all.find((o) => o.code === v);
          if (bar) bar.count += 1;
        }
      }
      return { ...base, kind: "choice", n: answers.length, multi, bars: all.map(({ label, count }) => ({ label, count })) };
    }
    case "numeric":
    case "slider": {
      const nums = answers.filter(isNum).filter((v) => v !== SPECIAL_CODES.notSure && v !== SPECIAL_CODES.preferNot);
      return { ...base, kind: "numeric", n: nums.length, stats: stats(nums), bins: histogram(nums) };
    }
    case "matrix": {
      const rows = q.rows.map((r) => {
        const vals = answers.map((a) => (a as Record<string, unknown>)[r.code]).filter(isNum);
        return { label: r.text, n: vals.length, mean: stats(vals).mean };
      });
      return { ...base, kind: "matrix", n: answers.length, rows };
    }
    case "ranking": {
      const rows = q.options.map((o) => {
        const ranks = answers.filter(Array.isArray).map((a) => (a as number[]).indexOf(o.value) + 1).filter((r) => r > 0);
        return { label: o.label, n: ranks.length, mean: stats(ranks).mean };
      });
      return { ...base, kind: "ranking", n: answers.length, rows };
    }
    default:
      return { ...base, kind: "text", n: answers.length };
  }
}

function summarizeEnvironment(block: Block, cfg: StudyConfig, sessions: SessionRecord[]): EnvironmentSummary | null {
  const lib = libraryOf(cfg);
  const name = block.name || block.type;
  if (block.type === "village") {
    const done = sessions.filter((s) => s.answers[block.variable] !== undefined);
    const baskets = done.map((s) => ((s.answers[block.variable] as { basket?: { store: string; qty: number }[] }).basket ?? []));
    const stores = block.stores.map((sid) => ({
      label: lib.stores[sid]?.name ?? sid,
      approached: sessions.filter((s) => s.env[block.id]?.stores[sid]?.approached).length,
      entered: sessions.filter((s) => s.env[block.id]?.stores[sid]?.entered).length,
      bought: baskets.filter((b) => b.some((l) => l.store === sid)).length,
    }));
    return { kind: "village", blockId: block.id, name, n: done.length, stores, itemsMean: stats(baskets.map((b) => b.reduce((n, l) => n + l.qty, 0))).mean };
  }
  if (block.type === "store_choice") {
    const done = sessions.filter((s) => s.answers[block.variable] !== undefined);
    const bars: Bar[] = block.stores.map((sid) => ({
      label: lib.stores[sid]?.name ?? sid,
      count: done.filter((s) => (s.answers[block.variable] as { store: string | null }).store === sid).length,
    }));
    bars.push({ label: "none", count: done.filter((s) => (s.answers[block.variable] as { store: string | null }).store === null).length });
    return { kind: "store_choice", blockId: block.id, name, n: done.length, bars: block.allowNone ? bars : bars.slice(0, -1) };
  }
  if (block.type === "online_shop") {
    const done = sessions.filter((s) => s.answers[block.variable] !== undefined);
    const carts = done.map((s) => s.answers[block.variable] as { cart?: { product: string; qty: number }[]; checkedOut?: boolean });
    const products = block.products.map((pid) => ({
      label: lib.products[pid]?.name ?? pid,
      viewed: sessions.filter((s) => (s.env[block.id]?.shop?.products[pid]?.views ?? 0) > 0).length,
      detail: sessions.filter((s) => (s.env[block.id]?.shop?.products[pid]?.details ?? 0) > 0).length,
      bought: carts.filter((c) => c.cart?.some((l) => l.product === pid)).length,
    }));
    return {
      kind: "online_shop",
      blockId: block.id,
      name,
      n: done.length,
      checkedOut: carts.filter((c) => c.checkedOut).length,
      checkoutStarted: sessions.filter((s) => s.env[block.id]?.shop?.checkoutStarted).length,
      products,
      itemsMean: stats(carts.map((c) => (c.cart ?? []).reduce((n, l) => n + l.qty, 0))).mean,
    };
  }
  return null;
}

const count = (items: (string | null)[]): Bar[] => {
  const m = new Map<string, number>();
  for (const i of items) m.set(i ?? "unknown", (m.get(i ?? "unknown") ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, count: n }));
};

/**
 * @param config the newest published version; questions and blocks come from it.
 * @param sessions already filtered (test / excluded) by the caller.
 */
export function computeAnalytics(config: StudyConfig, sessions: SessionRecord[]): Analytics {
  const completed = sessions.filter((s) => s.status === "completed");
  const minutes = completed.filter((s) => s.ended_at).map((s) => (Date.parse(s.ended_at!) - Date.parse(s.started_at)) / 60000);

  const byDay = new Map<string, { started: number; completed: number }>();
  for (const s of sessions) {
    const d = s.started_at.slice(0, 10);
    const row = byDay.get(d) ?? { started: 0, completed: 0 };
    row.started += 1;
    if (s.status === "completed") row.completed += 1;
    byDay.set(d, row);
  }

  const reached = (blockId: string) => sessions.filter((s) => (s.blocksDone ?? Object.keys(s.blockSeconds)).some((k) => k === blockId || k.startsWith(`${blockId}#`))).length;
  const contentBlocks = config.blocks.filter((b) => b.type !== "end");

  return {
    sessions: sessions.length,
    totals: {
      started: sessions.length,
      completed: completed.length,
      rate: sessions.length ? round((completed.length / sessions.length) * 100, 1) : null,
      declined: sessions.filter((s) => s.status === "declined").length,
      screened: sessions.filter((s) => s.status === "screened_out").length,
      withdrawn: sessions.filter((s) => s.status === "withdrawn").length,
      inProgress: sessions.filter((s) => s.status === "in_progress").length,
      medianMinutes: stats(minutes).median === null ? null : round(stats(minutes).median!, 1),
    },
    daily: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
    conditions: config.design.conditions.map((c) => ({
      id: c.id,
      label: c.label || c.id,
      started: sessions.filter((s) => s.condition === c.id).length,
      completed: completed.filter((s) => s.condition === c.id).length,
    })),
    devices: count(sessions.map((s) => s.device_class)),
    languages: count(sessions.map((s) => s.language)),
    funnel: contentBlocks.map((b) => ({ blockId: b.id, type: b.type, name: b.name, reached: reached(b.id) })),
    timePerBlock: contentBlocks.map((b) => {
      const secs = sessions.flatMap((s) => Object.entries(s.blockSeconds).filter(([k]) => k === b.id || k.startsWith(`${b.id}#`)).map(([, v]) => v));
      return { blockId: b.id, type: b.type, name: b.name, n: secs.length, median: stats(secs).median };
    }),
    questions: config.blocks.filter(isQuestionBlock).flatMap((b) => b.questions.map((q) => summarizeQuestion(b, q, sessions))),
    environments: config.blocks.map((b) => summarizeEnvironment(b, config, sessions)).filter((x): x is EnvironmentSummary => x !== null),
  };
}
