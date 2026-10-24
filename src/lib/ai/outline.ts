/**
 * A study outline drafted by the AI assistant, and how a reviewed outline
 * becomes a normal draft study (plain blocks the researcher then edits).
 */
import { z } from "zod";
import { StudyConfig, isQuestionBlock, type Question } from "@/lib/study/schema";
import { newBlock, newQuestion, normalizeDraft, startingConfig } from "@/lib/study/factories";

const Bi = z.object({ en: z.string(), ar: z.string() });

export const Outline = z.object({
  title: z.string(),
  summary: z.string(),
  design: z.enum(["between", "within", "mixed", "single_group"]),
  conditions: z.array(z.object({ id: z.string(), label: z.string(), description: z.string() })),
  measures: z.array(z.object({ construct: z.string(), rationale: z.string(), items: z.array(Bi), scaleNote: z.string() })),
  manipulationChecks: z.array(Bi),
  confounds: z.array(z.string()),
  counterbalancing: z.string(),
  analyses: z.array(z.string()),
  caveats: z.array(z.string()),
});
export type Outline = z.infer<typeof Outline>;

const text = (b: { en: string; ar: string }) => ({ en: b.en.trim().slice(0, 2000), ar: b.ar.trim().slice(0, 2000) });

function agreementItem(variable: string, item: { en: string; ar: string }): Question {
  const q = newQuestion("likert", variable) as Extract<Question, { type: "likert" }>;
  return { ...q, text: text(item), points: 7, startValue: 1, labels: [], special: { notSure: false, preferNot: false } };
}

/** Welcome, consent, one page per measure, a manipulation check, demographics, end. */
export function outlineToConfig(o: Outline): StudyConfig {
  const config = startingConfig("blank", ["en", "ar"]);
  const end = config.blocks.pop()!;
  const ids = new Set<string>();
  config.design.conditions = o.conditions
    .map((c, i) => {
      let id = c.id.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^[^a-z]+/, "").slice(0, 30) || `c${i + 1}`;
      while (ids.has(id)) id = `${id}_${i + 1}`;
      ids.add(id);
      return { id, label: c.label.slice(0, 120), weight: 1 };
    })
    .slice(0, 20);
  o.measures.slice(0, 10).forEach((m, mi) => {
    const page = newBlock("questionnaire", config);
    if (!isQuestionBlock(page)) return;
    page.name = `${m.construct} (AI draft, not validated)`.slice(0, 120);
    page.questions = m.items.slice(0, 20).map((item, i) => agreementItem(`m${mi + 1}_${i + 1}`, item));
    config.blocks.push(page);
  });
  if (o.manipulationChecks.length && config.design.conditions.length) {
    const mc = newBlock("questionnaire", config);
    if (isQuestionBlock(mc)) {
      mc.name = "Manipulation check (AI draft)";
      mc.role = "manipulation_check";
      mc.questions = o.manipulationChecks.slice(0, 5).map((item, i) => agreementItem(`mc_${i + 1}`, item));
      config.blocks.push(mc);
    }
  }
  config.blocks.push(newBlock("demographics", config));
  config.blocks.push(end);
  const valid = StudyConfig.safeParse(config);
  return valid.success ? valid.data : normalizeDraft(config);
}
