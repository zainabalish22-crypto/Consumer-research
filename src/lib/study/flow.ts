/**
 * Flow engine: turns a study configuration plus a participant's assignment into
 * the ordered list of steps they see, and evaluates skip/branch rules.
 *
 * The same code runs in the participant's browser, in researcher preview, and
 * in the server route that validates every submission.
 */
import type { Block, Factor, Language, Logic, LogicClause, LocalizedText, StudyConfig } from "./schema";
import { seededShuffle } from "@/lib/random";
import { lt } from "./text";

export type FactorValue = string | string[] | Record<string, string>;

/** Stored per session by the database at start (see start_session). */
export interface Assignment {
  condition: string | null;
  /** Keyed by factor variable name. pick → level value; order → level values in order; mapping → target value → level value. */
  factors: Record<string, FactorValue>;
  /** Order group id → block ids in the order shown. */
  groups: Record<string, string[]>;
}

export const EMPTY_ASSIGNMENT: Assignment = { condition: null, factors: {}, groups: {} };

export interface Step {
  /** Response key: block id, or "blockId#level" for repeated blocks. */
  key: string;
  blockId: string;
  iteration?: { factorId: string; value: string; label: LocalizedText };
}

export interface LogicContext {
  condition: string | null;
  factors: Record<string, FactorValue>;
  /** Flattened answers: variable → value; repeated blocks also add variable_level. */
  answers: Record<string, unknown>;
  params: Record<string, string>;
  iteration?: string;
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function levelsFor(factor: Factor) {
  return factor.kind === "mapping" ? factor.targets : factor.levels;
}

export function resolveSteps(config: StudyConfig, a: Assignment, seed: string): Step[] {
  // 1. Condition-specific blocks.
  let blocks = config.blocks.filter((b) => !b.showTo?.length || (a.condition !== null && b.showTo.includes(a.condition)));

  // 2. Order groups: members keep their slots, filled in the participant's order.
  for (const g of config.design.orderGroups) {
    const slots = blocks.map((b, i) => (b.orderGroup === g.id ? i : -1)).filter((i) => i >= 0);
    if (slots.length < 2) continue;
    const members = slots.map((i) => blocks[i]);
    const assigned = a.groups[g.id];
    let ordered = members;
    if (assigned?.length) {
      const rank = new Map(assigned.map((id, i) => [id, i]));
      ordered = [...members].sort((x, y) => (rank.get(x.id) ?? 999) - (rank.get(y.id) ?? 999));
    } else if (g.method !== "fixed") {
      ordered = seededShuffle(members, `${seed}:group:${g.id}`);
    }
    const next = [...blocks];
    slots.forEach((slot, k) => (next[slot] = ordered[k]));
    blocks = next;
  }

  // 3. Repetition per factor level.
  const steps: Step[] = [];
  for (const b of blocks) {
    const factor = b.repeat ? config.design.factors.find((f) => f.id === b.repeat!.factorId) : undefined;
    if (!factor) {
      steps.push({ key: b.id, blockId: b.id });
      continue;
    }
    let items = levelsFor(factor);
    const order = b.repeat!.order;
    if (order === "random") items = seededShuffle(items, `${seed}:repeat:${b.id}`);
    else if (order === "assigned") {
      const assigned = a.factors[factor.variable];
      if (Array.isArray(assigned)) {
        const rank = new Map(assigned.map((v, i) => [v, i]));
        items = [...items].sort((x, y) => (rank.get(x.value) ?? 999) - (rank.get(y.value) ?? 999));
      }
    }
    for (const it of items) {
      steps.push({ key: `${b.id}#${it.value}`, blockId: b.id, iteration: { factorId: factor.id, value: it.value, label: it.label } });
    }
  }
  return steps;
}

// ---------------------------------------------------------------------------
// Logic
// ---------------------------------------------------------------------------

function leftValue(c: LogicClause, ctx: LogicContext): unknown {
  switch (c.source) {
    case "answer":
      return ctx.answers[c.key];
    case "condition":
      return ctx.condition;
    case "param":
      return ctx.params[c.key];
    case "iteration":
      return ctx.iteration;
    case "factor": {
      // "variable" for pick/order; "variable.target" for one target of a mapping.
      const [variable, target] = c.key.split(".");
      const v = ctx.factors[variable];
      if (target && v && typeof v === "object" && !Array.isArray(v)) return v[target];
      return v;
    }
  }
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
const same = (a: unknown, b: unknown) => a !== undefined && a !== null && String(a) === String(b);

export function evalClause(c: LogicClause, ctx: LogicContext): boolean {
  const left = leftValue(c, ctx);
  const values = Array.isArray(c.value) ? c.value : c.value === undefined ? [] : [c.value];
  switch (c.op) {
    case "answered":
      return !isEmpty(left);
    case "notAnswered":
      return isEmpty(left);
    case "eq":
      return Array.isArray(left) ? false : same(left, values[0]);
    case "neq":
      return Array.isArray(left) ? true : !same(left, values[0]);
    case "in":
      return !Array.isArray(left) && values.some((v) => same(left, v));
    case "notIn":
      return Array.isArray(left) || !values.some((v) => same(left, v));
    case "includes":
      return Array.isArray(left) && values.some((v) => left.some((x) => same(x, v)));
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const l = Number(left);
      const r = Number(values[0]);
      if (isEmpty(left) || !Number.isFinite(l) || !Number.isFinite(r)) return false;
      return c.op === "gt" ? l > r : c.op === "gte" ? l >= r : c.op === "lt" ? l < r : l <= r;
    }
  }
}

export function evalLogic(logic: Logic | undefined, ctx: LogicContext): boolean {
  if (!logic || logic.clauses.length === 0) return true;
  return logic.mode === "any" ? logic.clauses.some((c) => evalClause(c, ctx)) : logic.clauses.every((c) => evalClause(c, ctx));
}

/** Flatten stored responses (step key → answers) into a variable map for logic. */
export function flattenAnswers(responses: Record<string, Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, answers] of Object.entries(responses)) {
    const level = key.includes("#") ? key.split("#")[1] : null;
    for (const [variable, value] of Object.entries(answers ?? {})) {
      if (level) out[`${variable}_${level}`] = value;
      else out[variable] = value;
    }
  }
  return out;
}

