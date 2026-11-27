/**
 * The study model. A study is an ordered flow of blocks (docs/PLATFORM_BRIEF.md, section 4).
 * The form builder edits the blocks and questions; the e-commerce simulator is the "shop" block
 * with its own configuration. Researcher text is stored per language.
 */
export type Lang = "en" | "ar";
/** Text in one or both languages. */
export type L10n = Partial<Record<Lang, string>>;

/** A media reference: "media:<id>" for an upload kept in this browser, or an https URL. */
export type MediaRef = string;

export type QuestionType =
  | "single"
  | "multiple"
  | "dropdown"
  | "likert"
  | "semantic"
  | "slider"
  | "matrix"
  | "ranking"
  | "numeric"
  | "short"
  | "long"
  | "date"
  | "image"
  /** Display only: a title, text and optional image or video between questions. No answer. */
  | "info";

export type Option = { id: string; value: string; label: L10n; image?: MediaRef };

export type Question = {
  id: string;
  type: QuestionType;
  /** Stable variable name used as the export column. */
  variable: string;
  text: L10n;
  help?: L10n;
  required: boolean;
  /** Shuffle the options per participant. */
  randomize?: boolean;
  /** Choice, dropdown, ranking and image types. Matrix uses them as the answer columns. */
  options?: Option[];
  /** Matrix rows. */
  rows?: Option[];
  /** An extra, separate answer. */
  extra?: "none" | "not_sure" | "prefer_not";
  /** Likert and semantic differential. */
  scale?: { points: number; left: L10n; right: L10n };
  /** Slider. */
  range?: { min: number; max: number; step: number; left: L10n; right: L10n };
  /** Numeric limits. */
  limits?: { min?: number; max?: number };
  /** Instructed-response attention check: the expected answer's value; failures are flagged. */
  attention?: string;
  /** An image or video shown with the question. */
  media?: MediaRef;
  /** Skip logic: show this question only when an earlier answer matches. */
  showIf?: { variable: string; op: "is" | "is_not"; value: string };
  /** Screening: these answers end the study politely (single choice and dropdown). */
  endIf?: string[];
  /** Different wording or media for some conditions (between-subjects levels). */
  variants?: Variant[];
};

type Base = {
  id: string;
  /** Show this step only to participants in these levels (every listed factor must match). */
  showFor?: { factor: string; levels: string[] }[];
};
export type WelcomeBlock = Base & { type: "welcome"; title: L10n; body: L10n; duration?: L10n; contact?: string };
export type ConsentBlock = Base & { type: "consent"; title: L10n; body: L10n; agree: L10n; decline: L10n; version: string };
export type InstructionsBlock = Base & { type: "instructions"; title: L10n; body: L10n; image?: MediaRef };
export type QuestionsBlock = Base & {
  type: "questions";
  title: L10n;
  description?: L10n;
  questions: Question[];
  /** Within-subjects: show this section once per level of this factor, in Latin-square order. */
  repeatFor?: string;
  /** Show the questions of this section in a random order. */
  shuffleQuestions?: boolean;
  /** Shuffle this section's position with the other sections marked the same way. */
  shuffleWith?: boolean;
};
export type MediaBlock = Base & { type: "media"; title: L10n; body: L10n; items: MediaRef[]; minSeconds?: number };
export type ShopBlock = Base & { type: "shop"; title: L10n; body: L10n };
export type EndBlock = Base & { type: "end"; title: L10n; body: L10n; code?: string; redirect?: string };

export type Block = WelcomeBlock | ConsentBlock | InstructionsBlock | QuestionsBlock | MediaBlock | ShopBlock | EndBlock;
export type BlockType = Block["type"];

/* ------------------------------------------------------------ e-commerce simulator */

