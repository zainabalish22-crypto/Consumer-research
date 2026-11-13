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
};

type Base = { id: string };
export type WelcomeBlock = Base & { type: "welcome"; title: L10n; body: L10n; duration?: L10n; contact?: string };
export type ConsentBlock = Base & { type: "consent"; title: L10n; body: L10n; agree: L10n; decline: L10n; version: string };
export type InstructionsBlock = Base & { type: "instructions"; title: L10n; body: L10n; image?: MediaRef };
export type QuestionsBlock = Base & { type: "questions"; title: L10n; description?: L10n; questions: Question[] };
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
  createdAt: string;
  updatedAt: string;
};

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
  /** Simulated basket at checkout. */
  basket?: { product: string; qty: number; price: number }[];
  events: StudyEvent[];
};
