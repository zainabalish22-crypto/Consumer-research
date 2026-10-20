/**
 * Study templates. A template is plain data: library objects (brands, stores,
 * products, offers, ads) plus a study configuration that references them.
 * Creating a study from a template inserts these through the normal library
 * tables and study drafts, so everything is editable in the builder afterwards.
 * Nothing here is special-cased in the study engine.
 *
 * Scale items are placeholders: researchers must replace them with the scales
 * they choose and cite. No scale is labelled as validated.
 */
import type { Block, LocalizedText, Question, StudyConfig } from "@/lib/study/schema";
import type { LibAd, LibBrand, LibOffer, LibProduct, LibStore, LibraryKind } from "@/lib/study/library";
import { AGREE_7, newBlock, shortId, startingConfig } from "@/lib/study/factories";

export type TemplateKind = "foodcourt" | "deepfake";

export interface TemplateResult {
  title: string;
  library: { brands: LibBrand[]; products: LibProduct[]; offers: LibOffer[]; ads: LibAd[]; stores: LibStore[] };
  config: StudyConfig;
}

export interface TemplateOptions {
  newId: () => string;
  /** Returns a library code not yet used in the workspace (e.g. "FC1" → "FC1_2" if taken). */
  code: (kind: LibraryKind, wanted: string) => string;
}

const T = (en: string, ar: string): LocalizedText => ({ en, ar });
const opt = (pairs: [string, string][], start = 1) => pairs.map(([en, ar], i) => ({ id: `o${i + 1}`, value: i + start, label: T(en, ar) }));
const yesNo = () => opt([["Yes", "نعم"], ["No", "لا"]]);
const special = { notSure: false, preferNot: false };

function q(variable: string, type: "single" | "likert" | "slider" | "matrix" | "semantic", text: LocalizedText, extra: Record<string, unknown> = {}): Question {
  const base = { id: shortId("q"), variable, text, required: true };
  switch (type) {
    case "single":
      return { ...base, type, options: yesNo(), randomizeOptions: false, special, ...extra } as Question;
    case "likert":
      return { ...base, type, points: 7, startValue: 1, labels: AGREE_7, special, ...extra } as Question;
    case "slider":
      return { ...base, type, min: 0, max: 100, step: 1, leftLabel: T("Not at all confident", "غير واثق إطلاقًا"), rightLabel: T("Completely confident", "واثق تمامًا"), ...extra } as Question;
    case "semantic":
      return { ...base, type, points: 7, startValue: 1, leftLabel: T("", ""), rightLabel: T("", ""), ...extra } as Question;
    case "matrix":
      return { ...base, type, rows: [], columns: [], randomizeRows: false, ...extra } as Question;
  }
}

function questionnaire(cfg: StudyConfig, name: string, heading: LocalizedText, questions: Question[], extra: Partial<Extract<Block, { type: "questionnaire" }>> = {}) {
  const b = newBlock("questionnaire", cfg) as Extract<Block, { type: "questionnaire" }>;
  Object.assign(b, { name, heading, intro: T("", ""), questions, ...extra });
  return b;
}

const attention = (variable: string, expectedLabel: [string, string], expected: number) =>
  q(variable, "likert", T(`To show you are reading carefully, please select "${expectedLabel[0]}".`, `للتأكد من قراءتك بعناية، يرجى اختيار «${expectedLabel[1]}».`), {
    attentionCheck: { expected },
  });

// ---------------------------------------------------------------------------
// Template A: campus food court (validation study)
// ---------------------------------------------------------------------------

