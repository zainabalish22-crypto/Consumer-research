/**
 * Study configuration schema.
 *
 * A study is a versioned JSON document that the participant renderer reads.
 * Every block type is registered here with its schema; the editor and renderer
 * components live in src/components/blocks and are looked up by `type`.
 */
import { z } from "zod";
import { LANGUAGES, LocalizedText, MediaRef, type Language } from "./schema-base";
import { LibrarySnapshot } from "./library";

export { LANGUAGES, LocalizedText, MediaRef };
export type { Language };

/** Codes written to the data for the optional special answers. */
export const SPECIAL_CODES = { notSure: -98, preferNot: -99 } as const;

const id = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, "Use letters, numbers, - or _ (max 40)");
export const variableName = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/, "Start with a letter; letters, numbers and _ only (max 64)");

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
/** Constant sum: split a fixed total (e.g. 100 points) across options. */
export const ConstantSumQ = QuestionBase.extend({
  type: z.literal("constant_sum"),
  options: z.array(ChoiceOption).min(2).max(20),
  total: z.number().int().min(1).max(10_000).default(100),
  unit: LocalizedText.optional(),
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
  ConstantSumQ,
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
  "constant_sum",
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

/** `ref` optionally links a level to a library object (a brand, store, offer, product or ad). */
export const FactorLevel = z.object({ id, value: code, label: LocalizedText, ref: z.string().uuid().optional() });
export type FactorLevel = z.infer<typeof FactorLevel>;
export const REF_KINDS = ["brand", "store", "offer", "product", "ad"] as const;

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
  targets: z.array(FactorLevel).max(12).default([]),
  /** What level refs point to (e.g. offers), and target refs for mappings (e.g. stores). */
  refKind: z.enum(REF_KINDS).optional(),
  targetRefKind: z.enum(REF_KINDS).optional(),
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

// ---------------------------------------------------------------------------
// Environment and advertising blocks (Phase 3)
// ---------------------------------------------------------------------------

/** How to order library items (stores, ads) for a participant. */
export const ItemOrder = z.object({
  mode: z.enum(["listed", "random", "factor"]).default("listed"),
  /** An order factor whose level refs point to the items (or to their brands). */
  factorId: id.optional(),
});
export type ItemOrder = z.infer<typeof ItemOrder>;

/** Which ad version each participant sees, and when the disclosure label is shown. */
export const AdRules = z.object({
  version: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("fixed"), key: code }),
    /** The ad whose brand is the participant's level of `factorId` shows `targetKey`; others show `otherKey`. */
    z.object({ mode: z.literal("targeted"), factorId: id, targetKey: code, otherKey: code }),
  ]),
  disclosure: z
    .object({
      showFor: z.enum(["none", "targeted", "all"]).default("none"),
      /** Conditions that see the label (empty = everyone). */
      conditions: z.array(code).max(20).default([]),
    })
    .default({ showFor: "none", conditions: [] }),
});
export type AdRules = z.infer<typeof AdRules>;

export const OfferRule = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }),
  z.object({ mode: z.literal("fixed"), byStore: z.record(z.string().uuid(), z.string().uuid()).default({}) }),
  /** A mapping factor whose targets ref stores and levels ref offers. */
  z.object({ mode: z.literal("factor"), factorId: id }),
]);
export type OfferRule = z.infer<typeof OfferRule>;

const DEFAULT_AD_RULES: AdRules = { version: { mode: "fixed", key: "main" }, disclosure: { showFor: "none", conditions: [] } };

export const AdExposureBlock = BlockBase.extend({
  type: z.literal("ad_exposure"),
  heading: LocalizedText.optional(),
  intro: LocalizedText.optional(),
  ads: z.array(z.string().uuid()).min(1).max(30),
  order: ItemOrder.default({ mode: "listed" }),
  rules: AdRules.default(DEFAULT_AD_RULES),
  minViewSeconds: z.number().int().min(0).max(3600).default(0),
  requireEnd: z.boolean().default(false),
  autoplay: z.boolean().default(false),
  showControls: z.boolean().default(true),
});

const storeSet = {
  /** Prefix for this block's export variables, e.g. "fc" → fc_S1_entered. */
  variable: variableName,
  stores: z.array(z.string().uuid()).min(1).max(60),
  storeOrder: ItemOrder.default({ mode: "listed" }),
  offers: OfferRule.default({ mode: "none" }),
  currency: z.string().regex(/^[A-Z]{3}$/).default("BHD"),
};

/** Choice task: pick one store (or none) from cards showing each store's offer. */
export const StoreChoiceBlock = BlockBase.extend({
  type: z.literal("store_choice"),
  ...storeSet,
  heading: LocalizedText.optional(),
  prompt: LocalizedText,
  showProducts: z.boolean().default(true),
  allowNone: z.boolean().default(false),
  noneLabel: LocalizedText.default({ en: "None of these", ar: "لا شيء مما سبق" }),
});

