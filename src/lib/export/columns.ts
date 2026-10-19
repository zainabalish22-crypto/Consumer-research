/**
 * Column definitions for the participant-level (wide) export and codebook.
 * Columns are derived from study configurations; the same definitions drive
 * the CSV cells and the codebook rows so the two can never disagree.
 */
import {
  SPECIAL_CODES,
  codeSuffix,
  isQuestionBlock,
  type Block,
  type LocalizedText,
  type Question,
  type StudyConfig,
} from "@/lib/study/schema";
import { likertValues } from "@/lib/study/answers";

export type ValueLabel = { value: number; en: string; ar: string };
export type ColumnType = "numeric" | "string" | "date" | "datetime";
export type Measure = "nominal" | "ordinal" | "scale";

export interface SessionRecord {
  id: string;
  version_number: number;
  status: string;
  is_test: boolean;
  excluded: boolean;
  exclusion_reason: string | null;
  language: string;
  device_class: string | null;
  started_at: string;
  ended_at: string | null;
  consent: "given" | "declined" | null;
  /** All answers keyed by question variable (variables are unique per study). */
  answers: Record<string, unknown>;
  /** Seconds spent per block id. */
  blockSeconds: Record<string, number>;
}

export interface Column {
  name: string;
  label: { en: string; ar: string };
  type: ColumnType;
  measure: Measure;
  valueLabels?: ValueLabel[];
  sourceBlock: string;
  questionType: string;
  rule?: string;
  cell: (s: SessionRecord) => string | number | null;
}

const L = (t: LocalizedText | undefined) => ({ en: t?.en ?? "", ar: t?.ar ?? "" });
const yesNo: ValueLabel[] = [
  { value: 0, en: "No", ar: "لا" },
  { value: 1, en: "Yes", ar: "نعم" },
];

function specialLabels(q: { special?: { notSure: boolean; preferNot: boolean } }): ValueLabel[] {
  const out: ValueLabel[] = [];
  if (q.special?.notSure) out.push({ value: SPECIAL_CODES.notSure, en: "Not sure", ar: "لست متأكدًا" });
  if (q.special?.preferNot) out.push({ value: SPECIAL_CODES.preferNot, en: "Prefer not to say", ar: "أفضّل عدم الإجابة" });
  return out;
}

