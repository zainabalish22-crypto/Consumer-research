"use server";
/**
 * AI assistant tasks. Each returns suggestions only; the researcher applies
 * them in the builder (draft only) or creates a new draft study from an outline.
 * Published versions are never changed and participant data is never sent.
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { runAiTask, type AiResult } from "@/lib/ai/assistant";
import { isQuestionBlock, type Language } from "@/lib/study/schema";
import { normalizeDraft } from "@/lib/study/factories";
import { Outline, outlineToConfig } from "@/lib/ai/outline";
import type { ActionResult } from "./studio";

const uuid = z.string().uuid();
const Bi = z.object({ en: z.string(), ar: z.string() });

// ---------------------------------------------------------------------------
// 1. Study outline from a research idea
// ---------------------------------------------------------------------------



export async function draftOutline(idea: string): Promise<AiResult<Outline>> {
  const text = z.string().trim().min(10).max(4000).safeParse(idea);
  if (!text.success) return { ok: false, error: "aiFailed" };
  const { supabase, user } = await requireUser();
  return runAiTask({
    supabase,
    userId: user.id,
    kind: "outline",
    schema: Outline,
    effort: "medium",
    instructions: `Task: turn the researcher's idea into a draft study outline for an online consumer-behaviour study.
- conditions: 0 to 6 conditions with short lowercase ids (letters, digits, underscores). Use none for a single-group survey.
- measures: 2 to 6 constructs. For each, draft 3 to 5 agreement statements (for a 1-7 scale) in English and Arabic, and in scaleNote say that a validated scale should be used if one exists, naming only the construct (no invented scale names).
- manipulationChecks: 1 to 3 items, English and Arabic, only if there are conditions.
- confounds, counterbalancing, analyses: brief, practical suggestions.
- caveats: what the researcher must still decide or verify (ethics, sample size, piloting).`,
    input: `Research idea:\n${text.data}`,
  });
}

/** Build a normal draft study from an outline the researcher reviewed. */
export async function createStudyFromOutline(projectId: string, raw: unknown): Promise<ActionResult> {
  const parsed = Outline.safeParse(raw);
  if (!uuid.safeParse(projectId).success || !parsed.success) return { ok: false, error: "invalidInput" };
  const o = parsed.data;
  const { supabase, user } = await requireUser();
  const draft = outlineToConfig(o);
  const { data, error } = await supabase
    .from("studies")
    .insert({ project_id: projectId, title: o.title.slice(0, 200) || "AI-drafted study", draft_config: draft, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "saveFailed" };
  redirect(`/studio/studies/${data.id}`);
}

// ---------------------------------------------------------------------------
// 2. Question wording critique, 3. missing translations, 4. analysis plan
// (all read the last saved draft of a study the researcher can access)
// ---------------------------------------------------------------------------

async function loadDraft(studyId: string) {
  if (!uuid.safeParse(studyId).success) return null;
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("studies").select("draft_config").eq("id", studyId).single();
  if (!data) return null;
  return { supabase, user, config: normalizeDraft(data.draft_config) };
}

const Critique = z.object({
  questions: z.array(
    z.object({
      variable: z.string(),
      issues: z.array(z.object({ type: z.enum(["leading", "double_barrelled", "ambiguous", "loaded", "jargon", "double_negative", "too_long", "other"]), explanation: z.string() })),
      rewrite: Bi.nullable(),
    }),
  ),
  general: z.array(z.string()),
});
export type Critique = z.infer<typeof Critique>;

export async function critiqueQuestions(studyId: string, blockId: string): Promise<AiResult<Critique>> {
  const d = await loadDraft(studyId);
  const block = d?.config.blocks.find((b) => b.id === blockId);
  if (!d || !block || !isQuestionBlock(block)) return { ok: false, error: "aiFailed" };
  const questions = block.questions.map((q) => ({
    variable: q.variable,
    type: q.type,
    text: q.text,
    options: "options" in q ? q.options.map((o) => o.label) : undefined,
  }));
  return runAiTask({
    supabase: d.supabase,
    userId: d.user.id,
    kind: "critique",
    schema: Critique,
    effort: "medium",
    instructions: `Task: review questionnaire wording. For each question (keep its variable), list concrete problems (leading, double-barrelled, ambiguous, loaded, jargon, double negative, too long, other) with a one-sentence explanation. Give a rewrite in English and Arabic only when there is a problem; otherwise rewrite is null and issues is empty. Check that the English and Arabic versions say the same thing. Do not change what is being measured. In general, add at most 3 notes about the page as a whole.`,
    input: JSON.stringify({ questions }),
  });
}

const Translations = z.object({ items: z.array(z.object({ key: z.string(), text: z.string() })) });
export type Translations = z.infer<typeof Translations>;

/** Fill the missing language for fields where only one language is written. */
export async function translateMissing(studyId: string, fields: { key: string; from: Language; to: Language; text: string }[]): Promise<AiResult<Translations>> {
  const parsed = z.array(z.object({ key: z.string().max(200), from: z.enum(["en", "ar"]), to: z.enum(["en", "ar"]), text: z.string().max(4000) })).max(200).safeParse(fields);
  const d = await loadDraft(studyId);
  if (!d || !parsed.success || !parsed.data.length) return { ok: false, error: "aiFailed" };
  return runAiTask({
    supabase: d.supabase,
    userId: d.user.id,
    kind: "translate",
    schema: Translations,
    effort: "low",
    instructions: `Task: translate each item from its "from" language to its "to" language for a research questionnaire. Keep the meaning, tone and any placeholders such as {{stimulus}} or {code} exactly. Return one entry per key with the translated text only.`,
    input: JSON.stringify({ items: parsed.data }),
  });
}

const Analysis = z.object({
  analyses: z.array(z.object({ question: z.string(), method: z.string(), variables: z.array(z.string()), assumptions: z.string(), notes: z.string() })),
  codebookNotes: z.array(z.string()),
  caveats: z.array(z.string()),
});
export type Analysis = z.infer<typeof Analysis>;

export async function suggestAnalyses(studyId: string): Promise<AiResult<Analysis>> {
  const d = await loadDraft(studyId);
  if (!d) return { ok: false, error: "aiFailed" };
  const c = d.config;
  // The design and variable names only - no participant data.
  const summary = {
    conditions: c.design.conditions.map((x) => x.id),
    factors: c.design.factors.map((f) => ({ variable: f.variable, kind: f.kind, levels: f.levels.map((l) => l.value) })),
    blocks: c.blocks.map((b) => ({
      type: b.type,
      name: b.name,
      showTo: b.showTo,
      variable: "variable" in b ? b.variable : undefined,
      questions: isQuestionBlock(b) ? b.questions.map((q) => ({ variable: q.variable, type: q.type, text: q.text.en || q.text.ar })) : undefined,
    })),
  };
  return runAiTask({
    supabase: d.supabase,
    userId: d.user.id,
    kind: "analysis",
    schema: Analysis,
    effort: "medium",
    instructions: `Task: suggest an analysis plan for this study design. For each research question you can infer, name a suitable method, the export variables involved (use the variable names given), its assumptions, and notes. Shopping blocks export columns that start with their variable prefix (e.g. prefix_items, prefix_value). In codebookNotes, suggest coding or recoding steps. In caveats, say what needs a statistician's check (power, multiple comparisons, assumptions).`,
    input: JSON.stringify(summary),
  });
}