/** Walkable 2D shopping street (or food court) with enterable stores. */
export const VillageBlock = BlockBase.extend({
  type: z.literal("village"),
  ...storeSet,
  heading: LocalizedText.optional(),
  instructions: LocalizedText.default({}),
  theme: z.enum(["minimal", "neutral"]).default("minimal"),
  layout: z.enum(["street", "foodcourt"]).default("street"),
  productOrder: z.enum(["listed", "random"]).default("listed"),
  ads: AdRules.default(DEFAULT_AD_RULES),
  /** Distance (in street units) that counts as standing in front of a store. */
  approachDistance: z.number().int().min(40).max(400).default(120),
  /** Seconds the participant must stay that close for an "approach" to count. */
  approachSeconds: z.number().min(0).max(10).default(1),
  mustEnterStores: z.number().int().min(0).max(60).default(0),
  minPurchases: z.number().int().min(0).max(50).default(0),
  maxPurchases: z.number().int().min(1).max(100).default(10),
  budget: z.number().min(0).max(1_000_000).optional(),
  timeLimitSec: z.number().int().min(10).max(7200).optional(),
  /** Optional yes/no question when leaving a store, e.g. "Would you consider buying here?" */
  considerationPrompt: LocalizedText.optional(),
});
export type VillageBlock = z.infer<typeof VillageBlock>;

/**
 * Online shop: a realistic e-commerce site (home, listing with search, filters and
 * sorting, product pages, cart and a simulated checkout). No real payment, no real
 * orders, and no payment details are ever collected.
 */
export const OnlineShopBlock = BlockBase.extend({
  type: z.literal("online_shop"),
  /** Prefix for this block's export variables, e.g. "shop" → shop_items. */
  variable: variableName,
  heading: LocalizedText.optional(),
  instructions: LocalizedText.default({}),
  shopName: LocalizedText.default({ en: "Shop", ar: "المتجر" }),
  products: z.array(z.string().uuid()).min(1).max(300),
  productOrder: ItemOrder.default({ mode: "listed" }),
  /** Offers per product: fixed, or a mapping factor whose targets ref products (or brands). */
  offers: OfferRule.default({ mode: "none" }),
  currency: z.string().regex(/^[A-Z]{3}$/).default("BHD"),
  ads: AdRules.default(DEFAULT_AD_RULES),
  placements: z
    .object({
      banner: z.array(z.string().uuid()).max(10).default([]),
      sidebar: z.array(z.string().uuid()).max(10).default([]),
      /** Products shown at the top of listings with a "Sponsored" tag. */
      sponsored: z.array(z.string().uuid()).max(20).default([]),
      popup: z.string().uuid().nullable().default(null),
      popupDelaySec: z.number().int().min(0).max(600).default(5),
    })
    .default({ banner: [], sidebar: [], sponsored: [], popup: null, popupDelaySec: 5 }),
  showSearch: z.boolean().default(true),
  showFilters: z.boolean().default(true),
  showSort: z.boolean().default(true),
  showRatings: z.boolean().default(true),
  minItems: z.number().int().min(0).max(50).default(0),
  maxItems: z.number().int().min(1).max(100).default(20),
  budget: z.number().min(0).max(1_000_000).optional(),
  timeLimitSec: z.number().int().min(10).max(7200).optional(),
  /** Participants must complete the simulated checkout to continue. */
  requireCheckout: z.boolean().default(true),
});
export type OnlineShopBlock = z.infer<typeof OnlineShopBlock>;

/**
 * One item in a social feed: an organic post written by the researcher, or a
 * sponsored post that shows a library ad (with its version and disclosure rules).
 */
export const FeedPost = z.object({
  id,
  kind: z.enum(["post", "ad"]),
  /** Library ad shown by a sponsored post. */
  adId: z.string().uuid().optional(),
  author: LocalizedText,
  text: LocalizedText,
  /** Image or video for organic posts (sponsored posts use the ad's media). */
  media: MediaRef.optional(),
  /** Like count shown on the post (a researcher-set stimulus, not real data). */
  likes: z.number().int().min(0).max(10_000_000).optional(),
});
export type FeedPost = z.infer<typeof FeedPost>;

