import { describe, expect, it } from "vitest";
import { StudyConfig, exportVariableNames, type SocialFeedBlock } from "@/lib/study/schema";
import { newBlock, newQuestion } from "@/lib/study/factories";
import { validateAnswer } from "@/lib/study/answers";
import { validateFeedAnswer } from "@/lib/study/envAnswers";
import { buildColumns, type SessionRecord } from "@/lib/export/columns";
import { computeAnalytics } from "@/lib/analytics/compute";

const T = (en: string) => ({ en, ar: "" });
const base = () =>
  StudyConfig.parse({
    schemaVersion: 1,
    settings: { languages: ["en"], defaultLanguage: "en" },
    blocks: [{ id: "e", type: "end", heading: T("Bye"), body: T("") }],
  });

describe("social feed", () => {
  const cfg = base();
  const feed = newBlock("social_feed", cfg) as SocialFeedBlock;
  cfg.blocks.unshift(feed);
  const parsed = StudyConfig.parse(cfg);
  const block = parsed.blocks[0] as SocialFeedBlock;

  it("starts as a valid block with two example posts", () => {
    expect(block.posts.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(block.variable).toBe("feed1");
  });

  it("rejects sponsored posts without an ad, duplicate ids and factor ordering", () => {
    const bad = structuredClone(cfg);
    const b = bad.blocks[0] as SocialFeedBlock;
    b.posts.push({ id: "p1", kind: "ad", author: T(""), text: T("") });
    b.postOrder = { mode: "factor", factorId: "x" };
    const r = StudyConfig.safeParse(bad);
    expect(r.success).toBe(false);
    const msgs = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(msgs.some((m) => m.includes("Duplicate post id"))).toBe(true);
    expect(msgs.some((m) => m.includes("Choose an ad"))).toBe(true);
    expect(msgs.some((m) => m.includes("listed or in random order"))).toBe(true);
  });

  it("validates likes, saves and hides against the posts and allowed actions", () => {
    expect(validateFeedAnswer(block, { liked: ["p1"], saved: [], hidden: ["p2"] })).toEqual({ ok: true, value: { liked: ["p1"], saved: [], hidden: ["p2"] } });
    expect(validateFeedAnswer(block, { liked: ["p9"] })).toEqual({ ok: false, error: "invalid" });
    expect(validateFeedAnswer(block, { liked: ["p1", "p1"] })).toEqual({ ok: false, error: "invalid" });
    const noLike = { ...block, actions: { ...block.actions, like: false } };
    expect(validateFeedAnswer(noLike, { liked: ["p1"] })).toEqual({ ok: false, error: "invalid" });
  });

  it("exports per-post interactions and viewing time, and summarises them in analytics", () => {
    const cols = buildColumns([parsed]);
    const s = {
      id: "s1",
      status: "completed",
      started_at: "2026-10-24T10:00:00Z",
      ended_at: "2026-10-24T10:05:00Z",
      condition: null,
      factors: {},
      groups: {},
      answers: { feed1: { liked: ["p2"], saved: ["p2"], hidden: ["p1"] } },
      blockSeconds: {},
      blocksDone: [block.id],
      media: {},
      env: { [block.id]: { stores: {}, productsViewed: 0, details: 0, feed: { visibleMs: { p1: 1200, p2: 5400 } } } },
    } as unknown as SessionRecord;
    const get = (n: string) => cols.find((c) => c.name === n)?.cell(s);
    expect(get("feed1_p1_pos")).toBe(1);
    expect(get("feed1_p2_liked")).toBe(1);
    expect(get("feed1_p1_liked")).toBe(0);
    expect(get("feed1_p1_hidden")).toBe(1);
    expect(get("feed1_p2_visible_sec")).toBe(5.4);
    expect(get("feed1_n_liked")).toBe(1);
    const env = computeAnalytics(parsed, [s]).environments[0];
    expect(env.kind).toBe("social_feed");
    if (env.kind === "social_feed") expect(env.posts.map((p) => [p.liked, p.hidden, p.medianSec])).toEqual([[0, 1, 1.2], [1, 0, 5.4]]);
  });
});

describe("constant sum question", () => {
  const q = newQuestion("constant_sum", "split") as Extract<ReturnType<typeof newQuestion>, { type: "constant_sum" }>;

  it("must add up to the total", () => {
    expect(q.total).toBe(100);
    expect(validateAnswer(q, { "1": 50, "2": 30, "3": 20 })).toEqual({ ok: true, value: { "1": 50, "2": 30, "3": 20 } });
    expect(validateAnswer(q, { "1": 50, "2": 30 })).toEqual({ ok: false, error: "sum" });
    expect(validateAnswer(q, { "1": 100, "2": 0 })).toEqual({ ok: true, value: { "1": 100 } });
    expect(validateAnswer(q, { "9": 100 })).toEqual({ ok: false, error: "invalid" });
    expect(validateAnswer(q, { "1": 101 })).toEqual({ ok: false, error: "invalid" });
    expect(validateAnswer(q, {})).toEqual({ ok: false, error: "required" });
  });

  it("exports one column per option, with unanswered options as 0", () => {
    expect(exportVariableNames(q)).toEqual(q.options.map((o) => `${q.variable}_${o.value}`));
    const cfg = base();
    cfg.blocks.unshift({ id: "q", type: "questionnaire", name: "", showTo: [], heading: T(""), role: "general", questions: [q] } as never);
    const parsed = StudyConfig.parse(cfg);
    const cols = buildColumns([parsed]);
    const s = { id: "s", answers: { [q.variable]: { "1": 70, "3": 30 } } } as unknown as SessionRecord;
    expect(q.options.map((o) => cols.find((c) => c.name === `${q.variable}_${o.value}`)?.cell(s))).toEqual([70, 0, 30]);
  });
});
