import { describe, expect, it } from "vitest";
import { StudyConfig, exportVariableNames, type Question } from "@/lib/study/schema";
import { newBlock, newQuestion, startingConfig } from "@/lib/study/factories";
import { QUESTION_TYPES } from "@/lib/study/schema";

describe("study configuration schema", () => {
  it("accepts the blank and questionnaire starting points", () => {
    expect(StudyConfig.safeParse(startingConfig("blank")).success).toBe(true);
    expect(StudyConfig.safeParse(startingConfig("questionnaire")).success).toBe(true);
  });

  it("flags the media starting point until media is added", () => {
    const cfg = startingConfig("media");
    const r = StudyConfig.safeParse(cfg);
    expect(r.success).toBe(false);
    const media = cfg.blocks.find((b) => b.type === "media")!;
    (media as { items: unknown[] }).items = [
      { assetId: crypto.randomUUID(), storagePath: "ws/x.png", kind: "image", mimeType: "image/png", alt: {} },
    ];
    expect(StudyConfig.safeParse(cfg).success).toBe(true);
  });

  it("every question type has a valid default", () => {
    for (const type of QUESTION_TYPES) {
      const cfg = startingConfig("blank");
      const q = newBlock("questionnaire", cfg);
      (q as { questions: Question[] }).questions = [newQuestion(type, "v1")];
      cfg.blocks.splice(1, 0, q);
      const r = StudyConfig.safeParse(cfg);
      expect(r.success, `${type}: ${!r.success && JSON.stringify(r.error.issues)}`).toBe(true);
    }
  });

  it("requires an End block", () => {
    const cfg = startingConfig("blank");
    cfg.blocks = cfg.blocks.filter((b) => b.type !== "end");
    expect(StudyConfig.safeParse(cfg).success).toBe(false);
  });

  it("rejects duplicate variable names, including expanded export columns", () => {
    const cfg = startingConfig("blank");
    const block = newBlock("questionnaire", cfg) as { questions: Question[] };
    const multi = newQuestion("multiple", "brand");
    const clash = newQuestion("single", "brand_1"); // collides with brand_1 from the multiple-choice columns
    block.questions = [multi, clash];
    cfg.blocks.splice(1, 0, block as never);
    const r = StudyConfig.safeParse(cfg);
    expect(r.success).toBe(false);
    expect(JSON.stringify(!r.success && r.error.issues)).toContain("brand_1");
  });

  it("rejects duplicate block ids and invalid variable names", () => {
    const cfg = startingConfig("questionnaire");
    cfg.blocks[1].id = cfg.blocks[0].id;
    expect(StudyConfig.safeParse(cfg).success).toBe(false);
    const cfg2 = startingConfig("questionnaire");
    const q = cfg2.blocks.find((b) => b.type === "questionnaire") as { questions: Question[] };
    q.questions[0].variable = "1bad name";
    expect(StudyConfig.safeParse(cfg2).success).toBe(false);
  });

  it("requires https redirect URLs", () => {
    const cfg = startingConfig("blank");
    const end = cfg.blocks.find((b) => b.type === "end") as { redirectUrl?: string };
    end.redirectUrl = "http://example.com";
    expect(StudyConfig.safeParse(cfg).success).toBe(false);
    end.redirectUrl = "https://example.com/done?cc=1";
    expect(StudyConfig.safeParse(cfg).success).toBe(true);
  });

  it("names exported columns predictably", () => {
    expect(exportVariableNames(newQuestion("likert", "trust"))).toEqual(["trust"]);
    expect(exportVariableNames(newQuestion("multiple", "m"))).toEqual(["m_1", "m_2", "m_3"]);
    expect(exportVariableNames(newQuestion("matrix", "att"))).toEqual(["att_1", "att_2"]);
    expect(exportVariableNames(newQuestion("ranking", "rk"))).toEqual(["rk_1", "rk_2", "rk_3"]);
  });
});
