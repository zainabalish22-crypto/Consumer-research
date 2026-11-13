import type { Block, BlockType, L10n, Option, Product, Question, QuestionType, Shop, Study } from "./types";
import { uid } from "./util";

const t = (en: string, ar: string): L10n => ({ en, ar });

const opts = (pairs: [string, string][]): Option[] => pairs.map(([en, ar], i) => ({ id: uid("o"), value: String(i + 1), label: t(en, ar) }));

/** A new question of the given type, with sensible starting content. */
export function newQuestion(type: QuestionType, n: number): Question {
  const base: Question = { id: uid("q"), type, variable: `q${n}`, text: t("Untitled question", "سؤال بلا عنوان"), required: true };
  switch (type) {
    case "single":
    case "multiple":
    case "dropdown":
    case "ranking":
      return { ...base, options: opts([["Option 1", "الخيار 1"], ["Option 2", "الخيار 2"], ["Option 3", "الخيار 3"]]) };
    case "image":
      return { ...base, options: opts([["Image A", "الصورة أ"], ["Image B", "الصورة ب"]]) };
    case "likert":
      return { ...base, scale: { points: 7, left: t("Strongly disagree", "أعارض بشدة"), right: t("Strongly agree", "أوافق بشدة") } };
    case "semantic":
      return { ...base, scale: { points: 7, left: t("Unappealing", "غير جذّاب"), right: t("Appealing", "جذّاب") } };
    case "slider":
      return { ...base, range: { min: 0, max: 100, step: 1, left: t("Not at all", "إطلاقًا"), right: t("Completely", "تمامًا") } };
    case "matrix":
      return {
        ...base,
        rows: opts([["Statement 1", "العبارة 1"], ["Statement 2", "العبارة 2"]]),
        options: opts([["Disagree", "أعارض"], ["Neutral", "محايد"], ["Agree", "أوافق"]]),
      };
    case "numeric":
      return { ...base, limits: { min: 0 } };
    case "info":
      return { ...base, required: false, text: t("Title", "عنوان"), help: t("", "") };
    default:
      return base;
  }
}

/** A new block of the given type. */
export function newBlock(type: BlockType): Block {
  const id = uid("b");
  switch (type) {
    case "welcome":
      return { id, type, title: t("Welcome", "أهلًا بك"), body: t("Thank you for taking part. This study takes about 10 minutes.", "شكرًا لمشاركتك. تستغرق هذه الدراسة نحو 10 دقائق."), contact: "" };
    case "consent":
      return {
        id,
        type,
        title: t("Consent", "الموافقة على المشاركة"),
        body: t(
          "[Your approved consent text.] Taking part is voluntary. You can stop at any time without giving a reason. Your answers are recorded without your name.",
          "[نصّ الموافقة المعتمد.] المشاركة طوعية، ويمكنك التوقّف في أي وقت من دون ذكر السبب. تُسجَّل إجاباتك من دون اسمك.",
        ),
        agree: t("I agree to take part", "أوافق على المشاركة"),
        decline: t("I do not agree", "لا أوافق"),
        version: "1",
      };
    case "instructions":
      return { id, type, title: t("Instructions", "التعليمات"), body: t("Explain the next task here.", "اشرح المهمة التالية هنا.") };
    case "questions":
      return { id, type, title: t("Questions", "أسئلة"), questions: [] };
    case "media":
      return { id, type, title: t("Please look at the following", "يُرجى مشاهدة ما يلي"), body: {}, items: [], minSeconds: 5 };
    case "shop":
      return { id, type, title: t("Online shop", "المتجر الإلكتروني"), body: t("Shop as you normally would. Choose what you would buy, then check out. No real payment is taken.", "تسوّق كما تفعل عادةً. اختر ما كنت ستشتريه ثم أتمم الطلب. لن يُطلب منك أي دفع حقيقي.") };
    case "end":
      return { id, type, title: t("Thank you", "شكرًا لك"), body: t("Your responses have been recorded.", "سُجّلت إجاباتك."), code: "" };
  }
}

