import type { Assignment, Block, Design, Factor, L10n, Question, Shop, Study } from "./types";
import { shuffle } from "./util";

/**
 * The experimental engine, shared by the server (assignment), the participant runner (what to
 * show) and the exports (which columns exist). Pure functions, so they can be tested alone.
 */

export const NO_ASSIGNMENT: Assignment = { between: {}, orders: {} };

const usable = (f: Factor) => f.levels.length > 0;
export const betweenFactors = (d?: Design) => (d?.factors ?? []).filter((f) => f.kind === "between" && usable(f));
export const withinFactors = (d?: Design) => (d?.factors ?? []).filter((f) => f.kind === "within" && f.levels.length > 1);

/** Every combination of between-subjects levels (one "cell" each); one empty cell without factors. */
export function cells(design?: Design): Record<string, string>[] {
  let out: Record<string, string>[] = [{}];
  for (const f of betweenFactors(design)) out = out.flatMap((c) => f.levels.map((l) => ({ ...c, [f.id]: l.id })));
  return out;
}

export const cellKey = (between: Record<string, string>) =>
  Object.keys(between)
    .sort()
    .map((k) => `${k}=${between[k]}`)
    .join("&");

/** Row r of a cyclic Latin square: the levels starting at position r. Each level appears once per position across rows. */
export const latinRow = <T,>(levels: T[], r: number): T[] => levels.map((_, i) => levels[(r + i) % levels.length]);

export type Usage = { cells: Record<string, number>; rows: Record<string, number[]> };

/** How often each cell and each Latin-square row has been used by the sessions that count. */
export function usageOf(design: Design | undefined, assignments: Assignment[]): Usage {
  const between = betweenFactors(design);
  const usage: Usage = { cells: {}, rows: {} };
  for (const f of withinFactors(design)) usage.rows[f.id] = f.levels.map(() => 0);
  for (const a of assignments) {
    const cell: Record<string, string> = {};
    for (const f of between) if (a.between[f.id]) cell[f.id] = a.between[f.id];
    const key = cellKey(cell);
    usage.cells[key] = (usage.cells[key] ?? 0) + 1;
    for (const f of withinFactors(design)) {
      const first = a.orders[f.id]?.[0];
      const r = f.levels.findIndex((l) => l.id === first);
      if (r >= 0) usage.rows[f.id][r]++;
    }
  }
  return usage;
}

/** The index of a smallest count; ties are broken at random so groups fill evenly. */
function leastUsed(counts: number[], rand: () => number) {
  const min = Math.min(...counts);
  const ties = counts.map((c, i) => (c === min ? i : -1)).filter((i) => i >= 0);
  return ties[Math.floor(rand() * ties.length)];
}

/**
 * Gives a new participant the least-used combination of between-subjects levels, and for each
 * within-subjects factor the least-used Latin-square order.
 */
export function assign(design: Design | undefined, usage: Usage, rand: () => number = Math.random): Assignment {
  const all = cells(design);
  const between = all[leastUsed(all.map((c) => usage.cells[cellKey(c)] ?? 0), rand)];
  const orders: Record<string, string[]> = {};
  for (const f of withinFactors(design)) {
    const counts = usage.rows[f.id] ?? f.levels.map(() => 0);
    orders[f.id] = latinRow(
      f.levels.map((l) => l.id),
      leastUsed(counts, rand),
    );
  }
  return { between, orders };
}

/* ----------------------------------------------------------------------------- what is shown */

export type Step = { block: Block; key: string };

const showsFor = (b: Block, a: Assignment) => !b.showFor || b.showFor.every((c) => !a.between[c.factor] || c.levels.includes(a.between[c.factor]));

/** Replaces {factor name} in a text with the participant's level label. */
function fill(v: L10n | undefined, labels: Record<string, L10n>): L10n | undefined {
  if (!v) return v;
  const out: L10n = {};
  for (const lang of ["en", "ar"] as const) {
    const s = v[lang];
    if (s === undefined) continue;
    out[lang] = s.replace(/\{([\w-]+)\}/g, (m, name: string) => labels[name]?.[lang] ?? labels[name]?.en ?? labels[name]?.ar ?? m);
  }
  return out;
}

/** Level labels by factor name, for the placeholders: between levels, plus the within level being shown. */
function labelsFor(design: Design | undefined, a: Assignment, within?: { factor: string; level: string }) {
  const labels: Record<string, L10n> = {};
  for (const f of design?.factors ?? []) {
    const id = within?.factor === f.id ? within.level : a.between[f.id];
    const l = f.levels.find((x) => x.id === id);
    if (l) labels[f.name] = l.label;
  }
  return labels;
}

