import { describe, expect, it } from "vitest";
import { validateAnswer, validateBlockAnswers } from "@/lib/study/answers";
import { newQuestion } from "@/lib/study/factories";
import type { Question, QuestionBlock } from "@/lib/study/schema";

const q = <T extends Question["type"]>(type: T, patch: Partial<Extract<Question, { type: T }>> = {}) =>
  ({ ...newQuestion(type, "v"), ...patch }) as Extract<Question, { type: T }>;

describe("answer validation", () => {
  it("enforces required answers and allows skipping optional ones", () => {
    expect(validateAnswer(q("single"), undefined)).toEqual({ ok: false, error: "required" });
    expect(validateAnswer(q("single", { required: false }), undefined)).toEqual({ ok: true, value: null });
  });

  it("accepts only configured option codes, plus enabled special codes", () => {
    const s = q("single");
    expect(validateAnswer(s, 2).ok).toBe(true);
    expect(validateAnswer(s, 9).ok).toBe(false);
    expect(validateAnswer(s, -98).ok).toBe(false);
    expect(validateAnswer(q("single", { special: { notSure: true, preferNot: false } }), -98).ok).toBe(true);
  });

  it("validates Likert points from the configured start value", () => {
    const l = q("likert", { points: 7, startValue: 0 });
    expect(validateAnswer(l, 0).ok).toBe(true);
    expect(validateAnswer(l, 6).ok).toBe(true);
    expect(validateAnswer(l, 7).ok).toBe(false);
  });

  it("treats special answers in multiple choice as exclusive", () => {
    const m = q("multiple", { special: { notSure: true, preferNot: false }, maxSelect: 2 });
    expect(validateAnswer(m, [1, 2]).ok).toBe(true);
    expect(validateAnswer(m, [1, 2, 3])).toEqual({ ok: false, error: "selectMax" });
    expect(validateAnswer(m, [-98]).ok).toBe(true);
    expect(validateAnswer(m, [1, -98]).ok).toBe(false);
  });

  it("checks numeric ranges and integers", () => {
    const n = q("numeric", { min: 18, max: 99, integerOnly: true });
    expect(validateAnswer(n, 30).ok).toBe(true);
    expect(validateAnswer(n, 17)).toEqual({ ok: false, error: "min" });
    expect(validateAnswer(n, 30.5)).toEqual({ ok: false, error: "invalid" });
    expect(validateAnswer(n, "30")).toEqual({ ok: false, error: "invalid" });
  });

  it("trims text and enforces length; Arabic text is kept as is", () => {
    const t = q("text", { maxLength: 10 });
    expect(validateAnswer(t, "  مرحبا  ")).toEqual({ ok: true, value: "مرحبا" });
    expect(validateAnswer(t, "x".repeat(11))).toEqual({ ok: false, error: "tooLong" });
  });

  it("requires a full permutation for ranking", () => {
    const r = q("ranking");
    expect(validateAnswer(r, [3, 1, 2]).ok).toBe(true);
    expect(validateAnswer(r, [1, 1, 2]).ok).toBe(false);
    expect(validateAnswer(r, [1, 2]).ok).toBe(false);
  });

  it("validates matrix rows and columns", () => {
    const m = q("matrix");
    expect(validateAnswer(m, { "1": 5, "2": 1 }).ok).toBe(true);
    expect(validateAnswer(m, { "1": 5 })).toEqual({ ok: false, error: "required" });
    expect(validateAnswer(m, { "1": 9, "2": 1 }).ok).toBe(false);
    expect(validateAnswer(m, { "1": 5, "2": 1, evil: 1 }).ok).toBe(false);
  });

  it("validates dates", () => {
    const d = q("date", { min: "2000-01-01" });
    expect(validateAnswer(d, "2020-05-01").ok).toBe(true);
    expect(validateAnswer(d, "1999-12-31")).toEqual({ ok: false, error: "min" });
    expect(validateAnswer(d, "01/05/2020").ok).toBe(false);
  });

  it("rejects unknown variables at block level", () => {
    const block = {
      id: "b1",
      name: "",
      type: "questionnaire",
      questions: [q("likert")],
      randomizeQuestions: false,
    } as QuestionBlock;
    expect(validateBlockAnswers(block, { v: 3 })).toEqual({ ok: true, answers: { v: 3 } });
    const bad = validateBlockAnswers(block, { v: 3, injected: "x" });
    expect(bad.ok).toBe(false);
  });
});
