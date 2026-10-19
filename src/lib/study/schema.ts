/**
 * Study configuration schema.
 *
 * A study is a versioned JSON document that the participant renderer reads.
 * Every block type is registered here with its schema; the editor and renderer
 * components live in src/components/blocks and are looked up by `type`.
 */
import { z } from "zod";

export const LANGUAGES = ["en", "ar"] as const;
export type Language = (typeof LANGUAGES)[number];

/** Codes written to the data for the optional special answers. */
export const SPECIAL_CODES = { notSure: -98, preferNot: -99 } as const;

const MAX_TEXT = 20_000;

export const LocalizedText = z.object({
  en: z.string().max(MAX_TEXT).optional(),
  ar: z.string().max(MAX_TEXT).optional(),
});
export type LocalizedText = z.infer<typeof LocalizedText>;

const id = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, "Use letters, numbers, - or _ (max 40)");
export const variableName = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/, "Start with a letter; letters, numbers and _ only (max 64)");

export const MediaRef = z.object({
  assetId: z.string().uuid(),
  storagePath: z.string().min(1).max(400),
  kind: z.enum(["image", "video", "audio"]),
  mimeType: z.string().max(100),
  alt: LocalizedText.default({}),
});
export type MediaRef = z.infer<typeof MediaRef>;

export const ChoiceOption = z.object({
  id,
  value: z.number().int().min(-1_000_000).max(1_000_000),
  label: LocalizedText,
});
export type ChoiceOption = z.infer<typeof ChoiceOption>;

const SpecialOptions = z
  .object({ notSure: z.boolean().default(false), preferNot: z.boolean().default(false) })
  .default({ notSure: false, preferNot: false });

const QuestionBase = z.object({
  id,
  variable: variableName,
  text: LocalizedText,
  help: LocalizedText.optional(),
  required: z.boolean().default(true),
});

/** Attention check: the answer must equal `expected` to pass. Flagged in exports. */
const AttentionCheck = z.object({ expected: z.number().int() }).optional();