const S = "/samples";

function product(name: L10n, description: L10n, category: string, price: number, image: string, extra: Partial<Product> = {}): Product {
  return { id: uid("p"), name, description, category, price, images: [image], ...extra };
}

/** Starter shop: a small café with offers. Researchers replace it with their own products and photos. */
export function starterShop(): Shop {
  const cold = { id: uid("c"), name: t("Cold drinks", "مشروبات باردة") };
  const hot = { id: uid("c"), name: t("Signature", "مختارات") };
  return {
    name: t("Corner Café", "مقهى الزاوية"),
    currency: "BHD",
    categories: [cold, hot],
    products: [
      product(t("Iced latte", "لاتيه مثلّج"), t("Double espresso over ice with fresh milk.", "جرعتا إسبريسو على الثلج مع حليب طازج."), cold.id, 1.8, `${S}/iced-latte.jpg`, { rating: 4.5 }),
      product(t("Cold brew with milk", "كولد برو بالحليب"), t("Coffee steeped cold for 16 hours, finished with milk.", "قهوة منقوعة على البارد 16 ساعة، تُقدَّم مع الحليب."), cold.id, 1, `${S}/cold-brew-milk.jpg`, { was: 2, offer: t("50% off", "خصم 50%"), rating: 4.2 }),
      product(t("Spanish latte", "لاتيه إسباني"), t("Espresso with sweetened condensed milk, served cold.", "إسبريسو مع حليب مكثّف محلّى، يُقدَّم باردًا."), hot.id, 2, `${S}/iced-latte.jpg`, { offer: t("Buy one, get one free", "اشترِ واحدًا واحصل على الآخر مجانًا"), sponsored: true }),
      product(t("Vanilla cold brew", "كولد برو بالفانيلا"), t("Cold brew with a touch of vanilla.", "كولد برو مع لمسة من الفانيلا."), hot.id, 1.6, `${S}/cold-brew-milk.jpg`, { was: 2.1, offer: t("0.500 off", "خصم 0.500") }),
    ],
    banners: [{ id: uid("a"), image: `${S}/cold-brew-milk.jpg`, headline: t("New: cold brew, steeped for 16 hours", "جديد: كولد برو منقوع 16 ساعة"), placement: "hero" }],
    order: "fixed",
    accent: "#1F5C4E",
  };
}

/** A new study in one language. A form starts like a new Google Form: a title and one question. */
export function newStudy(kind: "form" | "shop", name: string, lang: "en" | "ar" = "en"): Study {
  const now = new Date().toISOString();
  const one = (l: L10n): L10n => ({ [lang]: l[lang] ?? "" });
  const strip = <T,>(v: T): T => JSON.parse(JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) && ("en" in x || "ar" in x) && Object.keys(x).every((k) => k === "en" || k === "ar") ? one(x) : x)));
  const questions: Block = { ...(newBlock("questions") as Extract<Block, { type: "questions" }>), title: { [lang]: name }, description: {}, questions: [newQuestion("single", 1)] };
  const blocks: Block[] = strip(kind === "form" ? [questions, newBlock("end")] : [questions, newBlock("shop"), newBlock("end")]);
  return {
    id: uid("s"),
    kind,
    name,
    languages: [lang],
    status: "draft",
    version: 1,
    blocks,
    shop: kind === "shop" ? strip(starterShop()) : undefined,
    accent: "#1F5C4E",
    createdAt: now,
    updatedAt: now,
  };
}

/** Thirteen question types, in the order the builder lists them. */
export const QUESTION_TYPES: QuestionType[] = ["short", "long", "single", "multiple", "dropdown", "likert", "semantic", "slider", "matrix", "ranking", "numeric", "date", "image"];
export const BLOCK_TYPES: BlockType[] = ["welcome", "consent", "instructions", "questions", "media", "shop", "end"];
