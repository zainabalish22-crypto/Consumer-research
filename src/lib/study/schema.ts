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
// Blocks
// ---------------------------------------------------------------------------

const BlockBase = z.object({
  id,
  /** Researcher-facing name shown in the builder; never shown to participants. */
  name: z.string().max(120).default(""),
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
export const QuestionnaireBlock = BlockBase.extend({
  type: z.literal("questionnaire"),
  heading: LocalizedText.optional(),
  intro: LocalizedText.optional(),
  questions: z.array(Question).max(200),
  randomizeQuestions: z.boolean().default(false),
});
export const DemographicsBlock = QuestionnaireBlock.extend({ type: z.literal("demographics") });
export const MediaBlock = BlockBase.extend({
  type: z.literal("media"),
  heading: LocalizedText.optional(),
  items: z
    .array(MediaRef.extend({ caption: LocalizedText.optional() }))
    .min(1)
    .max(50),
  /** Seconds before the participant may continue. */
  minViewSeconds: z.number().int().min(0).max(3600).default(0),
  requireVideoEnd: z.boolean().default(false),
  autoplay: z.boolean().default(false),
  showControls: z.boolean().default(true),
});
export const EndBlock = BlockBase.extend({
  type: z.literal("end"),
  heading: LocalizedText,
  body: LocalizedText,
  completionCode: z.string().max(100).optional(),
  redirectUrl: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), "Redirect URL must start with https://")
    .optional(),
});

export const Block = z.discriminatedUnion("type", [
  WelcomeBlock,
  ConsentBlock,
  InstructionsBlock,
  QuestionnaireBlock,
  DemographicsBlock,
  MediaBlock,
  EndBlock,
]);
export type Block = z.infer<typeof Block>;
export type BlockType = Block["type"];
export type QuestionBlock = z.infer<typeof QuestionnaireBlock> | z.infer<typeof DemographicsBlock>;

export function isQuestionBlock(b: Block): b is QuestionBlock {
  return b.type === "questionnaire" || b.type === "demographics";
}

export const StudySettings = z.object({
  languages: z.array(z.enum(LANGUAGES)).min(1).max(2),
  defaultLanguage: z.enum(LANGUAGES),
  showProgress: z.boolean().default(true),
  allowResume: z.boolean().default(true),
  theme: z.enum(["neutral"]).default("neutral"),
});
export type StudySettings = z.infer<typeof StudySettings>;

export const StudyConfig = z
  .object({
    schemaVersion: z.literal(1),
    settings: StudySettings,
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
    const blockIds = new Set<string>();
    const variables = new Map<string, string>();
    cfg.blocks.forEach((b, bi) => {
      if (blockIds.has(b.id)) {
        ctx.addIssue({ code: "custom", path: ["blocks", bi, "id"], message: `Duplicate block id "${b.id}"` });
      }
      blockIds.add(b.id);
      if (!isQuestionBlock(b)) return;
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
        for (const col of exportVariableNames(q)) {
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