export function foodcourtTemplate(o: TemplateOptions): TemplateResult {
  const outlets: { code: string; name: LocalizedText; color: string; drink: LocalizedText }[] = [
    { code: "FC1", name: T("Brew Lane", "برو لين"), color: "#7c3f00", drink: T("Iced latte", "لاتيه مثلج") },
    { code: "FC2", name: T("Mint & Lime", "نعناع وليمون"), color: "#1b7f5a", drink: T("Mint lemonade", "ليمون بالنعناع") },
    { code: "FC3", name: T("Karak Corner", "ركن الكرك"), color: "#b45309", drink: T("Iced karak", "كرك مثلج") },
    { code: "FC4", name: T("Juice Hub", "جوس هب"), color: "#be123c", drink: T("Fresh orange juice", "عصير برتقال طازج") },
  ];
  const brands: LibBrand[] = outlets.map((x) => ({ id: o.newId(), code: o.code("brand", x.code), name: x.name, logo: null, colors: { primary: x.color, secondary: "#fff7ed" }, fictional: true }));
  const products: LibProduct[] = outlets.map((x, i) => ({
    id: o.newId(),
    code: o.code("product", `${x.code}_D`),
    brandId: brands[i].id,
    name: x.drink,
    description: T("Regular size, 400 ml.", "حجم عادي، 400 مل."),
    images: [],
    basePrice: 2,
    currency: "BHD",
    category: "drink",
    attributes: [],
    originalPrice: null,
    rating: null,
    ratingCount: null,
    reviews: [],
  }));
  const offerDefs: [string, LibOffer["kind"], LibOffer["params"], LocalizedText, LocalizedText][] = [
    ["BOGO", "buy_x_get_y", { buy: 1, get: 1 }, T("Buy one get one free", "اشترِ واحدًا واحصل على الثاني مجانًا"), T("Buy 1 get 1 free", "اشترِ 1 واحصل على 1 مجانًا")],
    ["HALF", "percentage", { percent: 50 }, T("50% off", "خصم 50٪"), T("50% off", "خصم 50٪")],
    ["ONEOFF", "fixed_amount", { amount: 1 }, T("1 BHD off", "خصم دينار واحد"), T("1 BHD off", "خصم دينار واحد")],
    ["NONE", "none", {}, T("No offer", "بدون عرض"), T("", "")],
  ];
  const offers: LibOffer[] = offerDefs.map(([code, kind, params, name, displayText]) => ({ id: o.newId(), code: o.code("offer", code), kind, params, name, displayText }));
  const stores: LibStore[] = outlets.map((x, i) => ({
    id: o.newId(),
    code: o.code("store", `${x.code}_S`),
    brandId: brands[i].id,
    name: x.name,
    facade: { color: x.color, signText: x.name, style: "kiosk", image: null },
    facadeAdId: null,
    productIds: [products[i].id],
    inStoreAdIds: [],
  }));

  const cfg = startingConfig("blank");
  cfg.settings.usesDeception = false;
  cfg.design = {
    assignment: "balanced",
    conditions: [
      { id: "village", label: "Shopping village", weight: 1 },
      { id: "survey", label: "Online questionnaire", weight: 1 },
    ],
    factors: [
      {
        id: "f_outlet_order",
        variable: "outlet_order",
        name: "Outlet order",
        kind: "order",
        method: "latin",
        balanceWithinCondition: true,
        refKind: "store",
        levels: stores.map((s, i) => ({ id: `lv${i + 1}`, value: `O${i + 1}`, label: outlets[i].name, ref: s.id })),
        targets: [],
      },
      {
        id: "f_offer_for_store",
        variable: "offer_for_store",
        name: "Offer assigned to each outlet",
        kind: "mapping",
        method: "latin",
        balanceWithinCondition: true,
        refKind: "offer",
        targetRefKind: "store",
        levels: offers.map((x, i) => ({ id: `of${i + 1}`, value: offerDefs[i][0], label: x.name, ref: x.id })),
        targets: stores.map((s, i) => ({ id: `tg${i + 1}`, value: `O${i + 1}`, label: outlets[i].name, ref: s.id })),
      },
    ],
    orderGroups: [],
  };

  const [welcome, consent, end] = cfg.blocks;
  welcome.name = "Welcome";
  Object.assign(welcome, {
    heading: T("Campus food and drink study", "دراسة الطعام والمشروبات في الحرم الجامعي"),
    body: T(
      "This study is about how students choose where to buy a drink on campus.",
      "تتناول هذه الدراسة كيف يختار الطلبة مكان شراء مشروب في الحرم الجامعي،",
    ),
  });

  const screening = newBlock("screening", cfg) as Extract<Block, { type: "screening" }>;
  screening.name = "Screening";
  screening.questions = [
    q("adult", "single", T("Are you 18 years old or older?", "هل عمرك 18 عامًا أو أكثر؟")),
    q("student", "single", T("Are you currently a university student?", "هل أنت طالب جامعي حاليًا؟")),
    q("prior_fc", "single", T("Have you taken part in a study about a campus food court before?", "هل شاركت سابقًا في دراسة عن ساحة طعام جامعية؟")),
  ];
  screening.eligibleIf = {
    mode: "all",
    clauses: [
      { source: "answer", key: "adult", op: "eq", value: 1 },
      { source: "answer", key: "student", op: "eq", value: 1 },
      { source: "answer", key: "prior_fc", op: "eq", value: 2 },
    ],
  };

  const exclusion = newBlock("exclusion_check", cfg) as Extract<Block, { type: "exclusion_check" }>;
  exclusion.name = "Record participation (for the follow-up study)";
  exclusion.recordList = "foodcourt-2026";

  const background = questionnaire(cfg, "Background", T("About you", "معلومات عنك"), [
    {
      id: shortId("q"),
      variable: "year_of_study",
      type: "single",
      text: T("Which year of study are you in?", "في أي سنة دراسية أنت؟"),
      required: true,
      options: opt([["First", "الأولى"], ["Second", "الثانية"], ["Third", "الثالثة"], ["Fourth or later", "الرابعة أو بعدها"], ["Postgraduate", "دراسات عليا"]]),
      randomizeOptions: false,
      special: { notSure: false, preferNot: true },
    },
    {
      id: shortId("q"),
      variable: "buy_freq",
      type: "single",
      text: T("How often do you buy a drink on campus?", "كم مرة تشتري مشروبًا في الحرم الجامعي؟"),
      required: true,
      options: opt([["Rarely", "نادرًا"], ["About once a week", "مرة أسبوعيًا تقريبًا"], ["Several times a week", "عدة مرات أسبوعيًا"], ["Every day", "يوميًا"]]),
      randomizeOptions: false,
      special,
    },
  ]);

  const task = T(
    "You have a break between classes. Choose where to buy your drink, as you would in real life.",
    "لديك استراحة بين المحاضرات. اختر المكان الذي ستشتري منه مشروبك، كما تفعل في الواقع.",
  );
  const village = newBlock("village", cfg) as Extract<Block, { type: "village" }>;
  Object.assign(village, {
    name: "Purchase task: food court",
    showTo: ["village"],
    variable: "fc",
    heading: T("The food court", "ساحة الطعام"),
    instructions: task,
    stores: stores.map((s) => s.id),
    storeOrder: { mode: "factor", factorId: "f_outlet_order" },
    offers: { mode: "factor", factorId: "f_offer_for_store" },
    layout: "foodcourt",
    theme: "minimal",
    minPurchases: 1,
    maxPurchases: 2,
  });
  const choice = newBlock("store_choice", cfg) as Extract<Block, { type: "store_choice" }>;
  Object.assign(choice, {
    name: "Purchase task: questionnaire",
    showTo: ["survey"],
    variable: "fcq",
    prompt: task,
    stores: stores.map((s) => s.id),
    storeOrder: { mode: "factor", factorId: "f_outlet_order" },
    offers: { mode: "factor", factorId: "f_offer_for_store" },
  });

  const intention = questionnaire(cfg, "Purchase intention per outlet", T("{{stimulus}}", "{{stimulus}}"), [
    q("pi", "likert", T("How likely would you be to buy a drink from {{stimulus}}?", "ما مدى احتمال أن تشتري مشروبًا من {{stimulus}}؟"), {
      labels: [
        T("Very unlikely", "مستبعد جدًا"),
        T("Unlikely", "مستبعد"),
        T("Somewhat unlikely", "مستبعد إلى حد ما"),
        T("Neither", "محايد"),
        T("Somewhat likely", "محتمل إلى حد ما"),
        T("Likely", "محتمل"),
        T("Very likely", "محتمل جدًا"),
      ],
    }),
  ]);
  intention.repeat = { factorId: "f_outlet_order", order: "assigned" };

  const att1 = questionnaire(cfg, "Attention check 1", T("", ""), [attention("attn1", ["Somewhat agree", "أوافق إلى حد ما"], 5)], { role: "attention" });

  const experience = questionnaire(
    cfg,
    "Presence, realism and usability (replace placeholders with your chosen scales)",
    T("Your experience of the task", "تجربتك مع المهمة"),
    [
      q("presence1", "likert", T("[Replace with presence item 1 from your chosen scale]", "[استبدل بالبند 1 من مقياس الحضور الذي تختاره]")),
      q("presence2", "likert", T("[Replace with presence item 2 from your chosen scale]", "[استبدل بالبند 2 من مقياس الحضور الذي تختاره]")),
      q("presence3", "likert", T("[Replace with presence item 3 from your chosen scale]", "[استبدل بالبند 3 من مقياس الحضور الذي تختاره]")),
      q("realism", "likert", T("My choice in this task was similar to what I would do in real life.", "كان اختياري في هذه المهمة مشابهًا لما أفعله في الواقع.")),
      q("usab1", "likert", T("[Replace with usability item 1 from your chosen scale]", "[استبدل بالبند 1 من مقياس سهولة الاستخدام الذي تختاره]")),
      q("usab2", "likert", T("[Replace with usability item 2 from your chosen scale]", "[استبدل بالبند 2 من مقياس سهولة الاستخدام الذي تختاره]")),
      attention("attn2", ["Strongly disagree", "أعارض بشدة"], 1),
    ],
  );

  const manip = questionnaire(
    cfg,
    "Manipulation check",
    T("The offers", "العروض"),
    [
      {
        id: shortId("q"),
        variable: "mc_noticed",
        type: "single",
        text: T("Did you notice any price offers?", "هل لاحظت أي عروض على الأسعار؟"),
        required: true,
        options: yesNo(),
        randomizeOptions: false,
        special: { notSure: true, preferNot: false },
      },
      {
        id: shortId("q"),
        variable: "mc_offer",
        type: "matrix",
        text: T("Which offer was at each outlet?", "ما العرض الذي كان في كل منفذ؟"),
        required: false,
        rows: outlets.map((x, i) => ({ id: `r${i + 1}`, code: `O${i + 1}`, text: x.name })),
        columns: [
          { value: 1, label: T("Buy 1 get 1 free", "اشترِ 1 واحصل على 1") },
          { value: 2, label: T("50% off", "خصم 50٪") },
          { value: 3, label: T("1 BHD off", "خصم دينار") },
          { value: 4, label: T("No offer", "بدون عرض") },
          { value: 5, label: T("Don't remember", "لا أتذكر") },
        ],
        randomizeRows: false,
      },
    ],
    { role: "manipulation_check" },
  );

  const debrief = newBlock("debrief", cfg) as Extract<Block, { type: "debrief" }>;
  debrief.name = "Debrief";
  Object.assign(debrief, {
    heading: T("Thank you: about this study", "شكرًا لك: حول هذه الدراسة"),
    body: T(
      "The outlets, brands and offers in this study were fictional. We are comparing how people choose in an interactive food court and in a questionnaire. Please do not discuss the study with other students who may take part.",
      "كانت المنافذ والعلامات والعروض في هذه الدراسة خيالية. نحن نقارن طريقة الاختيار في ساحة طعام تفاعلية وفي استبيان. يرجى عدم مناقشة الدراسة مع طلبة آخرين قد يشاركون فيها.",
    ),
  });
  (end as Extract<Block, { type: "end" }>).uniqueCode = true;
  end.name = "End";
  consent.name = "Consent";

  cfg.blocks = [welcome, consent, screening, exclusion, background, village, choice, intention, att1, experience, manip, debrief, end];
  return { title: "Food court validation study", library: { brands, products, offers, ads: [], stores }, config: cfg };
}

