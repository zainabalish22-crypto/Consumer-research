/**
 * Answer validation shared by the participant renderer (instant feedback) and
 * the server route (authoritative check before anything is stored).
 */
import { SPECIAL_CODES, type Question, type QuestionBlock } from "./schema";

export type AnswerValue = number | string | number[] | Record<string, number> | null;
export type AnswerError =
  | "required"
  | "invalid"
  | "min"
  | "max"
  | "tooLong"
  | "selectMin"
  | "selectMax"
  | "sum";

type Result = { ok: true; value: AnswerValue } | { ok: false; error: AnswerError };

const isEmpty = (v: unknown) =>
  v === undefined ||
  v === null ||
  v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

function specialCodes(q: { special?: { notSure: boolean; preferNot: boolean } }): number[] {
  const codes: number[] = [];
  if (q.special?.notSure) codes.push(SPECIAL_CODES.notSure);
  if (q.special?.preferNot) codes.push(SPECIAL_CODES.preferNot);
  return codes;
}

export function likertValues(q: { points: number; startValue: number }): number[] {
  return Array.from({ length: q.points }, (_, i) => q.startValue + i);
}

export function validateAnswer(q: Question, raw: unknown): Result {
  if (isEmpty(raw)) {
    return q.required ? { ok: false, error: "required" } : { ok: true, value: null };
  }

  switch (q.type) {
    case "single":
    case "dropdown": {
      const allowed = [...q.options.map((o) => o.value), ...specialCodes(q)];
      return isInt(raw) && allowed.includes(raw) ? { ok: true, value: raw } : { ok: false, error: "invalid" };
    }
    case "likert": {
      const allowed = [...likertValues(q), ...specialCodes(q)];
      return isInt(raw) && allowed.includes(raw) ? { ok: true, value: raw } : { ok: false, error: "invalid" };
    }
    case "semantic": {
      return isInt(raw) && likertValues(q).includes(raw) ? { ok: true, value: raw } : { ok: false, error: "invalid" };
    }
    case "slider": {
      if (typeof raw !== "number" || !Number.isFinite(raw)) return { ok: false, error: "invalid" };
      if (raw < q.min) return { ok: false, error: "min" };
      if (raw > q.max) return { ok: false, error: "max" };
      return { ok: true, value: raw };
    }
    case "numeric": {
      if (typeof raw !== "number" || !Number.isFinite(raw)) return { ok: false, error: "invalid" };
      if (q.integerOnly && !Number.isInteger(raw)) return { ok: false, error: "invalid" };
      if (q.min !== undefined && raw < q.min) return { ok: false, error: "min" };
      if (q.max !== undefined && raw > q.max) return { ok: false, error: "max" };
      return { ok: true, value: raw };
    }
    case "text": {
      if (typeof raw !== "string") return { ok: false, error: "invalid" };
      const v = raw.trim();
      if (!v) return q.required ? { ok: false, error: "required" } : { ok: true, value: null };
      if (v.length > q.maxLength) return { ok: false, error: "tooLong" };
      return { ok: true, value: v };
    }
    case "date": {
      if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
        return { ok: false, error: "invalid" };
      }
      if (q.min && raw < q.min) return { ok: false, error: "min" };
      if (q.max && raw > q.max) return { ok: false, error: "max" };
      return { ok: true, value: raw };
    }
    case "multiple": {
      if (!Array.isArray(raw) || !raw.every(isInt)) return { ok: false, error: "invalid" };
      const values = [...new Set(raw)];
      const specials = specialCodes(q);
      const chosenSpecial = values.filter((v) => specials.includes(v));
      if (chosenSpecial.length > 0) {
        // A special answer ("not sure", "prefer not to say") is exclusive.
        return values.length === 1 ? { ok: true, value: values } : { ok: false, error: "invalid" };
      }
      const allowed = q.options.map((o) => o.value);
      if (!values.every((v) => allowed.includes(v))) return { ok: false, error: "invalid" };
      if (q.minSelect !== undefined && values.length < q.minSelect) return { ok: false, error: "selectMin" };
      if (q.maxSelect !== undefined && values.length > q.maxSelect) return { ok: false, error: "selectMax" };
      return { ok: true, value: values };
    }
    case "image_choice": {
      const allowed = q.options.map((o) => o.value);
      if (q.multiple) {
        if (!Array.isArray(raw) || !raw.every(isInt)) return { ok: false, error: "invalid" };
        const values = [...new Set(raw)];
        return values.every((v) => allowed.includes(v)) ? { ok: true, value: values } : { ok: false, error: "invalid" };
      }
      return isInt(raw) && allowed.includes(raw) ? { ok: true, value: raw } : { ok: false, error: "invalid" };
    }
    case "ranking": {
      if (!Array.isArray(raw) || !raw.every(isInt)) return { ok: false, error: "invalid" };
      const allowed = q.options.map((o) => o.value).sort((a, b) => a - b);
      const given = [...raw].sort((a, b) => a - b);
      const sameSet = allowed.length === given.length && allowed.every((v, i) => v === given[i]);
      return sameSet ? { ok: true, value: raw } : { ok: false, error: "invalid" };
    }
    case "constant_sum": {
      if (typeof raw !== "object" || Array.isArray(raw) || raw === null) return { ok: false, error: "invalid" };
      const allowed = new Set(q.options.map((o) => String(o.value)));
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (!allowed.has(k) || !isInt(v) || v < 0 || v > q.total) return { ok: false, error: "invalid" };
        if (v > 0) out[k] = v;
      }
      const sum = Object.values(out).reduce((s, v) => s + v, 0);
      if (sum !== q.total) return { ok: false, error: "sum" };
      return { ok: true, value: out };
    }
    case "matrix": {
      if (typeof raw !== "object" || Array.isArray(raw) || raw === null) return { ok: false, error: "invalid" };
      const obj = raw as Record<string, unknown>;
      const colValues = q.columns.map((c) => c.value);
      const rowCodes = q.rows.map((r) => r.code);
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!rowCodes.includes(k) || !isInt(v) || !colValues.includes(v)) return { ok: false, error: "invalid" };
        out[k] = v;
      }
      if (q.required && rowCodes.some((c) => out[c] === undefined)) return { ok: false, error: "required" };
      return { ok: true, value: out };
    }
  }
}

export type BlockValidation =
  | { ok: true; answers: Record<string, AnswerValue> }
  | { ok: false; errors: Record<string, AnswerError> };

/** Validate every answer in a questionnaire/demographics block. Unknown keys are rejected. */
export function validateBlockAnswers(block: QuestionBlock, input: Record<string, unknown>): BlockValidation {
  const errors: Record<string, AnswerError> = {};
  const answers: Record<string, AnswerValue> = {};
  const known = new Set(block.questions.map((q) => q.variable));
  for (const key of Object.keys(input)) {
    if (!known.has(key)) errors[key] = "invalid";
  }
  for (const q of block.questions) {
    const r = validateAnswer(q, input[q.variable]);
    if (r.ok) {
      if (r.value !== null) answers[q.variable] = r.value;
    } else {
      errors[q.variable] = r.error;
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, answers };
}