export const SingleChoiceQ = QuestionBase.extend({
  type: z.literal("single"),
  options: z.array(ChoiceOption).min(2).max(100),
  randomizeOptions: z.boolean().default(false),
  special: SpecialOptions,
  attentionCheck: AttentionCheck,
});
export const DropdownQ = SingleChoiceQ.extend({ type: z.literal("dropdown") });
export const MultipleChoiceQ = QuestionBase.extend({
  type: z.literal("multiple"),
  options: z.array(ChoiceOption).min(2).max(100),
  randomizeOptions: z.boolean().default(false),
  minSelect: z.number().int().min(0).optional(),
  maxSelect: z.number().int().min(1).optional(),
  special: SpecialOptions,
});
export const LikertQ = QuestionBase.extend({
  type: z.literal("likert"),
  points: z.number().int().min(2).max(11),
  startValue: z.number().int().min(-5).max(1).default(1),
  /** One label per point; empty strings leave a point unlabelled. */
  labels: z.array(LocalizedText).default([]),
  special: SpecialOptions,
  attentionCheck: AttentionCheck,
});
export const SemanticQ = QuestionBase.extend({
  type: z.literal("semantic"),
  points: z.number().int().min(3).max(11),
  startValue: z.number().int().min(-5).max(1).default(1),
  leftLabel: LocalizedText,
  rightLabel: LocalizedText,
});
export const SliderQ = QuestionBase.extend({
  type: z.literal("slider"),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  leftLabel: LocalizedText.optional(),
  rightLabel: LocalizedText.optional(),
});
export const MatrixQ = QuestionBase.extend({
  type: z.literal("matrix"),
  rows: z
    .array(z.object({ id, code: z.string().regex(/^[A-Za-z0-9_]{1,20}$/), text: LocalizedText }))
    .min(1)
    .max(50),
  columns: z.array(z.object({ value: z.number().int(), label: LocalizedText })).min(2).max(11),
  randomizeRows: z.boolean().default(false),
});
export const RankingQ = QuestionBase.extend({
  type: z.literal("ranking"),
  options: z.array(ChoiceOption).min(2).max(20),
  randomizeOptions: z.boolean().default(false),
});
export const NumericQ = QuestionBase.extend({
  type: z.literal("numeric"),
  min: z.number().optional(),
  max: z.number().optional(),
  integerOnly: z.boolean().default(false),
  unit: LocalizedText.optional(),
});
export const TextQ = QuestionBase.extend({
  type: z.literal("text"),
  multiline: z.boolean().default(false),
  maxLength: z.number().int().min(1).max(10_000).default(500),
});
export const DateQ = QuestionBase.extend({
  type: z.literal("date"),
  min: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  max: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export const ImageChoiceQ = QuestionBase.extend({
  type: z.literal("image_choice"),
  multiple: z.boolean().default(false),
  options: z
    .array(ChoiceOption.extend({ image: MediaRef.optional() }))
    .min(2)
    .max(30),
  randomizeOptions: z.boolean().default(false),
});

export const Question = z.discriminatedUnion("type", [
  SingleChoiceQ,
  DropdownQ,
  MultipleChoiceQ,
  LikertQ,
  SemanticQ,
  SliderQ,
  MatrixQ,
  RankingQ,
  NumericQ,
  TextQ,
  DateQ,
  ImageChoiceQ,
]);
export type Question = z.infer<typeof Question>;
export type QuestionType = Question["type"];
export const QUESTION_TYPES: QuestionType[] = [
  "single",
  "multiple",
  "dropdown",
  "likert",
  "semantic",
  "slider",
  "matrix",
  "ranking",
  "numeric",
  "text",
  "date",
  "image_choice",
];

// ---------------------------------------------------------------------------
// Experimental design (Phase 2)
// ---------------------------------------------------------------------------

const code = z.string().regex(/^[A-Za-z0-9_]{1,20}$/, "Use letters, numbers or _ (max 20)");

/** Between-subject condition. */
export const Condition = z.object({
  id: code,
  /** Researcher-facing label; never shown to participants. */
  label: z.string().max(120).default(""),
  weight: z.number().int().min(1).max(100).default(1),
  /** Stop assigning to this condition once this many sessions have completed. */
  quota: z.number().int().min(1).max(1_000_000).optional(),
});
export type Condition = z.infer<typeof Condition>;

export const FactorLevel = z.object({ id, value: code, label: LocalizedText });
export type FactorLevel = z.infer<typeof FactorLevel>;

/**
 * A variable assigned per participant and stored with the session.
 * - pick:    one level per participant (e.g. target_brand)
 * - order:   an order of all levels (e.g. ad_order)
 * - mapping: levels mapped one-to-one onto targets (e.g. offers onto stores)
 */
export const Factor = z.object({
  id,
  variable: variableName,
  name: z.string().max(120).default(""),
  kind: z.enum(["pick", "order", "mapping"]),
  levels: z.array(FactorLevel).min(2).max(12),
  targets: z.array(z.object({ id, value: code, label: LocalizedText })).max(12).default([]),
  method: z.enum(["random", "balanced", "latin", "permutation", "fixed"]),
  /** pick + fixed: the level value everyone gets. */
  fixedValue: z.string().max(20).optional(),
  /** Balance counts separately within each condition. */
  balanceWithinCondition: z.boolean().default(true),
});
export type Factor = z.infer<typeof Factor>;

/** Blocks sharing an order group are shown in a per-participant order. */
export const OrderGroup = z.object({
  id: code,
  name: z.string().max(120).default(""),
  method: z.enum(["random", "latin", "permutation", "fixed"]),
});
export type OrderGroup = z.infer<typeof OrderGroup>;

export const Design = z.object({
  conditions: z.array(Condition).max(20).default([]),
  assignment: z.enum(["balanced", "random"]).default("balanced"),
  factors: z.array(Factor).max(20).default([]),
  orderGroups: z.array(OrderGroup).max(20).default([]),
});
export type Design = z.infer<typeof Design>;

// ---------------------------------------------------------------------------
// Logic (skip / branching / eligibility)
// ---------------------------------------------------------------------------

const scalar = z.union([z.string().max(200), z.number()]);
export const LogicClause = z.object({
  /** answer = an earlier answer (by variable), condition, factor = an assigned value, param = a URL parameter, iteration = current repetition level. */
  source: z.enum(["answer", "condition", "factor", "param", "iteration"]),
  key: z.string().max(80).default(""),
  op: z.enum(["eq", "neq", "in", "notIn", "gt", "gte", "lt", "lte", "answered", "notAnswered", "includes"]),
  value: z.union([scalar, z.array(scalar).max(50)]).optional(),
});
export type LogicClause = z.infer<typeof LogicClause>;
export const Logic = z.object({
  mode: z.enum(["all", "any"]).default("all"),
  clauses: z.array(LogicClause).min(1).max(20),
});
export type Logic = z.infer<typeof Logic>;

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

const BlockBase = z.object({
  id,
  /** Researcher-facing name shown in the builder; never shown to participants. */
  name: z.string().max(120).default(""),
  /** Show only to these conditions (empty = everyone). */
  showTo: z.array(code).max(20).default([]),
  /** Show only when this rule is true (evaluated when the participant reaches the block). */
  showIf: Logic.optional(),
  /** Repeat this block once per level of a factor, e.g. once per brand. */
  repeat: z.object({ factorId: id, order: z.enum(["assigned", "listed", "random"]) }).optional(),
  /** Blocks in the same order group are shown in a per-participant order. */
  orderGroup: code.optional(),
});

export const WelcomeBlock = BlockBase.extend({
  type: z.literal("welcome"),
  heading: LocalizedText,
  body: LocalizedText,
  estimatedMinutes: z.number().int().min(1).max(600).optional(),
  contact: LocalizedText.optional(),
});
export const ConsentBlock = BlockBase.extend({
  type: z.literal("consent"),
  heading: LocalizedText,
  body: LocalizedText,
  consentVersion: z.string().min(1).max(40).default("1"),
  agreeLabel: LocalizedText,
  declineLabel: LocalizedText,
  declinedMessage: LocalizedText,
});
export const InstructionsBlock = BlockBase.extend({
  type: z.literal("instructions"),
  heading: LocalizedText,
  body: LocalizedText,
  media: z.array(MediaRef).max(20).default([]),
});
/** What a questionnaire measures, used only for methodological warnings. */
export const BLOCK_ROLES = ["general", "attitude", "manipulation_check", "detection", "attention"] as const;

export const QuestionnaireBlock = BlockBase.extend({
  type: z.literal("questionnaire"),
  heading: LocalizedText.optional(),
  intro: LocalizedText.optional(),
  questions: z.array(Question).max(200),
  randomizeQuestions: z.boolean().default(false),
  role: z.enum(BLOCK_ROLES).default("general"),
});
export const DemographicsBlock = QuestionnaireBlock.extend({ type: z.literal("demographics") });
/** Screening: questions plus an eligibility rule. Ineligible participants are thanked and the session ends. */
export const ScreeningBlock = QuestionnaireBlock.extend({
  type: z.literal("screening"),
  eligibleIf: Logic.optional(),
  screenedOutMessage: LocalizedText,
});
export const MediaItem = MediaRef.extend({
  caption: LocalizedText.optional(),
  /** Show this item only when the rule is true (e.g. the AI version for the target brand). */
  showIf: Logic.optional(),
});
export type MediaItem = z.infer<typeof MediaItem>;
export const MediaBlock = BlockBase.extend({
  type: z.literal("media"),
  heading: LocalizedText.optional(),
  items: z.array(MediaItem).min(1).max(50),
  /** Seconds before the participant may continue. */
  minViewSeconds: z.number().int().min(0).max(3600).default(0),
  requireVideoEnd: z.boolean().default(false),
  autoplay: z.boolean().default(false),
  showControls: z.boolean().default(true),
});
/** Placeholders allowed in the redirect URL: {session}, {code} and any URL parameter, e.g. {PROLIFIC_PID}. */
const redirectUrl = z
  .string()
  .max(2000)
  .refine((u) => {
    try {
      return new URL(u.replace(/\{[A-Za-z0-9_]+\}/g, "x")).protocol === "https:";
    } catch {
      return false;
    }
  }, "Redirect URL must be a valid https:// address");

export const EndBlock = BlockBase.extend({
  type: z.literal("end"),
  heading: LocalizedText,
  body: LocalizedText,
  /** Static code shown to everyone (e.g. a Prolific completion code). */
  completionCode: z.string().max(100).optional(),
  /** Generate a unique code per participant instead (stored with the session). */
  uniqueCode: z.boolean().default(false),
  redirectUrl: redirectUrl.optional(),
});
export const DebriefBlock = BlockBase.extend({
  type: z.literal("debrief"),
  heading: LocalizedText,
  body: LocalizedText,
});
/**
 * Cross-study exclusion: the participant enters an identifier (e.g. email). Only a salted
 * hash is kept, in a list private to the researcher's workspace; the identifier is never stored.
 */
export const ExclusionCheckBlock = BlockBase.extend({
  type: z.literal("exclusion_check"),
  heading: LocalizedText.optional(),
  prompt: LocalizedText,
  help: LocalizedText.optional(),
  inputKind: z.enum(["email", "text"]).default("email"),
  /** Add this participant's hash to this list (e.g. "foodcourt-2026"). */
  recordList: z.string().regex(/^[a-z0-9-]{3,40}$/).optional(),
  /** Exclude participants whose hash is already in any of these lists. */
  excludeLists: z.array(z.string().regex(/^[a-z0-9-]{3,40}$/)).max(10).default([]),
  excludedMessage: LocalizedText,
});

export const Block = z.discriminatedUnion("type", [
  WelcomeBlock,
  ConsentBlock,
  ScreeningBlock,
  ExclusionCheckBlock,
  InstructionsBlock,
  QuestionnaireBlock,
  DemographicsBlock,
  MediaBlock,
  DebriefBlock,
  EndBlock,
]);
export type Block = z.infer<typeof Block>;
export type BlockType = Block["type"];
export type QuestionBlock =
  | z.infer<typeof QuestionnaireBlock>
  | z.infer<typeof DemographicsBlock>
  | z.infer<typeof ScreeningBlock>;

export function isQuestionBlock(b: Block): b is QuestionBlock {
  return b.type === "questionnaire" || b.type === "demographics" || b.type === "screening";
}

export const StudySettings = z.object({
  languages: z.array(z.enum(LANGUAGES)).min(1).max(2),
  defaultLanguage: z.enum(LANGUAGES),
  showProgress: z.boolean().default(true),
  allowResume: z.boolean().default(true),
  theme: z.enum(["neutral"]).default("neutral"),
  /** The study withholds or disguises information (e.g. an undisclosed AI-generated ad). */
  usesDeception: z.boolean().default(false),
  /** Which behavioural events to record. Nothing invasive is ever recorded. */
  events: z
    .object({ navigation: z.boolean().default(true), media: z.boolean().default(true) })
    .default({ navigation: true, media: true }),
  /** Methodological warnings the researcher chose to dismiss. */
  dismissedWarnings: z.array(z.string().max(120)).max(100).default([]),
});
export type StudySettings = z.infer<typeof StudySettings>;

/** Export column names for one question inside a block (repeated blocks get one set per level). */
export function blockQuestionColumns(q: Question, repeatLevels: string[] | null): string[] {
  const base = exportVariableNames(q);
  return repeatLevels ? repeatLevels.flatMap((lv) => base.map((c) => `${c}_${lv}`)) : base;
}

export const StudyConfig = z
  .object({
    schemaVersion: z.literal(1),
    settings: StudySettings,
    design: Design.default({ conditions: [], assignment: "balanced", factors: [], orderGroups: [] }),
    blocks: z.array(Block).max(300),
  })
  .superRefine((cfg, ctx) => {
    if (!cfg.settings.languages.includes(cfg.settings.defaultLanguage)) {
      ctx.addIssue({
        code: "custom",
        path: ["settings", "defaultLanguage"],
        message: "Default language must be one of the study languages",
      });
    }
    validateDesign(cfg, ctx);
    const blockIds = new Set<string>();
    const variables = new Map<string, string>();
    // Design variables occupy names in the export too.
    for (const f of cfg.design.factors) variables.set(f.variable.toLowerCase(), `factor ${f.name || f.id}`);
    variables.set("condition", "the condition column");
    cfg.blocks.forEach((b, bi) => {
      if (blockIds.has(b.id)) {
        ctx.addIssue({ code: "custom", path: ["blocks", bi, "id"], message: `Duplicate block id "${b.id}"` });
      }
      blockIds.add(b.id);
      for (const c of b.showTo) {
        if (!cfg.design.conditions.some((x) => x.id === c)) {
          ctx.addIssue({ code: "custom", path: ["blocks", bi, "showTo"], message: `Unknown condition "${c}"` });
        }
      }
      if (b.orderGroup && !cfg.design.orderGroups.some((g) => g.id === b.orderGroup)) {
        ctx.addIssue({ code: "custom", path: ["blocks", bi, "orderGroup"], message: `Unknown order group "${b.orderGroup}"` });
      }
      const repeatFactor = b.repeat ? cfg.design.factors.find((f) => f.id === b.repeat!.factorId) : undefined;
      if (b.repeat && !repeatFactor) {
        ctx.addIssue({ code: "custom", path: ["blocks", bi, "repeat"], message: "Repeat uses a factor that does not exist" });
      }
      if (b.type === "consent" || b.type === "end") {
        if (b.repeat) ctx.addIssue({ code: "custom", path: ["blocks", bi, "repeat"], message: "This block cannot be repeated" });
      }
      if (!isQuestionBlock(b)) return;
      const repeatLevels = repeatFactor ? repeatFactor.levels.map((l) => l.value) : null;
      const qIds = new Set<string>();
      b.questions.forEach((q, qi) => {
        if (qIds.has(q.id)) {
          ctx.addIssue({
            code: "custom",
            path: ["blocks", bi, "questions", qi, "id"],
            message: `Duplicate question id "${q.id}"`,
          });
        }
        qIds.add(q.id);
        for (const col of blockQuestionColumns(q, repeatLevels)) {
          const key = col.toLowerCase();
          if (variables.has(key)) {
            ctx.addIssue({
              code: "custom",
              path: ["blocks", bi, "questions", qi, "variable"],
              message: `Variable name "${col}" is already used by ${variables.get(key)}`,
            });
          } else {
            variables.set(key, `${b.id}/${q.id}`);
          }
        }
        if ("options" in q) {
          const values = q.options.map((o) => o.value);
          if (new Set(values).size !== values.length) {
            ctx.addIssue({
              code: "custom",
              path: ["blocks", bi, "questions", qi, "options"],
              message: "Option codes must be unique",
            });
          }
        }
        if (q.type === "slider" && !(q.max > q.min)) {
          ctx.addIssue({ code: "custom", path: ["blocks", bi, "questions", qi, "max"], message: "Max must be greater than min" });
        }
        if (q.type === "matrix") {
          const codes = q.rows.map((r) => r.code.toLowerCase());
          if (new Set(codes).size !== codes.length) {
            ctx.addIssue({ code: "custom", path: ["blocks", bi, "questions", qi, "rows"], message: "Row codes must be unique" });
          }
        }
      });
    });
    if (!cfg.blocks.some((b) => b.type === "end")) {
      ctx.addIssue({ code: "custom", path: ["blocks"], message: "The study needs an End block" });
    }
  });
export type StudyConfig = z.infer<typeof StudyConfig>;

function validateDesign(cfg: { design: Design }, ctx: z.RefinementCtx) {
  const d = cfg.design;
  if (d.conditions.length === 1) {
    ctx.addIssue({ code: "custom", path: ["design", "conditions"], message: "Use at least two conditions, or none" });
  }
  const unique = (vals: string[], path: (string | number)[], what: string) => {
    const seen = new Set<string>();
    for (const v of vals) {
      const k = v.toLowerCase();
      if (seen.has(k)) ctx.addIssue({ code: "custom", path, message: `Duplicate ${what} "${v}"` });
      seen.add(k);
    }
  };
  unique(d.conditions.map((c) => c.id), ["design", "conditions"], "condition code");
  unique(d.factors.map((f) => f.id), ["design", "factors"], "factor id");
  unique(d.factors.map((f) => f.variable), ["design", "factors"], "factor variable");
  unique(d.orderGroups.map((g) => g.id), ["design", "orderGroups"], "order group");
  d.factors.forEach((f, i) => {
    const path = ["design", "factors", i];
    unique(f.levels.map((l) => l.value), [...path, "levels"], "level value");
    if (f.kind === "pick" && (f.method === "latin" || f.method === "permutation")) {
      ctx.addIssue({ code: "custom", path: [...path, "method"], message: "Pick factors use random, balanced or fixed assignment" });
    }
    if (f.kind !== "pick" && f.method === "balanced") {
      ctx.addIssue({ code: "custom", path: [...path, "method"], message: "For orders and mappings use Latin square or full permutation to balance" });
    }
    if (f.method === "permutation" && f.levels.length > 6) {
      ctx.addIssue({ code: "custom", path: [...path, "method"], message: "Full permutation supports at most 6 levels (720 orders); use a Latin square" });
    }
    if (f.kind === "pick" && f.method === "fixed" && !f.levels.some((l) => l.value === f.fixedValue)) {
      ctx.addIssue({ code: "custom", path: [...path, "fixedValue"], message: "Choose which level everyone gets" });
    }
    if (f.kind === "mapping") {
      if (f.targets.length !== f.levels.length) {
        ctx.addIssue({ code: "custom", path: [...path, "targets"], message: "A mapping needs exactly as many targets as levels" });
      }
      unique(f.targets.map((t) => t.value), [...path, "targets"], "target value");
    }
  });
}

/** Every column name a question produces in the wide export. */
export function exportVariableNames(q: Question): string[] {
  switch (q.type) {
    case "multiple":
      return [
        ...q.options.map((o) => `${q.variable}_${codeSuffix(o.value)}`),
        ...(q.special.notSure ? [`${q.variable}_notsure`] : []),
        ...(q.special.preferNot ? [`${q.variable}_prefnot`] : []),
      ];
    case "image_choice":
      return q.multiple ? q.options.map((o) => `${q.variable}_${codeSuffix(o.value)}`) : [q.variable];
    case "ranking":
      return q.options.map((o) => `${q.variable}_${codeSuffix(o.value)}`);
    case "matrix":
      return q.rows.map((r) => `${q.variable}_${r.code}`);
    default:
      return [q.variable];
  }
}

export function codeSuffix(value: number): string {
  return value < 0 ? `m${Math.abs(value)}` : String(value);
}

export function parseStudyConfig(input: unknown) {
  return StudyConfig.safeParse(input);
}