export type Category = { id: string; name: L10n };
export type Review = { id: string; author: string; stars: number; text: L10n };
export type Product = {
  id: string;
  name: L10n;
  description: L10n;
  category: string;
  price: number;
  /** Original price, shown struck through when higher than the price. */
  was?: number;
  /** Offer label, e.g. "Buy one, get one free". */
  offer?: L10n;
  images: MediaRef[];
  /** Shown as a sponsored placement in listings. */
  sponsored?: boolean;
  /** Researcher-created stimuli, labelled as such in the builder. */
  rating?: number;
  reviews?: Review[];
  attributes?: { key: L10n; value: L10n }[];
  /** Different price, offer or placement for some conditions. */
  variants?: ProductVariant[];
};
export type Banner = { id: string; image: MediaRef; headline: L10n; placement: "hero" | "listing"; product?: string };
export type Shop = {
  name: L10n;
  currency: string;
  categories: Category[];
  products: Product[];
  banners: Banner[];
  /** Product order on listing pages. */
  order: "fixed" | "random";
  /** Optional simulated budget. */
  budget?: number;
  accent: string;
};

/* ------------------------------------------------------------ study */

export type Study = {
  id: string;
  /** Starting point; both kinds are block flows and can be combined. */
  kind: "form" | "shop";
  name: string;
  languages: Lang[];
  status: "draft" | "published";
  version: number;
  blocks: Block[];
  shop?: Shop;
  /** Participant accent colour (the participant view is light). */
  accent: string;
  /** Banner image above the form's title. */
  header?: MediaRef;
  /** How the study runs once published: repeats, closing and panel return links. */
  settings?: StudySettings;
  /** The experiment: factors, levels and quotas. Absent for a study without conditions. */
  design?: Design;
  createdAt: string;
  updatedAt: string;
};

/**
 * Who may take part and when, and where panel participants are sent back to. Return links may
 * contain {pid}, replaced by the participant's panel ID.
 */
export type StudySettings = {
  /** Allow repeats, or allow one attempt per device, per panel ID, or both. */
  repeat: "allow" | "device" | "panel" | "both";
  /** The link parameter that carries the panel ID (Prolific uses PROLIFIC_PID). */
  panelParam: string;
  returns: { completed?: string; screened?: string; declined?: string };
  /** The study stops accepting participants after this moment (ISO date-time). */
  closesAt?: string;
  /** Closed by the researcher; reopening clears it. */
  closed?: boolean;
};

export const DEFAULT_SETTINGS: StudySettings = { repeat: "both", panelParam: "pid", returns: {} };

/* ------------------------------------------------------------ participants */

export type Answer = string | number | string[] | Record<string, string>;

export type StudyEvent = {
  /** Milliseconds since the session started. */
  t: number;
  type: string;
  block?: string;
  data?: Record<string, string | number>;
};

export type Session = {
  id: string;
  studyId: string;
  version: number;
  /** Preview and test sessions are flagged and kept apart from real data. */
  test: boolean;
  lang: Lang;
  status: "active" | "completed" | "declined" | "screened";
  startedAt: string;
  finishedAt?: string;
  /** URL parameters passed in by a panel, e.g. a participant ID. */
  params: Record<string, string>;
  answers: Record<string, Answer>;
  /** Attention checks failed (variable names). */
  flags: string[];
  /** The condition this participant was given, decided on the server at the start. */
  assignment?: Assignment;
  /** Simulated basket at checkout. */
  basket?: { product: string; qty: number; price: number }[];
  events: StudyEvent[];
};

/* ------------------------------------------------------------ experimental engine */

/** One level of a factor, e.g. "label" of the factor "disclosure". "value" is what the export shows. */
export type Level = { id: string; value: string; label: L10n };

/**
 * A factor. Between-subjects: each participant gets one level. Within-subjects: each participant
 * sees every level, in an order taken from a Latin square.
 */
export type Factor = { id: string; name: string; kind: "between" | "within"; levels: Level[] };

/** A target number of completed participants with a given answer to a screening question. */
export type Quota = { id: string; variable: string; value: string; target: number };

export type Design = { factors: Factor[]; quotas: Quota[] };

/** A condition: one level of one factor (by id). */
export type When = { factor: string; level: string };

export type Variant = { when: When; text?: L10n; help?: L10n; media?: MediaRef };

export type ProductVariant = { when: When; price?: number; was?: number; offer?: L10n; sponsored?: boolean };

/**
 * What a participant was given: one level per between-subjects factor (factor id → level id),
 * and an order of levels per within-subjects factor (factor id → level ids).
 */
export type Assignment = { between: Record<string, string>; orders: Record<string, string[]> };
