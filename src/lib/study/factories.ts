/**
 * Factories for new blocks, questions and starting-point configurations.
 * Default wording is provided in English and Arabic; researchers edit it.
 */
import type { Block, BlockType, Language, LocalizedText, Question, QuestionType, StudyConfig } from "./schema";
import { isQuestionBlock, exportVariableNames } from "./schema";

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
  const id = shortId("b");
  switch (type) {
    case "welcome":
      return {
        id,
        name: "",
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
        id,
        name: "",
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
    case "instructions":
      return { id, name: "", type, heading: T("Instructions", "التعليمات"), body: T("", ""), media: [] };
    case "questionnaire":
      return {
        id,
        name: "",
        type,
        heading: T("", ""),
        intro: T("", ""),
        questions: [newQuestion("likert", nextVariable(usedVariables(config)))],
        randomizeQuestions: false,
      };
    case "demographics":
      return {
        id,
        name: "",
        type,
        heading: T("About you", "معلومات عنك"),
        intro: T("", ""),
        questions: demographicsQuestions(usedVariables(config)),
        randomizeQuestions: false,
      };
    case "media":
      return {
        id,
        name: "",
        type,
        heading: T("", ""),
        items: [],
        minViewSeconds: 0,
        requireVideoEnd: false,
        autoplay: false,
        showControls: true,
      } as unknown as Block; // Valid once the researcher adds at least one item.
    case "end":
      return {
        id,
        name: "",
        type,
        heading: T("Thank you", "شكرًا لك"),
        body: T("Your responses have been recorded.", "تم تسجيل إجاباتك."),
      };
  }
}

export type StartingPoint = "blank" | "questionnaire" | "media";

export function startingConfig(kind: StartingPoint, languages: Language[] = ["en", "ar"]): StudyConfig {
  const config: StudyConfig = {
    schemaVersion: 1,
    settings: {
      languages,
      defaultLanguage: languages[0],
      showProgress: true,
      allowResume: true,
      theme: "neutral",
    },
    blocks: [],
  };
  const add = (t: BlockType) => config.blocks.push(newBlock(t, config));
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
  add("end");
  return config;
}
