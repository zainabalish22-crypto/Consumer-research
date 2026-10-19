import { describe, expect, it } from "vitest";
import { evalLogic, nextStepIndex, pipe, previewAssignment, resolveSteps, type Assignment } from "@/lib/study/flow";
import { StudyConfig, type Block } from "@/lib/study/schema";
import { newBlock, newQuestion, normalizeDraft, startingConfig } from "@/lib/study/factories";
import { methodWarnings } from "@/lib/study/warnings";

const T = (en: string) => ({ en });

function brandsStudy() {
  const cfg = startingConfig("blank", ["en"]);
  cfg.design.conditions = [
    { id: "none", label: "", weight: 1 },
    { id: "label", label: "", weight: 1 },
  ];
  cfg.design.factors = [
    {
      id: "fb",
      variable: "target_brand",
      name: "",
      kind: "pick",
      method: "balanced",
      balanceWithinCondition: true,
      levels: ["A", "B", "C"].map((v) => ({ id: v, value: v, label: T(`Brand ${v}`) })),
      targets: [],
    },
    {
      id: "fo",
      variable: "ad_order",
      name: "",
      kind: "order",
      method: "latin",
      balanceWithinCondition: true,
      levels: ["A", "B", "C"].map((v) => ({ id: v, value: v, label: T(`Brand ${v}`) })),
      targets: [],
    },
  ];
  const scales = newBlock("questionnaire", cfg) as Extract<Block, { type: "questionnaire" }>;
  scales.id = "scales";
  scales.questions = [{ ...newQuestion("likert", "att"), text: T("I like {{stimulus}}") }];
  scales.repeat = { factorId: "fo", order: "assigned" };
  const labelOnly = newBlock("instructions", cfg);
  labelOnly.id = "disclosure";
  labelOnly.showTo = ["label"];
  const g1 = newBlock("instructions", cfg);
  g1.id = "g1";
  g1.orderGroup = "g";
  const g2 = newBlock("instructions", cfg);
  g2.id = "g2";
  g2.orderGroup = "g";
  cfg.design.orderGroups = [{ id: "g", name: "", method: "latin" }];
  cfg.blocks.splice(2, 0, labelOnly, g1, g2, scales);
  return cfg;
}