export function sanitizeName(raw: string): string {
  const s = raw.replace(/[^A-Za-z0-9_]/g, "_");
  return /^[A-Za-z]/.test(s) ? s : `v_${s}`;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function questionColumns(q: Question, block: Block): Column[] {
  const base = { sourceBlock: block.id, questionType: q.type };
  const label = L(q.text);
  const answer = (s: SessionRecord) => s.answers[q.variable];

  switch (q.type) {
    case "single":
    case "dropdown":
      return [
        {
          ...base,
          name: q.variable,
          label,
          type: "numeric",
          measure: "nominal",
          valueLabels: [...q.options.map((o) => ({ value: o.value, ...L(o.label) })), ...specialLabels(q)],
          cell: (s) => num(answer(s)),
        },
      ];
    case "likert":
      return [
        {
          ...base,
          name: q.variable,
          label,
          type: "numeric",
          measure: "ordinal",
          valueLabels: [
            ...likertValues(q).map((v, i) => ({ value: v, ...L(q.labels[i]) })),
            ...specialLabels(q),
          ],
          cell: (s) => num(answer(s)),
        },
      ];
    case "semantic": {
      const values = likertValues(q);
      return [
        {
          ...base,
          name: q.variable,
          label,
          type: "numeric",
          measure: "ordinal",
          valueLabels: [
            { value: values[0], ...L(q.leftLabel) },
            { value: values[values.length - 1], ...L(q.rightLabel) },
          ],
          cell: (s) => num(answer(s)),
        },
      ];
    }
    case "slider":
    case "numeric":
      return [{ ...base, name: q.variable, label, type: "numeric", measure: "scale", cell: (s) => num(answer(s)) }];
    case "text":
      return [
        {
          ...base,
          name: q.variable,
          label,
          type: "string",
          measure: "nominal",
          cell: (s) => (typeof answer(s) === "string" ? (answer(s) as string) : null),
        },
      ];
    case "date":
      return [
        {
          ...base,
          name: q.variable,
          label,
          type: "date",
          measure: "scale",
          cell: (s) => (typeof answer(s) === "string" ? (answer(s) as string) : null),
        },
      ];
    case "image_choice":
      if (!q.multiple) {
        return [
          {
            ...base,
            name: q.variable,
            label,
            type: "numeric",
            measure: "nominal",
            valueLabels: q.options.map((o) => ({ value: o.value, ...L(o.label) })),
            cell: (s) => num(answer(s)),
          },
        ];
      }
    // falls through: multiple image choice exports like multiple choice
    case "multiple": {
      const multi = q as Extract<Question, { type: "multiple" | "image_choice" }>;
      const selected = (s: SessionRecord) => {
        const v = answer(s);
        return Array.isArray(v) ? (v as number[]) : null;
      };
      const cols: Column[] = multi.options.map((o) => ({
        ...base,
        name: `${q.variable}_${codeSuffix(o.value)}`,
        label: { en: `${label.en} — ${o.label.en ?? ""}`, ar: `${label.ar} — ${o.label.ar ?? ""}` },
        type: "numeric",
        measure: "nominal",
        valueLabels: yesNo,
        rule: "1 = selected, 0 = not selected, empty = question not answered",
        cell: (s) => {
          const sel = selected(s);
          return sel ? (sel.includes(o.value) ? 1 : 0) : null;
        },
      }));
      if (multi.type === "multiple") {
        for (const sl of specialLabels(multi)) {
          const suffix = sl.value === SPECIAL_CODES.notSure ? "notsure" : "prefnot";
          cols.push({
            ...base,
            name: `${q.variable}_${suffix}`,
            label: { en: `${label.en} — ${sl.en}`, ar: `${label.ar} — ${sl.ar}` },
            type: "numeric",
            measure: "nominal",
            valueLabels: yesNo,
            cell: (s) => {
              const sel = selected(s);
              return sel ? (sel.includes(sl.value) ? 1 : 0) : null;
            },
          });
        }
      }
      return cols;
    }
    case "ranking":
      return q.options.map((o) => ({
        ...base,
        name: `${q.variable}_${codeSuffix(o.value)}`,
        label: { en: `${label.en} — rank of ${o.label.en ?? ""}`, ar: `${label.ar} — ترتيب ${o.label.ar ?? ""}` },
        type: "numeric",
        measure: "ordinal",
        rule: "Position given to this item (1 = ranked first)",
        cell: (s) => {
          const v = answer(s);
          if (!Array.isArray(v)) return null;
          const idx = (v as number[]).indexOf(o.value);
          return idx >= 0 ? idx + 1 : null;
        },
      }));
    case "matrix":
      return q.rows.map((r) => ({
        ...base,
        name: `${q.variable}_${r.code}`,
        label: { en: `${label.en} — ${r.text.en ?? ""}`, ar: `${label.ar} — ${r.text.ar ?? ""}` },
        type: "numeric",
        measure: "ordinal",
        valueLabels: q.columns.map((c) => ({ value: c.value, ...L(c.label) })),
        cell: (s) => {
          const v = answer(s);
          return v && typeof v === "object" && !Array.isArray(v) ? num((v as Record<string, unknown>)[r.code]) : null;
        },
      }));
  }
}

const SESSION_COLUMNS: Column[] = [
  { name: "session_id", label: { en: "Pseudonymous session ID", ar: "معرّف الجلسة المستعار" }, type: "string", measure: "nominal", sourceBlock: "", questionType: "system", cell: (s) => s.id },
  { name: "study_version", label: { en: "Study version number", ar: "رقم إصدار الدراسة" }, type: "numeric", measure: "nominal", sourceBlock: "", questionType: "system", cell: (s) => s.version_number },
  { name: "status", label: { en: "Session status", ar: "حالة الجلسة" }, type: "string", measure: "nominal", sourceBlock: "", questionType: "system", rule: "in_progress, completed, declined, withdrawn, screened_out, abandoned", cell: (s) => s.status },
  { name: "completed", label: { en: "Completed the study", ar: "أكمل الدراسة" }, type: "numeric", measure: "nominal", valueLabels: yesNo, sourceBlock: "", questionType: "system", cell: (s) => (s.status === "completed" ? 1 : 0) },
  { name: "is_test", label: { en: "Test session", ar: "جلسة اختبار" }, type: "numeric", measure: "nominal", valueLabels: yesNo, sourceBlock: "", questionType: "system", cell: (s) => (s.is_test ? 1 : 0) },
  { name: "excluded", label: { en: "Excluded by researcher", ar: "مستبعد من قبل الباحث" }, type: "numeric", measure: "nominal", valueLabels: yesNo, sourceBlock: "", questionType: "system", cell: (s) => (s.excluded ? 1 : 0) },
  { name: "exclusion_reason", label: { en: "Exclusion reason", ar: "سبب الاستبعاد" }, type: "string", measure: "nominal", sourceBlock: "", questionType: "system", cell: (s) => s.exclusion_reason },
  { name: "language", label: { en: "Language used", ar: "اللغة المستخدمة" }, type: "string", measure: "nominal", sourceBlock: "", questionType: "system", cell: (s) => s.language },
  { name: "device", label: { en: "Device class", ar: "نوع الجهاز" }, type: "string", measure: "nominal", sourceBlock: "", questionType: "system", cell: (s) => s.device_class },
  { name: "started_at", label: { en: "Start time (UTC)", ar: "وقت البدء (UTC)" }, type: "datetime", measure: "scale", sourceBlock: "", questionType: "system", cell: (s) => s.started_at },
  { name: "ended_at", label: { en: "End time (UTC)", ar: "وقت الانتهاء (UTC)" }, type: "datetime", measure: "scale", sourceBlock: "", questionType: "system", cell: (s) => s.ended_at },
  {
    name: "duration_sec",
    label: { en: "Total duration (seconds)", ar: "المدة الإجمالية (ثوانٍ)" },
    type: "numeric",
    measure: "scale",
    sourceBlock: "",
    questionType: "system",
    rule: "ended_at − started_at, in seconds",
    cell: (s) => (s.ended_at ? Math.round((Date.parse(s.ended_at) - Date.parse(s.started_at)) / 1000) : null),
  },
  {
    name: "consent",
    label: { en: "Consent decision", ar: "قرار الموافقة" },
    type: "numeric",
    measure: "nominal",
    valueLabels: [
      { value: 0, en: "Declined", ar: "رفض" },
      { value: 1, en: "Given", ar: "وافق" },
    ],
    sourceBlock: "",
    questionType: "system",
    cell: (s) => (s.consent === "given" ? 1 : s.consent === "declined" ? 0 : null),
  },
];

/** Build columns for a set of configs (newest first). Columns are merged by name. */
export function buildColumns(configsNewestFirst: StudyConfig[]): Column[] {
  const byName = new Map<string, Column>();
  const questionCols: Column[] = [];
  const attention: { q: Question & { attentionCheck?: { expected: number } }; block: Block }[] = [];
  const timingCols: Column[] = [];
  const timingNames = new Set<string>();

  for (const cfg of configsNewestFirst) {
    for (const block of cfg.blocks) {
      const tName = sanitizeName(`time_${block.id}`);
      if (!timingNames.has(tName) && block.type !== "end") {
        timingNames.add(tName);
        timingCols.push({
          name: tName,
          label: { en: `Time on block "${block.name || block.type}" (seconds)`, ar: `الوقت في القسم "${block.name || block.type}" (ثوانٍ)` },
          type: "numeric",
          measure: "scale",
          sourceBlock: block.id,
          questionType: "timing",
          rule: "Seconds between showing the block and submitting it",
          cell: (s) => (s.blockSeconds[block.id] ?? null),
        });
      }
      if (!isQuestionBlock(block)) continue;
      for (const q of block.questions) {
        for (const col of questionColumns(q, block)) {
          if (!byName.has(col.name)) {
            byName.set(col.name, col);
            questionCols.push(col);
          }
        }
        if ("attentionCheck" in q && q.attentionCheck && !attention.some((a) => a.q.variable === q.variable)) {
          attention.push({ q: q as Question & { attentionCheck: { expected: number } }, block });
        }
      }
    }
  }

  const attentionCols: Column[] = attention.map(({ q, block }) => ({
    name: `${q.variable}_attn_pass`,
    label: { en: `Attention check passed: ${q.text.en ?? ""}`, ar: `اجتياز سؤال الانتباه: ${q.text.ar ?? ""}` },
    type: "numeric",
    measure: "nominal",
    valueLabels: yesNo,
    sourceBlock: block.id,
    questionType: "attention_check",
    rule: `1 if ${q.variable} = ${q.attentionCheck!.expected}, 0 if answered otherwise, empty if not answered`,
    cell: (s) => {
      const v = s.answers[q.variable];
      if (v === undefined || v === null) return null;
      return v === q.attentionCheck!.expected ? 1 : 0;
    },
  }));

  const attentionSummary: Column[] = attention.length
    ? [
        {
          name: "attention_failed",
          label: { en: "Number of attention checks failed", ar: "عدد أسئلة الانتباه التي لم يجتزها" },
          type: "numeric",
          measure: "scale",
          sourceBlock: "",
          questionType: "attention_check",
          rule: `Count of ${attention.map((a) => `${a.q.variable}_attn_pass = 0`).join(", ")}`,
          cell: (s) => attentionCols.reduce((n, c) => n + (c.cell(s) === 0 ? 1 : 0), 0),
        },
      ]
    : [];

  return [...SESSION_COLUMNS, ...attentionSummary, ...questionCols, ...attentionCols, ...timingCols];
}