/** A scrolling social-media style feed with like / save / hide and per-post viewing time. */
export const SocialFeedBlock = BlockBase.extend({
  type: z.literal("social_feed"),
  /** Prefix for this block's export variables, e.g. "feed" → feed_p1_liked. */
  variable: variableName,
  heading: LocalizedText.optional(),
  intro: LocalizedText.optional(),
  platformName: LocalizedText.default({ en: "Feed", ar: "الصفحة الرئيسية" }),
  posts: z.array(FeedPost).min(1).max(60),
  postOrder: ItemOrder.default({ mode: "listed" }),
  ads: AdRules.default(DEFAULT_AD_RULES),
  actions: z
    .object({ like: z.boolean().default(true), save: z.boolean().default(true), hide: z.boolean().default(true) })
    .default({ like: true, save: true, hide: true }),
  showCounts: z.boolean().default(true),
  /** Seconds before the participant may continue. */
  minSeconds: z.number().int().min(0).max(3600).default(0),
});
export type SocialFeedBlock = z.infer<typeof SocialFeedBlock>;
export type StoreChoiceBlock = z.infer<typeof StoreChoiceBlock>;
export type AdExposureBlock = z.infer<typeof AdExposureBlock>;

export const Block = z.discriminatedUnion("type", [
  AdExposureBlock,
  StoreChoiceBlock,
  VillageBlock,
  OnlineShopBlock,
  SocialFeedBlock,
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
    .object({ navigation: z.boolean().default(true), media: z.boolean().default(true), environment: z.boolean().default(true) })
    .default({ navigation: true, media: true, environment: true }),
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
    /** Snapshot of the library objects this study uses, filled in at publish time. */
    library: LibrarySnapshot.optional(),
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
    const prefixes: string[] = [];
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
      if (b.type === "consent" || b.type === "end" || b.type === "village" || b.type === "store_choice" || b.type === "online_shop" || b.type === "social_feed") {
        if (b.repeat) ctx.addIssue({ code: "custom", path: ["blocks", bi, "repeat"], message: "This block cannot be repeated" });
      }
      const factorOf = (fid: string | undefined, kinds: string[], path: string, what: string) => {
        const f = cfg.design.factors.find((x) => x.id === fid);
        if (!f || !kinds.includes(f.kind)) {
          ctx.addIssue({ code: "custom", path: ["blocks", bi, path], message: `Choose a ${kinds.join(" or ")} factor for ${what}` });
        }
      };
      if (b.type === "social_feed") {
        const prefix = b.variable.toLowerCase();
        if (variables.has(prefix)) {
          ctx.addIssue({ code: "custom", path: ["blocks", bi, "variable"], message: `Variable prefix "${b.variable}" is already used by ${variables.get(prefix)}` });
        }
        variables.set(prefix, `${b.id} (prefix)`);
        prefixes.push(prefix);
        if (b.postOrder.mode === "factor") {
          ctx.addIssue({ code: "custom", path: ["blocks", bi, "postOrder"], message: "Feed posts can be shown as listed or in random order" });
        }
        const postIds = new Set<string>();
        b.posts.forEach((p, pi) => {
          if (postIds.has(p.id)) ctx.addIssue({ code: "custom", path: ["blocks", bi, "posts", pi, "id"], message: `Duplicate post id "${p.id}"` });
          postIds.add(p.id);
          if (p.kind === "ad" && !p.adId) ctx.addIssue({ code: "custom", path: ["blocks", bi, "posts", pi, "adId"], message: "Choose an ad for this sponsored post" });
        });
      }
      if (b.type === "village" || b.type === "store_choice" || b.type === "online_shop") {
        const prefix = b.variable.toLowerCase();
        if (variables.has(prefix)) {
          ctx.addIssue({ code: "custom", path: ["blocks", bi, "variable"], message: `Variable prefix "${b.variable}" is already used by ${variables.get(prefix)}` });
        }
        variables.set(prefix, `${b.id} (prefix)`);
        prefixes.push(prefix);
        const order = b.type === "online_shop" ? b.productOrder : b.storeOrder;
        if (order.mode === "factor") factorOf(order.factorId, ["order"], b.type === "online_shop" ? "productOrder" : "storeOrder", "the order");
        if (b.offers.mode === "factor") factorOf(b.offers.factorId, ["mapping"], "offers", "the offers");
      }
      if (b.type === "online_shop" && b.minItems > b.maxItems) {
        ctx.addIssue({ code: "custom", path: ["blocks", bi, "minItems"], message: "Minimum items cannot be more than maximum items" });
      }
      if (b.type === "ad_exposure" && b.order.mode === "factor") factorOf(b.order.factorId, ["order"], "order", "the ad order");
      const adRules = b.type === "ad_exposure" ? b.rules : b.type === "village" || b.type === "online_shop" || b.type === "social_feed" ? b.ads : null;
      if (adRules?.version.mode === "targeted") factorOf(adRules.version.factorId, ["pick"], "rules", "the targeted ad version");
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
    // Environment blocks generate prefix_* columns; nothing else may use that namespace.
    for (const [name, owner] of variables) {
      const clash = prefixes.find((p) => name !== p && name.startsWith(`${p}_`));
      if (clash) ctx.addIssue({ code: "custom", path: ["blocks"], message: `Variable "${name}" (${owner}) uses the reserved prefix "${clash}_"` });
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
    case "constant_sum":
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
