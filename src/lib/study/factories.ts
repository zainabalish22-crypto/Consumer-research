/**
 * Factories for new blocks, questions and starting-point configurations.
 * Default wording is provided in English and Arabic; researchers edit it.
 */
import type { Block, BlockType, Condition, Design, Factor, Language, LocalizedText, LogicClause, OrderGroup, Question, QuestionType, StudyConfig } from "./schema";
import { isQuestionBlock, exportVariableNames, StudyConfig as StudyConfigSchema } from "./schema";

export function shortId(prefix: string): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 6)}`;
}

const T = (en: string, ar: string): LocalizedText => ({ en, ar });

export const AGREE_5: LocalizedText[] = [
  T("Strongly disagree", "أعارض بشدة"),
  T("Disagree", "أعارض"),
  T("Neither agree nor disagree", "محايد"),
  T("Agree", "أوافق"),
  T("Strongly agree", "أوافق بشدة"),
];

export const AGREE_7: LocalizedText[] = [
  T("Strongly disagree", "أعارض بشدة"),
  T("Disagree", "أعارض"),
  T("Somewhat disagree", "أعارض إلى حد ما"),
  T("Neither agree nor disagree", "محايد"),
  T("Somewhat agree", "أوافق إلى حد ما"),
  T("Agree", "أوافق"),
  T("Strongly agree", "أوافق بشدة"),
];

/** All variable names already used in a config (lower-cased). */
export function usedVariables(config: StudyConfig): Set<string> {
  const used = new Set<string>();
  for (const b of config.blocks) {
    if (!isQuestionBlock(b)) continue;
    for (const q of b.questions) {
      used.add(q.variable.toLowerCase());
      for (const n of exportVariableNames(q)) used.add(n.toLowerCase());
    }
  }
  return used;
}

export function nextVariable(used: Set<string>, base = "q"): string {
  let i = 1;
  while (used.has(`${base}${i}`.toLowerCase())) i++;
  return `${base}${i}`;
}

const opts = (labels: [string, string][]) =>
  labels.map(([en, ar], i) => ({ id: `o${i + 1}`, value: i + 1, label: T(en, ar) }));

export function newQuestion(type: QuestionType, variable: string): Question {
  const base = {
    id: shortId("q"),
    variable,
    text: T("", ""),
    required: true,
  };
  const special = { notSure: false, preferNot: false };
  switch (type) {
    case "single":
    case "dropdown":
      return {
        ...base,
        type,
        options: opts([
          ["Option 1", "الخيار 1"],
          ["Option 2", "الخيار 2"],
          ["Option 3", "الخيار 3"],
        ]),
        randomizeOptions: false,
        special,
      };
    case "multiple":
      return {
        ...base,
        type,
        options: opts([
          ["Option 1", "الخيار 1"],
          ["Option 2", "الخيار 2"],
          ["Option 3", "الخيار 3"],
        ]),
        randomizeOptions: false,
        special,
      };
    case "likert":
      return { ...base, type, points: 5, startValue: 1, labels: AGREE_5, special };
    case "semantic":
      return { ...base, type, points: 7, startValue: 1, leftLabel: T("Bad", "سيئ"), rightLabel: T("Good", "جيد") };
    case "slider":
      return { ...base, type, min: 0, max: 100, step: 1, leftLabel: T("", ""), rightLabel: T("", "") };
    case "matrix":
      return {
        ...base,
        type,
        rows: [
          { id: "r1", code: "1", text: T("Statement 1", "العبارة 1") },
          { id: "r2", code: "2", text: T("Statement 2", "العبارة 2") },
        ],
        columns: AGREE_5.map((label, i) => ({ value: i + 1, label })),
        randomizeRows: false,
      };
    case "ranking":
      return {
        ...base,
        type,
        options: opts([
          ["Item A", "العنصر أ"],
          ["Item B", "العنصر ب"],
          ["Item C", "العنصر ج"],
        ]),
        randomizeOptions: false,
      };
    case "numeric":
      return { ...base, type, integerOnly: false };
    case "text":
      return { ...base, type, multiline: false, maxLength: 500 };
    case "date":
      return { ...base, type };
    case "image_choice":
      return {
        ...base,
        type,
        multiple: false,
        options: opts([
          ["Image 1", "الصورة 1"],
          ["Image 2", "الصورة 2"],
        ]),
        randomizeOptions: false,
      };
  }
}

export function demographicsQuestions(used: Set<string>): Question[] {
  const age: Question = {
    id: shortId("q"),
    variable: used.has("age") ? nextVariable(used, "age") : "age",
    type: "numeric",
    text: T("What is your age in years?", "كم عمرك بالسنوات؟"),
    required: false,
    min: 18,
    max: 120,
    integerOnly: true,
  };
  const gender: Question = {
    id: shortId("q"),
    variable: used.has("gender") ? nextVariable(used, "gender") : "gender",
    type: "single",
    text: T("What is your gender?", "ما جنسك؟"),
    required: false,
    options: opts([
      ["Female", "أنثى"],
      ["Male", "ذكر"],
    ]),
    randomizeOptions: false,
    special: { notSure: false, preferNot: true },
  };
  const education: Question = {
    id: shortId("q"),
    variable: used.has("education") ? nextVariable(used, "education") : "education",
    type: "single",
    text: T("What is the highest level of education you have completed?", "ما أعلى مستوى تعليمي أكملته؟"),
    required: false,
    options: opts([
      ["Secondary school or below", "الثانوية العامة أو أقل"],
      ["Diploma", "دبلوم"],
      ["Bachelor's degree", "بكالوريوس"],
      ["Postgraduate degree", "دراسات عليا"],
    ]),
    randomizeOptions: false,
    special: { notSure: false, preferNot: true },
  };
  return [age, gender, education];
}

export function newBlock(type: BlockType, config: StudyConfig): Block {
  const base = { id: shortId("b"), name: "", showTo: [] as string[] };
  switch (type) {
    case "welcome":
      return {
        ...base,
        type,
        heading: T("Welcome", "مرحبًا بك"),
        body: T(
          "Thank you for your interest in this study. Please read the information on the next page before deciding whether to take part.",
          "شكرًا لاهتمامك بهذه الدراسة. يُرجى قراءة المعلومات في الصفحة التالية قبل أن تقرر المشاركة.",
        ),
        estimatedMinutes: 10,
      };
    case "consent":
      return {
        ...base,
        type,
        heading: T("Information and consent", "المعلومات والموافقة"),
        body: T(
          "Replace this text with the consent information approved by your ethics committee.",
          "استبدل هذا النص بمعلومات الموافقة المعتمدة من لجنة الأخلاقيات.",
        ),
        consentVersion: "1",
        agreeLabel: T("I agree to take part", "أوافق على المشاركة"),
        declineLabel: T("I do not agree", "لا أوافق"),
        declinedMessage: T(
          "You chose not to take part. Thank you for your time. You can now close this page.",
          "لقد اخترت عدم المشاركة. شكرًا لوقتك. يمكنك الآن إغلاق هذه الصفحة.",
        ),
      };
    case "screening": {
      const used = usedVariables(config);
      const adult = nextVariable(used, "adult");
      const q: Question = {
        id: shortId("q"),
        variable: adult,
        type: "single",
        text: T("Are you 18 years old or older?", "هل عمرك 18 عامًا أو أكثر؟"),
        required: true,
        options: opts([
          ["Yes", "نعم"],
          ["No", "لا"],
        ]),
        randomizeOptions: false,
        special: { notSure: false, preferNot: false },
      };
      return {
        ...base,
        type,
        heading: T("A few questions first", "بعض الأسئلة أولًا"),
        intro: T("", ""),
        questions: [q],
        randomizeQuestions: false,
        role: "general",
        eligibleIf: { mode: "all", clauses: [{ source: "answer", key: adult, op: "eq", value: 1 }] },
        screenedOutMessage: T(
          "Thank you for your interest. Unfortunately you are not eligible for this study. You can close this page.",
          "شكرًا لاهتمامك. للأسف أنت غير مؤهل للمشاركة في هذه الدراسة. يمكنك إغلاق هذه الصفحة.",
        ),
      };
    }
    case "exclusion_check":
      return {
        ...base,
        type,
        heading: T("", ""),
        prompt: T("Please enter your email address", "يرجى إدخال بريدك الإلكتروني"),
        help: T(
          "We use it only to check whether you have already taken part in a related study. It is not stored.",
          "نستخدمه فقط للتحقق مما إذا كنت قد شاركت سابقًا في دراسة ذات صلة، ولا يتم حفظه.",
        ),
        inputKind: "email",
        excludeLists: [],
        excludedMessage: T(
          "Thank you. You have already taken part in a related study, so you cannot take part in this one. You can close this page.",
          "شكرًا لك. لقد شاركت سابقًا في دراسة ذات صلة، لذا لا يمكنك المشاركة في هذه الدراسة. يمكنك إغلاق هذه الصفحة.",
        ),
      };
    case "instructions":
      return { ...base, type, heading: T("Instructions", "التعليمات"), body: T("", ""), media: [] };
    case "questionnaire":
      return {
        ...base,
        type,
        heading: T("", ""),
        intro: T("", ""),
        questions: [newQuestion("likert", nextVariable(usedVariables(config)))],
        randomizeQuestions: false,
        role: "general",
      };
    case "demographics":
      return {
        ...base,
        type,
        heading: T("About you", "معلومات عنك"),
        intro: T("", ""),
        questions: demographicsQuestions(usedVariables(config)),
        randomizeQuestions: false,
        role: "general",
      };
    case "media":
      return {
        ...base,
        type,
        heading: T("", ""),
        items: [],
        minViewSeconds: 0,
        requireVideoEnd: false,
        autoplay: false,
        showControls: true,
      } as unknown as Block; // Valid once the researcher adds at least one item.
    case "debrief":
      return {
        ...base,
        type,
        heading: T("About this study", "حول هذه الدراسة"),
        body: T(
          "Explain here what the study was really about, including any information that was withheld or manipulated, and why. Ask participants not to discuss the study with others who may take part.",
          "اشرح هنا الهدف الحقيقي من الدراسة، بما في ذلك أي معلومات تم حجبها أو التلاعب بها وسبب ذلك. واطلب من المشاركين عدم مناقشة الدراسة مع من قد يشارك فيها.",
        ),
      };
    case "end":
      return {
        ...base,
        type,
        heading: T("Thank you", "شكرًا لك"),
        body: T("Your responses have been recorded.", "تم تسجيل إجاباتك."),
        uniqueCode: false,
      };
  }
}

export function newCondition(existing: Condition[]): Condition {
  let i = existing.length + 1;
  while (existing.some((c) => c.id === `c${i}`)) i++;
  return { id: `c${i}`, label: "", weight: 1 };
}

export function newFactor(kind: Factor["kind"], existing: Factor[], used: Set<string>): Factor {
  const taken = new Set([...used, ...existing.map((f) => f.variable.toLowerCase())]);
  const variable = nextVariable(taken, kind === "pick" ? "pick" : kind === "order" ? "order" : "map");
  const levels = ["A", "B", "C"].map((v) => ({ id: shortId("l"), value: v, label: T(`Level ${v}`, `المستوى ${v}`) }));
  return {
    id: shortId("f"),
    variable,
    name: "",
    kind,
    levels,
    targets: kind === "mapping" ? ["T1", "T2", "T3"].map((v) => ({ id: shortId("t"), value: v, label: T(`Target ${v}`, `الهدف ${v}`) })) : [],
    method: kind === "pick" ? "balanced" : "latin",
    balanceWithinCondition: true,
  };
}

export function newOrderGroup(existing: OrderGroup[]): OrderGroup {
  let i = existing.length + 1;
  while (existing.some((g) => g.id === `g${i}`)) i++;
  return { id: `g${i}`, name: "", method: "latin" };
}

export function newClause(): LogicClause {
  return { source: "answer", key: "", op: "eq", value: 1 };
}

export const EMPTY_DESIGN: Design = { conditions: [], assignment: "balanced", factors: [], orderGroups: [] };

/**
 * Fill defaults for fields added after a draft was saved, so older (or incomplete)
 * drafts open in the builder. Valid drafts go through the schema's own defaults.
 */
export function normalizeDraft(raw: unknown): StudyConfig {
  const parsed = StudyConfigSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const c = structuredClone(raw ?? {}) as Partial<StudyConfig> & Record<string, unknown>;
  const s = (c.settings ?? {}) as Partial<StudyConfig["settings"]>;
  const languages = s.languages?.length ? s.languages : (["en"] as Language[]);
  return {
    schemaVersion: 1,
    settings: {
      languages,
      defaultLanguage: s.defaultLanguage ?? languages[0],
      showProgress: s.showProgress ?? true,
      allowResume: s.allowResume ?? true,
      theme: "neutral",
      usesDeception: s.usesDeception ?? false,
      events: s.events ?? { navigation: true, media: true },
      dismissedWarnings: s.dismissedWarnings ?? [],
    },
    design: { ...EMPTY_DESIGN, ...(c.design ?? {}) },
    blocks: ((c.blocks ?? []) as Block[]).map((b) => {
      const nb = { ...b, name: b.name ?? "", showTo: b.showTo ?? [] } as Block;
      if (nb.type === "questionnaire" || nb.type === "demographics" || nb.type === "screening") nb.role = nb.role ?? "general";
      if (nb.type === "end") nb.uniqueCode = nb.uniqueCode ?? false;
      return nb;
    }),
  };
}

export type StartingPoint = "blank" | "questionnaire" | "media" | "experiment";

export function startingConfig(kind: StartingPoint, languages: Language[] = ["en", "ar"]): StudyConfig {
  const config: StudyConfig = {
    schemaVersion: 1,
    settings: {
      languages,
      defaultLanguage: languages[0],
      showProgress: true,
      allowResume: true,
      theme: "neutral",
      usesDeception: false,
      events: { navigation: true, media: true },
      dismissedWarnings: [],
    },
    design: structuredClone(EMPTY_DESIGN),
    blocks: [],
  };
  const add = (t: BlockType) => {
    const b = newBlock(t, config);
    config.blocks.push(b);
    return b;
  };
  add("welcome");
  add("consent");
  if (kind === "questionnaire") {
    add("questionnaire");
    add("demographics");
  }
  if (kind === "media") {
    add("instructions");
    add("media");
    add("questionnaire");
  }
  if (kind === "experiment") {
    config.design.conditions = [
      { id: "control", label: "Control", weight: 1 },
      { id: "treatment", label: "Treatment", weight: 1 },
    ];
    config.blocks.splice(1, 0, newBlock("screening", config));
    add("instructions");
    const c1 = add("media");
    c1.name = "Stimulus: control";
    c1.showTo = ["control"];
    const c2 = add("media");
    c2.name = "Stimulus: treatment";
    c2.showTo = ["treatment"];
    const att = add("questionnaire") as Extract<Block, { type: "questionnaire" }>;
    att.name = "Attitudes";
    att.role = "attitude";
    const mc = add("questionnaire") as Extract<Block, { type: "questionnaire" }>;
    mc.name = "Manipulation check";
    mc.role = "manipulation_check";
    add("demographics");
    add("debrief");
  }
  add("end");
  return config;
}