function resolveQuestion(q: Question, a: Assignment, labels: Record<string, L10n>, within: { factor: string; level: string; value: string } | undefined, sectionVars: Set<string>): Question {
  const variant = q.variants?.find((v) => (within && v.when.factor === within.factor ? v.when.level === within.level : a.between[v.when.factor] === v.when.level));
  const base: Question = variant ? { ...q, text: variant.text && Object.values(variant.text).some(Boolean) ? variant.text : q.text, help: variant.help ?? q.help, media: variant.media ?? q.media } : q;
  const suffix = (v: string) => (within && sectionVars.has(v) ? `${v}_${within.value}` : v);
  return {
    ...base,
    variants: undefined,
    text: fill(base.text, labels)!,
    help: fill(base.help, labels),
    variable: q.type === "info" ? q.variable : suffix(q.variable),
    showIf: base.showIf && { ...base.showIf, variable: suffix(base.showIf.variable) },
    attention: base.attention,
  };
}

function resolveBlock(b: Block, study: Study, a: Assignment, seed: string, within?: { factor: string; level: string; value: string }): Block {
  const labels = labelsFor(study.design, a, within);
  const withText = { ...b, showFor: undefined, title: fill(b.title, labels)! } as Block;
  if ("body" in withText && withText.body) (withText as { body: L10n }).body = fill(withText.body, labels)!;
  if (withText.type !== "questions") return withText;
  const vars = new Set(withText.questions.map((q) => q.variable));
  let questions = withText.questions.map((q) => resolveQuestion(q, a, labels, within, vars));
  if (withText.shuffleQuestions) questions = shuffle(questions, `${seed}-${b.id}-${within?.level ?? ""}`);
  return { ...withText, description: fill(withText.description, labels), questions, repeatFor: undefined };
}

/**
 * The steps this participant goes through, in order: steps for other conditions left out,
 * marked sections shuffled among their places, and within-subjects sections repeated once per
 * level in the participant's Latin-square order. The same seed always gives the same plan, so
 * a participant who comes back sees the same sequence.
 */
export function planSteps(study: Study, assignment: Assignment | undefined, seed: string): Step[] {
  const a = assignment ?? NO_ASSIGNMENT;
  const blocks = study.blocks.filter((b) => showsFor(b, a));
  const slots = blocks.map((b, i) => (b.type === "questions" && b.shuffleWith ? i : -1)).filter((i) => i >= 0);
  if (slots.length > 1) {
    const moved = shuffle(
      slots.map((i) => blocks[i]),
      `${seed}-sections`,
    );
    slots.forEach((pos, k) => (blocks[pos] = moved[k]));
  }
  const steps: Step[] = [];
  for (const b of blocks) {
    const factor = b.type === "questions" && b.repeatFor ? withinFactors(study.design).find((f) => f.id === b.repeatFor) : undefined;
    if (factor) {
      const order = a.orders[factor.id] ?? factor.levels.map((l) => l.id);
      for (const id of order) {
        const level = factor.levels.find((l) => l.id === id);
        if (level) steps.push({ block: resolveBlock(b, study, a, seed, { factor: factor.id, level: level.id, value: level.value }), key: `${b.id}:${level.id}` });
      }
    } else steps.push({ block: resolveBlock(b, study, a, seed), key: b.id });
  }
  return steps;
}

/** The shop as this participant sees it: each product's price, offer and placement for their condition. */
export function resolveShop(shop: Shop, a: Assignment | undefined): Shop {
  if (!a) return shop;
  return {
    ...shop,
    products: shop.products.map((p) => {
      const v = p.variants?.find((x) => a.between[x.when.factor] === x.when.level);
      if (!v) return p;
      return { ...p, price: v.price ?? p.price, was: v.was ?? p.was, offer: v.offer && Object.values(v.offer).some(Boolean) ? v.offer : p.offer, sponsored: v.sponsored ?? p.sponsored };
    }),
  };
}

/* ----------------------------------------------------------------------------- exports */

/**
 * The questions as they appear in the data: a within-subjects section contributes one copy per
 * level, with "_<level value>" added to each variable and the level named in the label.
 */
export function exportQuestions(study: Study): Question[] {
  return study.blocks.flatMap((b) => {
    if (b.type !== "questions") return [];
    const qs = b.questions.filter((q) => q.type !== "info");
    const factor = b.repeatFor ? withinFactors(study.design).find((f) => f.id === b.repeatFor) : undefined;
    if (!factor) return qs;
    return factor.levels.flatMap((l) =>
      qs.map((q) => ({
        ...q,
        variable: `${q.variable}_${l.value}`,
        text: { en: q.text.en !== undefined ? `${q.text.en} [${l.label.en ?? l.value}]` : undefined, ar: q.text.ar !== undefined ? `${q.text.ar} [${l.label.ar ?? l.value}]` : undefined },
      })),
    );
  });
}

/** Condition columns for the participants file: cond_<factor> (between) and order_<factor> (within). */
export function conditionColumns(design: Design | undefined): { name: string; get: (a: Assignment | undefined) => string }[] {
  const value = (f: Factor, id: string | undefined) => f.levels.find((l) => l.id === id)?.value ?? "";
  return [
    ...betweenFactors(design).map((f) => ({ name: `cond_${f.name}`, get: (a: Assignment | undefined) => value(f, a?.between[f.id]) })),
    ...withinFactors(design).map((f) => ({ name: `order_${f.name}`, get: (a: Assignment | undefined) => (a?.orders[f.id] ?? []).map((id) => value(f, id)).join(">") })),
  ];
}