export function contextFor(
  a: Assignment,
  responses: Record<string, Record<string, unknown>>,
  params: Record<string, string>,
  step?: Step,
): LogicContext {
  return { condition: a.condition, factors: a.factors, answers: flattenAnswers(responses), params, iteration: step?.iteration?.value };
}

/** Index of the next step after `from` whose block is shown (showIf true), or -1. */
export function nextStepIndex(
  config: StudyConfig,
  steps: Step[],
  from: number,
  a: Assignment,
  responses: Record<string, Record<string, unknown>>,
  params: Record<string, string>,
): number {
  const byId = new Map(config.blocks.map((b) => [b.id, b]));
  for (let j = from + 1; j < steps.length; j++) {
    const block = byId.get(steps[j].blockId);
    if (!block) continue;
    if (evalLogic(block.showIf, contextFor(a, responses, params, steps[j]))) return j;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Piping: {{stimulus}} and {{factor:variable}}
// ---------------------------------------------------------------------------

export function pipe(text: string, config: StudyConfig, a: Assignment, step: Step | undefined, lang: Language, fallback: Language): string {
  if (!text.includes("{{")) return text;
  return text.replace(/\{\{\s*(stimulus|factor:([A-Za-z][A-Za-z0-9_]*))\s*\}\}/g, (m, kind: string, variable?: string) => {
    if (kind === "stimulus") return step?.iteration ? lt(step.iteration.label, lang, fallback) : m;
    const factor = config.design.factors.find((f) => f.variable === variable);
    const v = variable ? a.factors[variable] : undefined;
    if (!factor || typeof v !== "string") return m;
    const level = factor.levels.find((l) => l.value === v);
    return level ? lt(level.label, lang, fallback) : m;
  });
}

/** Find a block by id. */
export function blockById(config: StudyConfig, id: string): Block | undefined {
  return config.blocks.find((b) => b.id === id);
}

// ---------------------------------------------------------------------------
// Preview assignment (researcher preview only; real sessions are assigned by the database)
// ---------------------------------------------------------------------------

export function previewAssignment(config: StudyConfig, seed: string, overrides: Partial<Assignment> = {}): Assignment {
  const conds = config.design.conditions;
  const condition =
    overrides.condition !== undefined ? overrides.condition : conds.length ? seededShuffle(conds, `${seed}:c`)[0].id : null;
  const factors: Record<string, FactorValue> = {};
  for (const f of config.design.factors) {
    if (overrides.factors?.[f.variable] !== undefined) {
      factors[f.variable] = overrides.factors[f.variable];
      continue;
    }
    const values = f.levels.map((l) => l.value);
    const fixed = f.method === "fixed";
    if (f.kind === "pick") factors[f.variable] = fixed ? (f.fixedValue ?? values[0]) : seededShuffle(values, `${seed}:${f.id}`)[0];
    else {
      const order = fixed ? values : seededShuffle(values, `${seed}:${f.id}`);
      factors[f.variable] = f.kind === "order" ? order : Object.fromEntries(f.targets.map((t, i) => [t.value, order[i]]));
    }
  }
  const groups: Record<string, string[]> = {};
  for (const g of config.design.orderGroups) {
    const members = config.blocks.filter((b) => b.orderGroup === g.id).map((b) => b.id);
    groups[g.id] = overrides.groups?.[g.id] ?? (g.method === "fixed" ? members : seededShuffle(members, `${seed}:g:${g.id}`));
  }
  return { condition, factors, groups };
}