// ---------------------------------------------------------------------------
// Template B: AI-generated advertising and disclosure
// ---------------------------------------------------------------------------

export function deepfakeTemplate(o: TemplateOptions): TemplateResult {
  const defs: { code: string; level: string; name: LocalizedText; color: string; products: [LocalizedText, number][] }[] = [
    { code: "CB1", level: "A", name: T("Dune Roasters", "كثبان للتحميص"), color: "#92400e", products: [[T("Iced latte", "لاتيه مثلج"), 2], [T("Arabic coffee", "قهوة عربية"), 1.5]] },
    { code: "CB2", level: "B", name: T("Pearl Bean", "حبة اللؤلؤ"), color: "#0e7490", products: [[T("Iced latte", "لاتيه مثلج"), 2], [T("Cappuccino", "كابتشينو"), 1.8]] },
    { code: "CB3", level: "C", name: T("Saffron Cup", "كوب الزعفران"), color: "#a16207", products: [[T("Iced latte", "لاتيه مثلج"), 2], [T("Saffron latte", "لاتيه بالزعفران"), 2.2]] },
  ];
  const brands: LibBrand[] = defs.map((d) => ({ id: o.newId(), code: o.code("brand", d.code), name: d.name, logo: null, colors: { primary: d.color, secondary: "#fefce8" }, fictional: true }));
  const ads: LibAd[] = defs.map((d, i) => ({
    id: o.newId(),
    code: o.code("ad", `AD_${d.code}`),
    brandId: brands[i].id,
    name: T(`${d.name.en} advert`, `إعلان ${d.name.ar}`),
    versions: [
      { key: "authentic", label: "Authentic", media: null },
      { key: "ai", label: "AI-generated", media: null },
    ],
    disclosure: { text: T("AI-generated", "مُنتج بالذكاء الاصطناعي"), position: "top-start", style: "badge" },
  }));
  const products: LibProduct[] = defs.flatMap((d, i) =>
    d.products.map(([name, price], k) => ({
      id: o.newId(),
      code: o.code("product", `${d.code}_P${k + 1}`),
      brandId: brands[i].id,
      name,
      description: T("", ""),
      images: [],
      basePrice: price,
      currency: "BHD",
      category: "coffee",
      attributes: [],
      originalPrice: null,
      rating: null,
      ratingCount: null,
      reviews: [],
    })),
  );
  const stores: LibStore[] = defs.map((d, i) => ({
    id: o.newId(),
    code: o.code("store", `${d.code}_S`),
    brandId: brands[i].id,
    name: d.name,
    facade: { color: d.color, signText: d.name, style: "cafe", image: null },
    facadeAdId: ads[i].id,
    productIds: products.filter((p) => p.brandId === brands[i].id).map((p) => p.id),
    inStoreAdIds: [],
  }));
  const brandLevels = defs.map((d, i) => ({ id: `lv${d.level}`, value: d.level, label: d.name, ref: brands[i].id }));

  const cfg = startingConfig("blank");
  cfg.settings.usesDeception = true;
  cfg.design = {
    assignment: "balanced",
    conditions: [
      { id: "no_label", label: "No disclosure", weight: 1 },
      { id: "label", label: "AI-generated label", weight: 1 },
    ],
    factors: [
      { id: "f_target", variable: "target_brand", name: "Brand whose ad is AI-generated", kind: "pick", method: "balanced", balanceWithinCondition: true, refKind: "brand", levels: brandLevels, targets: [] },
      { id: "f_ad_order", variable: "ad_order", name: "Ad order", kind: "order", method: "latin", balanceWithinCondition: true, refKind: "brand", levels: brandLevels.map((l) => ({ ...l, id: `ao${l.value}` })), targets: [] },
    ],
    orderGroups: [],
  };
  const rules = {
    version: { mode: "targeted" as const, factorId: "f_target", targetKey: "ai", otherKey: "authentic" },
    disclosure: { showFor: "targeted" as const, conditions: ["label"] },
  };

  const [welcome, consent, end] = cfg.blocks;
  welcome.name = "Welcome";
  Object.assign(welcome, {
    heading: T("Coffee brands study", "دراسة علامات القهوة"),
    estimatedMinutes: 15,
    body: T(
      "In this study you will watch some coffee adverts, visit a small shopping street, and answer questions.",
      "ستشاهد في هذه الدراسة بعض إعلانات القهوة، وتزور شارع تسوق صغيرًا، وتجيب عن بعض الأسئلة.",
    ),
  });
  consent.name = "Consent";

  const screening = newBlock("screening", cfg) as Extract<Block, { type: "screening" }>;
  screening.name = "Screening";
  screening.questions = [
    q("adult", "single", T("Are you 18 years old or older?", "هل عمرك 18 عامًا أو أكثر؟")),
    q("prior_fc", "single", T("Have you taken part in the food-court study?", "هل شاركت في دراسة ساحة الطعام؟")),
  ];
  screening.eligibleIf = {
    mode: "all",
    clauses: [
      { source: "answer", key: "adult", op: "eq", value: 1 },
      { source: "answer", key: "prior_fc", op: "eq", value: 2 },
    ],
  };
  const exclusion = newBlock("exclusion_check", cfg) as Extract<Block, { type: "exclusion_check" }>;
  exclusion.name = "Exclude food-court participants";
  exclusion.excludeLists = ["foodcourt-2026"];

  const exposure = newBlock("ad_exposure", cfg) as Extract<Block, { type: "ad_exposure" }>;
  Object.assign(exposure, {
    name: "Ad exposure",
    heading: T("Adverts", "الإعلانات"),
    intro: T("Please watch each advert as you normally would.", "يرجى مشاهدة كل إعلان كما تفعل عادةً."),
    ads: ads.map((a) => a.id),
    order: { mode: "factor", factorId: "f_ad_order" },
    rules,
    requireEnd: true,
  });

  const village = newBlock("village", cfg) as Extract<Block, { type: "village" }>;
  Object.assign(village, {
    name: "Shopping street",
    variable: "cs",
    heading: T("Coffee street", "شارع القهوة"),
    stores: stores.map((s) => s.id),
    storeOrder: { mode: "random" },
    ads: rules,
    layout: "street",
    minPurchases: 0,
    maxPurchases: 4,
    considerationPrompt: T("Would you consider buying from this café?", "هل تفكر في الشراء من هذا المقهى؟"),
  });

  const attitudes = questionnaire(
    cfg,
    "Brand attitude and trust (replace placeholders with your chosen scales)",
    T("{{stimulus}}", "{{stimulus}}"),
    [
      q("att1", "semantic", T("My overall opinion of {{stimulus}} is…", "رأيي العام في {{stimulus}} هو…"), { leftLabel: T("Bad", "سيئ"), rightLabel: T("Good", "جيد") }),
      q("att2", "semantic", T("My overall opinion of {{stimulus}} is…", "رأيي العام في {{stimulus}} هو…"), { leftLabel: T("Unfavourable", "غير إيجابي"), rightLabel: T("Favourable", "إيجابي") }),
      q("trust1", "likert", T("[Replace with brand trust item 1 for {{stimulus}}]", "[استبدل ببند الثقة بالعلامة 1 لـ {{stimulus}}]")),
      q("trust2", "likert", T("[Replace with brand trust item 2 for {{stimulus}}]", "[استبدل ببند الثقة بالعلامة 2 لـ {{stimulus}}]")),
      q("pi", "likert", T("I would buy coffee from {{stimulus}}.", "سأشتري القهوة من {{stimulus}}.")),
    ],
    { role: "attitude", randomizeQuestions: false },
  );
  attitudes.repeat = { factorId: "f_target", order: "random" };

  const detection = questionnaire(
    cfg,
    "Detection task per advert",
    T("The {{stimulus}} advert", "إعلان {{stimulus}}"),
    [
      {
        id: shortId("q"),
        variable: "det",
        type: "single",
        text: T("Was the {{stimulus}} advert real or AI-generated?", "هل كان إعلان {{stimulus}} حقيقيًا أم مولّدًا بالذكاء الاصطناعي؟"),
        required: true,
        options: opt([["Real", "حقيقي"], ["AI-generated", "مولّد بالذكاء الاصطناعي"]]),
        randomizeOptions: false,
        special: { notSure: true, preferNot: false },
      },
      q("det_conf", "slider", T("How confident are you?", "ما مدى ثقتك؟")),
    ],
    { role: "detection" },
  );
  detection.repeat = { factorId: "f_ad_order", order: "assigned" };

  const manip = questionnaire(
    cfg,
    "Manipulation check",
    T("About the adverts", "حول الإعلانات"),
    [
      {
        id: shortId("q"),
        variable: "mc_label",
        type: "single",
        text: T('Did any advert carry a label saying it was "AI-generated"?', "هل حمل أي إعلان علامة تقول إنه «مُنتج بالذكاء الاصطناعي»؟"),
        required: true,
        options: yesNo(),
        randomizeOptions: false,
        special: { notSure: true, preferNot: false },
      },
    ],
    { role: "manipulation_check" },
  );

  const demographics = newBlock("demographics", cfg);
  demographics.name = "Demographics";
  const debrief = newBlock("debrief", cfg) as Extract<Block, { type: "debrief" }>;
  Object.assign(debrief, {
    name: "Debrief",
    heading: T("About this study", "حول هذه الدراسة"),
    body: T(
      "One of the adverts you saw was generated with artificial intelligence. Some participants saw a label saying so and others did not; this lets us study how disclosure affects how people see brands. The brands were fictional. If you have questions, contact the researcher. Please do not discuss the study with others who may take part.",
      "أحد الإعلانات التي شاهدتها مولّد بالذكاء الاصطناعي. رأى بعض المشاركين علامة تشير إلى ذلك ولم يرها آخرون؛ وهذا يسمح لنا بدراسة أثر الإفصاح في نظرة الناس إلى العلامات التجارية. كانت العلامات خيالية. إذا كانت لديك أسئلة فتواصل مع الباحث. يرجى عدم مناقشة الدراسة مع من قد يشارك فيها.",
    ),
  });
  (end as Extract<Block, { type: "end" }>).uniqueCode = true;
  end.name = "End";

  cfg.blocks = [welcome, consent, screening, exclusion, exposure, village, attitudes, detection, manip, demographics, debrief, end];
  return { title: "AI-generated advertising and disclosure", library: { brands, products, offers: [], ads, stores }, config: cfg };
}

export function buildTemplate(kind: TemplateKind, o: TemplateOptions): TemplateResult {
  return kind === "foodcourt" ? foodcourtTemplate(o) : deepfakeTemplate(o);
}