describe("flow engine", () => {
  it("applies condition visibility, group order and repetition in the assigned order", () => {
    const cfg = brandsStudy();
    expect(StudyConfig.safeParse(cfg).success).toBe(true);
    const a: Assignment = { condition: "none", factors: { target_brand: "B", ad_order: ["C", "A", "B"] }, groups: { g: ["g2", "g1"] } };
    const keys = resolveSteps(cfg, a, "s1").map((s) => s.key);
    expect(keys).not.toContain("disclosure");
    expect(keys.indexOf("g2")).toBeLessThan(keys.indexOf("g1"));
    expect(keys.filter((k) => k.startsWith("scales#"))).toEqual(["scales#C", "scales#A", "scales#B"]);
    const withLabel = resolveSteps(cfg, { ...a, condition: "label" }, "s1").map((s) => s.key);
    expect(withLabel).toContain("disclosure");
  });

  it("pipes the current stimulus and assigned factor labels into text", () => {
    const cfg = brandsStudy();
    const a: Assignment = { condition: "none", factors: { target_brand: "B", ad_order: ["C", "A", "B"] }, groups: {} };
    const steps = resolveSteps(cfg, a, "s1");
    const step = steps.find((s) => s.key === "scales#A");
    expect(pipe("I like {{stimulus}}", cfg, a, step, "en", "en")).toBe("I like Brand A");
    expect(pipe("Target: {{factor:target_brand}}", cfg, a, undefined, "en", "en")).toBe("Target: Brand B");
    expect(pipe("Unknown {{factor:nope}}", cfg, a, undefined, "en", "en")).toBe("Unknown {{factor:nope}}");
  });

  it("skips blocks whose rule is false, using earlier answers", () => {
    const cfg = startingConfig("questionnaire", ["en"]);
    const q = cfg.blocks.find((b) => b.type === "questionnaire")! as Extract<Block, { type: "questionnaire" }>;
    const demo = cfg.blocks.find((b) => b.type === "demographics")!;
    demo.showIf = { mode: "all", clauses: [{ source: "answer", key: q.questions[0].variable, op: "gte", value: 4 }] };
    const a: Assignment = { condition: null, factors: {}, groups: {} };
    const steps = resolveSteps(cfg, a, "s");
    const qi = steps.findIndex((s) => s.blockId === q.id);
    const low = nextStepIndex(cfg, steps, qi, a, { [q.id]: { [q.questions[0].variable]: 2 } }, {});
    expect(cfg.blocks.find((b) => b.id === steps[low].blockId)!.type).toBe("end");
    const high = nextStepIndex(cfg, steps, qi, a, { [q.id]: { [q.questions[0].variable]: 5 } }, {});
    expect(steps[high].blockId).toBe(demo.id);
  });

  it("evaluates every operator sensibly, including missing answers", () => {
    const ctx = { condition: "c1", factors: { tb: "A", ord: ["B", "A"], map: { S1: "BOGO" } }, answers: { x: 3, m: [1, 4], t: "hi" }, params: { pid: "p9" } };
    const ok = (clause: object) => evalLogic({ mode: "all", clauses: [clause as never] }, ctx);
    expect(ok({ source: "answer", key: "x", op: "eq", value: 3 })).toBe(true);
    expect(ok({ source: "answer", key: "x", op: "eq", value: "3" })).toBe(true);
    expect(ok({ source: "answer", key: "x", op: "in", value: [1, 2, 3] })).toBe(true);
    expect(ok({ source: "answer", key: "x", op: "gt", value: 5 })).toBe(false);
    expect(ok({ source: "answer", key: "missing", op: "lt", value: 5 })).toBe(false);
    expect(ok({ source: "answer", key: "missing", op: "notAnswered" })).toBe(true);
    expect(ok({ source: "answer", key: "m", op: "includes", value: 4 })).toBe(true);
    expect(ok({ source: "condition", op: "eq", value: "c1" })).toBe(true);
    expect(ok({ source: "factor", key: "tb", op: "neq", value: "B" })).toBe(true);
    expect(ok({ source: "factor", key: "map.S1", op: "eq", value: "BOGO" })).toBe(true);
    expect(ok({ source: "param", key: "pid", op: "answered" })).toBe(true);
    expect(evalLogic({ mode: "any", clauses: [{ source: "answer", key: "x", op: "eq", value: 9 }, { source: "answer", key: "t", op: "eq", value: "hi" }] }, ctx)).toBe(true);
    expect(evalLogic(undefined, ctx)).toBe(true);
  });

  it("repeated blocks get one set of variables per level and clashes are caught", () => {
    const cfg = brandsStudy();
    const extra = newBlock("questionnaire", cfg) as Extract<Block, { type: "questionnaire" }>;
    extra.questions = [newQuestion("numeric", "att_A")]; // collides with att repeated for level A
    cfg.blocks.splice(1, 0, extra);
    const r = StudyConfig.safeParse(cfg);
    expect(r.success).toBe(false);
    expect(JSON.stringify(!r.success && r.error.issues)).toContain("att_A");
  });

  it("preview assignment respects overrides and design rules", () => {
    const cfg = brandsStudy();
    const a = previewAssignment(cfg, "x", { condition: "label", factors: { target_brand: "C" } });
    expect(a.condition).toBe("label");
    expect(a.factors.target_brand).toBe("C");
    expect([...(a.factors.ad_order as string[])].sort()).toEqual(["A", "B", "C"]);
    expect([...a.groups.g].sort()).toEqual(["g1", "g2"]);
  });

  it("design validation catches common mistakes", () => {
    const cfg = brandsStudy();
    cfg.design.conditions = [{ id: "only", label: "", weight: 1 }];
    cfg.design.factors[0].method = "latin";
    cfg.design.factors.push({ ...cfg.design.factors[1], id: "fm", variable: "offers", kind: "mapping", targets: [{ id: "t", value: "S1", label: T("S1") }] });
    const issues = JSON.stringify((StudyConfig.safeParse(cfg) as { error: { issues: unknown } }).error.issues);
    expect(issues).toContain("at least two conditions");
    expect(issues).toContain("Pick factors use random, balanced or fixed");
    expect(issues).toContain("as many targets as levels");
  });

  it("opens Phase 1 drafts by filling the new defaults", () => {
    const old = { schemaVersion: 1, settings: { languages: ["en"], defaultLanguage: "en" }, blocks: [{ id: "w", name: "", type: "welcome", heading: {}, body: {} }] };
    const n = normalizeDraft(old);
    expect(n.design.conditions).toEqual([]);
    expect(n.blocks[0].showTo).toEqual([]);
    expect(n.settings.events).toEqual({ navigation: true, media: true });
  });
});

describe("methodological warnings", () => {
  it("flags the documented risky patterns and nothing in a plain questionnaire", () => {
    expect(methodWarnings(StudyConfig.parse(startingConfig("questionnaire")))).toEqual([]);

    const raw = startingConfig("experiment");
    for (const b of raw.blocks) {
      if (b.type === "media") b.items = [{ assetId: crypto.randomUUID(), storagePath: "ws/ad.mp4", kind: "video", mimeType: "video/mp4", alt: {} }];
    }
    const cfg = StudyConfig.parse(raw);
    // The experiment starting point is designed to be warning-free.
    expect(methodWarnings(cfg)).toEqual([]);

    const risky = structuredClone(cfg);
    risky.settings.usesDeception = true;
    risky.blocks = risky.blocks.filter((b) => b.type !== "debrief" && !(b.type === "questionnaire" && b.role === "manipulation_check"));
    const det = newBlock("questionnaire", risky) as Extract<Block, { type: "questionnaire" }>;
    det.role = "detection";
    const att = risky.blocks.findIndex((b) => b.type === "questionnaire" && b.role === "attitude");
    risky.blocks.splice(att, 0, det);
    const extra = risky.blocks.find((b) => b.showTo.includes("treatment"))!;
    for (let i = 0; i < 4; i++) {
      const q = newBlock("questionnaire", risky);
      q.showTo = ["treatment"];
      risky.blocks.splice(risky.blocks.indexOf(extra) + 1, 0, q);
    }
    const rules = methodWarnings(risky).map((w) => w.rule).sort();
    expect(rules).toEqual(["condition_imbalance", "deception_no_debrief", "detection_before_attitude", "no_manipulation_check"]);
  });

  it("flags long questionnaires without attention checks", () => {
    const cfg = startingConfig("questionnaire", ["en"]);
    const q = cfg.blocks.find((b) => b.type === "questionnaire") as Extract<Block, { type: "questionnaire" }>;
    q.questions = Array.from({ length: 20 }, (_, i) => newQuestion("likert", `item${i + 1}`));
    expect(methodWarnings(StudyConfig.parse(cfg)).map((w) => w.rule)).toContain("no_attention_check");
  });
});
