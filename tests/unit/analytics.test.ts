import { describe, expect, it } from "vitest";
import { StudyConfig } from "@/lib/study/schema";
import { computeAnalytics, histogram, stats } from "@/lib/analytics/compute";
import type { SessionRecord } from "@/lib/export/columns";

const T = (en: string) => ({ en, ar: "" });

const config = StudyConfig.parse({
  schemaVersion: 1,
  settings: { languages: ["en"], defaultLanguage: "en" },
  design: { conditions: [{ id: "a", label: "A" }, { id: "b", label: "B" }], factors: [], orderGroups: [] },
  blocks: [
    { id: "w", type: "welcome", heading: T("Hi"), body: T("") },
    {
      id: "q",
      type: "questionnaire",
      heading: T(""),
      questions: [
        { id: "q1", variable: "like", type: "likert", text: T("Liking"), points: 5, special: { notSure: true, preferNot: false } },
        { id: "q2", variable: "pick", type: "multiple", text: T("Pick"), options: [{ id: "o1", value: 1, label: T("One") }, { id: "o2", value: 2, label: T("Two") }] },
        { id: "q3", variable: "age", type: "numeric", text: T("Age") },
        { id: "q4", variable: "grid", type: "matrix", text: T("Grid"), rows: [{ id: "r1", code: "r1", text: T("Row") }], columns: [{ value: 1, label: T("1") }, { value: 2, label: T("2") }] },
        { id: "q5", variable: "rank", type: "ranking", text: T("Rank"), options: [{ id: "x", value: 1, label: T("X") }, { id: "y", value: 2, label: T("Y") }] },
        { id: "q6", variable: "why", type: "text", text: T("Why") },
      ],
    },
    { id: "e", type: "end", heading: T("Bye"), body: T("") },
  ],
});

const session = (over: Partial<SessionRecord>): SessionRecord =>
  ({
    id: crypto.randomUUID(),
    status: "completed",
    is_test: false,
    excluded: false,
    language: "en",
    device_class: "mobile",
    started_at: "2026-10-20T10:00:00Z",
    ended_at: "2026-10-20T10:10:00Z",
    condition: "a",
    answers: {},
    blockSeconds: {},
    blocksDone: [],
    media: {},
    env: {},
    ...over,
  }) as SessionRecord;

describe("analytics", () => {
  it("summarises statistics and histograms", () => {
    expect(stats([1, 2, 3, 4])).toEqual({ mean: 2.5, median: 2.5, sd: 1.29, min: 1, max: 4 });
    expect(stats([])).toEqual({ mean: null, median: null, sd: null, min: null, max: null });
    expect(histogram([1, 1, 3]).map((b) => b.count)).toEqual([2, 0, 1]);
    expect(histogram([0, 100], 4)).toHaveLength(4);
  });

  it("computes totals, conditions, funnel, timing and question distributions", () => {
    const sessions = [
      session({ answers: { like: 5, pick: [1, 2], age: 30, grid: { r1: 2 }, rank: [2, 1], why: "x" }, blocksDone: ["w", "q"], blockSeconds: { w: 4, q: 60 } }),
      session({ condition: "b", answers: { like: -98, pick: [1], age: 40, grid: { r1: 1 }, rank: [1, 2] }, blocksDone: ["w", "q"], blockSeconds: { w: 6, q: 40 }, started_at: "2026-10-21T09:00:00Z", ended_at: "2026-10-21T09:20:00Z" }),
      session({ condition: "b", status: "in_progress", ended_at: null, device_class: "desktop", blocksDone: ["w"], blockSeconds: { w: 5 }, started_at: "2026-10-21T11:00:00Z" }),
    ];
    const a = computeAnalytics(config, sessions);
    expect(a.totals).toMatchObject({ started: 3, completed: 2, rate: 66.7, inProgress: 1, medianMinutes: 15 });
    expect(a.daily).toEqual([
      { date: "2026-10-20", started: 1, completed: 1 },
      { date: "2026-10-21", started: 2, completed: 1 },
    ]);
    expect(a.conditions).toEqual([
      { id: "a", label: "A", started: 1, completed: 1 },
      { id: "b", label: "B", started: 2, completed: 1 },
    ]);
    expect(a.devices).toEqual([{ label: "mobile", count: 2 }, { label: "desktop", count: 1 }]);
    expect(a.funnel.map((f) => f.reached)).toEqual([3, 2]);
    expect(a.timePerBlock.map((b) => b.median)).toEqual([5, 50]);

    const q = Object.fromEntries(a.questions.map((x) => [x.variable, x]));
    const like = q.like.kind === "choice" ? q.like : null;
    expect(like?.bars.map((b) => b.count)).toEqual([0, 0, 0, 0, 1, 1]); // 1..5 plus "not sure"
    expect(like?.bars.at(-1)?.label).toBe("notSure");
    expect(q.pick.kind === "choice" && q.pick.multi && q.pick.bars.map((b) => b.count)).toEqual([2, 1]);
    expect(q.age.kind === "numeric" && q.age.stats.mean).toBe(35);
    expect(q.grid.kind === "matrix" && q.grid.rows[0].mean).toBe(1.5);
    expect(q.rank.kind === "ranking" && q.rank.rows.map((r) => r.mean)).toEqual([1.5, 1.5]);
    expect(q.why).toMatchObject({ kind: "text", n: 1 });
  });

  it("is empty but well-formed without sessions", () => {
    const a = computeAnalytics(config, []);
    expect(a.totals.rate).toBeNull();
    expect(a.totals.medianMinutes).toBeNull();
    expect(a.funnel.every((f) => f.reached === 0)).toBe(true);
  });
});
