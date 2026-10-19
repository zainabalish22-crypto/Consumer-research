/**
 * Methodological warnings: design choices that commonly harm data quality.
 * They never block publishing; researchers can dismiss each one (logged in the audit log).
 */
import { isQuestionBlock, type Block, type StudyConfig } from "./schema";

export interface MethodWarning {
  /** Stable id used for dismissal, e.g. "detection_before_attitude" or "condition_imbalance". */
  id: string;
  rule:
    | "no_consent"
    | "detection_before_attitude"
    | "deception_no_debrief"
    | "no_attention_check"
    | "condition_imbalance"
    | "no_manipulation_check"
    | "group_spans_consent"
    | "screening_after_content";
  blockId?: string;
  params?: Record<string, string | number>;
}

const role = (b: Block) => (b.type === "questionnaire" ? b.role : null);
const questionCount = (cfg: StudyConfig) => cfg.blocks.reduce((n, b) => n + (isQuestionBlock(b) ? b.questions.length : 0), 0);

export function methodWarnings(cfg: StudyConfig): MethodWarning[] {
  const out: MethodWarning[] = [];
  const blocks = cfg.blocks;
  const d = cfg.design;

  if (!blocks.some((b) => b.type === "consent")) out.push({ id: "no_consent", rule: "no_consent" });

  // Asking whether something was AI-generated primes suspicion for later attitude/trust measures.
  const firstDetection = blocks.findIndex((b) => role(b) === "detection");
  const lastAttitude = blocks.map(role).lastIndexOf("attitude");
  if (firstDetection >= 0 && lastAttitude > firstDetection) {
    out.push({ id: "detection_before_attitude", rule: "detection_before_attitude", blockId: blocks[firstDetection].id });
  }

  if (cfg.settings.usesDeception && !blocks.some((b) => b.type === "debrief")) {
    out.push({ id: "deception_no_debrief", rule: "deception_no_debrief" });
  }

  const n = questionCount(cfg);
  const hasAttention =
    blocks.some((b) => role(b) === "attention") ||
    blocks.some((b) => isQuestionBlock(b) && b.questions.some((q) => "attentionCheck" in q && q.attentionCheck));
  if (n >= 20 && !hasAttention) out.push({ id: "no_attention_check", rule: "no_attention_check", params: { n } });

  if (d.conditions.length >= 2) {
    const perCondition = d.conditions.map((c) => ({
      id: c.id,
      blocks: blocks.filter((b) => !b.showTo.length || b.showTo.includes(c.id)).length,
      questions: blocks
        .filter((b) => !b.showTo.length || b.showTo.includes(c.id))
        .reduce((k, b) => k + (isQuestionBlock(b) ? b.questions.length : 0), 0),
    }));
    const counts = perCondition.map((p) => p.blocks + p.questions);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    if (max - min >= 3 && max >= min * 1.5) {
      const lo = perCondition[counts.indexOf(min)];
      const hi = perCondition[counts.indexOf(max)];
      out.push({ id: "condition_imbalance", rule: "condition_imbalance", params: { low: lo.id, high: hi.id } });
    }
    if (!blocks.some((b) => role(b) === "manipulation_check")) {
      out.push({ id: "no_manipulation_check", rule: "no_manipulation_check" });
    }
  }

  const consentAt = blocks.findIndex((b) => b.type === "consent");
  if (consentAt >= 0) {
    for (const g of d.orderGroups) {
      const idx = blocks.map((b, i) => (b.orderGroup === g.id ? i : -1)).filter((i) => i >= 0);
      if (idx.some((i) => i < consentAt) && idx.some((i) => i > consentAt)) {
        out.push({ id: `group_spans_consent:${g.id}`, rule: "group_spans_consent", params: { group: g.name || g.id } });
      }
    }
    const firstContent = blocks.findIndex((b, i) => i > consentAt && ["questionnaire", "media", "demographics"].includes(b.type));
    const lateScreen = blocks.findIndex((b, i) => b.type === "screening" && firstContent >= 0 && i > firstContent);
    if (lateScreen >= 0) out.push({ id: `screening_after_content:${blocks[lateScreen].id}`, rule: "screening_after_content", blockId: blocks[lateScreen].id });
  }

  return out;
}

export function activeWarnings(cfg: StudyConfig): MethodWarning[] {
  const dismissed = new Set(cfg.settings.dismissedWarnings);
  return methodWarnings(cfg).filter((w) => !dismissed.has(w.id));
}
