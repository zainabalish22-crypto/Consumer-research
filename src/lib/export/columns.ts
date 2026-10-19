/**
 * Column definitions for the participant-level (wide) export, the codebook and
 * the SPSS syntax. Columns are derived from study configurations; the same
 * definitions drive every output so they can never disagree.
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

export interface MediaSummary {
  visibleMs: number;
  maxPct: number;
  plays: number;
  completed: boolean;
}

export interface SessionRecord {
  id: string;
  version_number: number;
  status: string;
  is_test: boolean;
  excluded: boolean;
  exclusion_reason: string | null;
  screen_reason: string | null;
  language: string;
  device_class: string | null;
  started_at: string;
  ended_at: string | null;
  last_activity_at: string;
  consent: "given" | "declined" | null;
  condition: string | null;
  factors: Record<string, unknown>;
  groups: Record<string, string[]>;
  params: Record<string, string>;
  completion_code: string | null;
  /** All answers: variable → value; repeated blocks use variable_level. */
  answers: Record<string, unknown>;
  /** Seconds per step key (block id or block#level). */
  blockSeconds: Record<string, number>;
  /** Computed from events, per media asset id. */
  media: Record<string, MediaSummary>;
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

export interface ExportExtras {
  /** URL parameter names seen in the sessions (e.g. PROLIFIC_PID). */
  paramKeys: string[];
  /** Media assets referenced by the configs: id → file label. */
  assets: { id: string; kind: string; label: string }[];
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

/** Columns for one question; `level` set for repeated blocks (answers stored as variable_level). */
function questionColumns(q: Question, block: Block, level?: { value: string; label: LocalizedText }): Column[] {
  const base = { sourceBlock: level ? `${block.id}#${level.value}` : block.id, questionType: q.type };
  const lv = level ? { en: ` [${level.label.en ?? level.value}]`, ar: ` [${level.label.ar ?? level.value}]` } : { en: "", ar: "" };
  const qLabel = L(q.text);
  const label = { en: qLabel.en + lv.en, ar: qLabel.ar + lv.ar };
  const key = level ? `${q.variable}_${level.value}` : q.variable;
  const name = (col: string) => (level ? `${col}_${level.value}` : col);
  const answer = (s: SessionRecord) => s.answers[key];

  switch (q.type) {
    case "single":
    case "dropdown":
      return [
        {
          ...base,
          name: name(q.variable),
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
          name: name(q.variable),
          label,
          type: "numeric",
          measure: "ordinal",
          valueLabels: [...likertValues(q).map((v, i) => ({ value: v, ...L(q.labels[i]) })), ...specialLabels(q)],
          cell: (s) => num(answer(s)),
        },
      ];
    case "semantic": {
      const values = likertValues(q);
      return [
        {
          ...base,
          name: name(q.variable),
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
      return [{ ...base, name: name(q.variable), label, type: "numeric", measure: "scale", cell: (s) => num(answer(s)) }];
    case "text":
      return [
        {
          ...base,
          name: name(q.variable),
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
          name: name(q.variable),
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
            name: name(q.variable),
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
        name: name(`${q.variable}_${codeSuffix(o.value)}`),
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
            name: name(`${q.variable}_${suffix}`),
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
        name: name(`${q.variable}_${codeSuffix(o.value)}`),
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
        name: name(`${q.variable}_${r.code}`),
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

const sys = { sourceBlock: "", questionType: "system" } as const;

function sessionColumns(): Column[] {
  return [
    { ...sys, name: "session_id", label: { en: "Pseudonymous session ID", ar: "معرّف الجلسة المستعار" }, type: "string", measure: "nominal", cell: (s) => s.id },
    { ...sys, name: "study_version", label: { en: "Study version number", ar: "رقم إصدار الدراسة" }, type: "numeric", measure: "nominal", cell: (s) => s.version_number },
    { ...sys, name: "status", label: { en: "Session status", ar: "حالة الجلسة" }, type: "string", measure: "nominal", rule: "in_progress, completed, declined, withdrawn, screened_out", cell: (s) => s.status },
    { ...sys, name: "completed", label: { en: "Completed the study", ar: "أكمل الدراسة" }, type: "numeric", measure: "nominal", valueLabels: yesNo, cell: (s) => (s.status === "completed" ? 1 : 0) },
    {
      ...sys,
      name: "abandoned",
      label: { en: "Abandoned (no activity for 24 hours)", ar: "متروكة (لا نشاط منذ 24 ساعة)" },
      type: "numeric",
      measure: "nominal",
      valueLabels: yesNo,
      rule: "1 if still in progress and the last activity was more than 24 hours before the export",
      cell: (s) => (s.status === "in_progress" && Date.now() - Date.parse(s.last_activity_at) > 24 * 3600 * 1000 ? 1 : 0),
    },
    { ...sys, name: "screen_reason", label: { en: "Reason for screening out", ar: "سبب الاستبعاد بالفرز" }, type: "string", measure: "nominal", rule: "ineligible = failed the eligibility rule; repeat_participant = already took part (exclusion list)", cell: (s) => s.screen_reason },
    { ...sys, name: "is_test", label: { en: "Test session", ar: "جلسة اختبار" }, type: "numeric", measure: "nominal", valueLabels: yesNo, cell: (s) => (s.is_test ? 1 : 0) },
    { ...sys, name: "excluded", label: { en: "Excluded by researcher", ar: "مستبعد من قبل الباحث" }, type: "numeric", measure: "nominal", valueLabels: yesNo, cell: (s) => (s.excluded ? 1 : 0) },
    { ...sys, name: "exclusion_reason", label: { en: "Exclusion reason", ar: "سبب الاستبعاد" }, type: "string", measure: "nominal", cell: (s) => s.exclusion_reason },
    { ...sys, name: "language", label: { en: "Language used", ar: "اللغة المستخدمة" }, type: "string", measure: "nominal", cell: (s) => s.language },
    { ...sys, name: "device", label: { en: "Device class", ar: "نوع الجهاز" }, type: "string", measure: "nominal", cell: (s) => s.device_class },
    { ...sys, name: "started_at", label: { en: "Start time (UTC)", ar: "وقت البدء (UTC)" }, type: "datetime", measure: "scale", cell: (s) => s.started_at },
    { ...sys, name: "ended_at", label: { en: "End time (UTC)", ar: "وقت الانتهاء (UTC)" }, type: "datetime", measure: "scale", cell: (s) => s.ended_at },
    {
      ...sys,
      name: "duration_sec",
      label: { en: "Total duration (seconds)", ar: "المدة الإجمالية (ثوانٍ)" },
      type: "numeric",
      measure: "scale",
      rule: "ended_at − started_at, in seconds",
      cell: (s) => (s.ended_at ? Math.round((Date.parse(s.ended_at) - Date.parse(s.started_at)) / 1000) : null),
    },
    {
      ...sys,
      name: "consent",
      label: { en: "Consent decision", ar: "قرار الموافقة" },
      type: "numeric",
      measure: "nominal",
      valueLabels: [
        { value: 0, en: "Declined", ar: "رفض" },
        { value: 1, en: "Given", ar: "وافق" },
      ],
      cell: (s) => (s.consent === "given" ? 1 : s.consent === "declined" ? 0 : null),
    },
    { ...sys, name: "completion_code", label: { en: "Completion code (unique per participant)", ar: "رمز الإكمال (فريد لكل مشارك)" }, type: "string", measure: "nominal", cell: (s) => s.completion_code },
  ];
}

function designColumns(cfg: StudyConfig): Column[] {
  const out: Column[] = [];
  const d = cfg.design;
  if (d.conditions.length >= 2) {
    out.push({
      sourceBlock: "",
      questionType: "design",
      name: "condition",
      label: { en: "Experimental condition", ar: "المجموعة التجريبية" },
      type: "string",
      measure: "nominal",
      rule: `Assigned at start (${d.assignment === "balanced" ? "balanced permuted blocks" : "independent random draws"}${d.conditions.some((c) => c.weight > 1) ? ", weighted" : ""}). Codes: ${d.conditions.map((c) => `${c.id}${c.label ? ` = ${c.label}` : ""}`).join("; ")}`,
      cell: (s) => s.condition,
    });
  }
  for (const f of d.factors) {
    const how = `${f.method}${f.balanceWithinCondition && d.conditions.length >= 2 ? ", within condition" : ""}`;
    const fLabel = { en: f.name || f.variable, ar: f.name || f.variable };
    if (f.kind === "pick") {
      out.push({
        sourceBlock: "",
        questionType: "factor",
        name: f.variable,
        label: { en: `Assigned: ${fLabel.en}`, ar: `القيمة المخصصة: ${fLabel.ar}` },
        type: "string",
        measure: "nominal",
        rule: `One level per participant (${how}). Levels: ${f.levels.map((l) => `${l.value} = ${l.label.en ?? ""}`).join("; ")}`,
        cell: (s) => (typeof s.factors[f.variable] === "string" ? (s.factors[f.variable] as string) : null),
      });
    } else if (f.kind === "order") {
      out.push({
        sourceBlock: "",
        questionType: "factor",
        name: f.variable,
        label: { en: `Assigned order: ${fLabel.en}`, ar: `الترتيب المخصص: ${fLabel.ar}` },
        type: "string",
        measure: "nominal",
        rule: `Level values in the order shown, separated by > (${how})`,
        cell: (s) => (Array.isArray(s.factors[f.variable]) ? (s.factors[f.variable] as string[]).join(">") : null),
      });
      for (const l of f.levels) {
        out.push({
          sourceBlock: "",
          questionType: "factor",
          name: `${f.variable}_pos_${l.value}`,
          label: { en: `Position of ${l.label.en ?? l.value} in ${fLabel.en}`, ar: `موضع ${l.label.ar ?? l.value} في ${fLabel.ar}` },
          type: "numeric",
          measure: "ordinal",
          rule: "1 = shown first",
          cell: (s) => {
            const v = s.factors[f.variable];
            if (!Array.isArray(v)) return null;
            const i = (v as string[]).indexOf(l.value);
            return i >= 0 ? i + 1 : null;
          },
        });
      }
    } else {
      for (const tg of f.targets) {
        out.push({
          sourceBlock: "",
          questionType: "factor",
          name: `${f.variable}_${tg.value}`,
          label: { en: `${fLabel.en} for ${tg.label.en ?? tg.value}`, ar: `${fLabel.ar} لـ ${tg.label.ar ?? tg.value}` },
          type: "string",
          measure: "nominal",
          rule: `Level mapped onto this target (${how}). Levels: ${f.levels.map((l) => `${l.value} = ${l.label.en ?? ""}`).join("; ")}`,
          cell: (s) => {
            const v = s.factors[f.variable];
            return v && typeof v === "object" && !Array.isArray(v) ? ((v as Record<string, string>)[tg.value] ?? null) : null;
          },
        });
      }
    }
  }
  for (const g of d.orderGroups) {
    for (const b of cfg.blocks.filter((x) => x.orderGroup === g.id)) {
      out.push({
        sourceBlock: b.id,
        questionType: "design",
        name: sanitizeName(`grp_${g.id}_pos_${b.id}`),
        label: { en: `Position of block "${b.name || b.id}" in group ${g.name || g.id}`, ar: `موضع القسم "${b.name || b.id}" في المجموعة ${g.name || g.id}` },
        type: "numeric",
        measure: "ordinal",
        rule: `1 = shown first among the group's blocks (${g.method})`,
        cell: (s) => {
          const order = s.groups[g.id];
          if (!order) return null;
          const i = order.indexOf(b.id);
          return i >= 0 ? i + 1 : null;
        },
      });
    }
  }
  return out;
}

/** Build columns for a set of configs (newest first). Columns are merged by name. */
export function buildColumns(configsNewestFirst: StudyConfig[], extras: ExportExtras = { paramKeys: [], assets: [] }): Column[] {
  const byName = new Set<string>();
  const add = (list: Column[], cols: Column[]) => {
    for (const c of cols) {
      if (byName.has(c.name)) continue;
      byName.add(c.name);
      list.push(c);
    }
  };
  const base: Column[] = [];
  add(base, sessionColumns());

  const params: Column[] = extras.paramKeys.map((k) => ({
    sourceBlock: "",
    questionType: "recruitment",
    name: sanitizeName(`param_${k}`),
    label: { en: `URL parameter ${k}`, ar: `معامل الرابط ${k}` },
    type: "string" as const,
    measure: "nominal" as const,
    rule: "Passed in the participant link (e.g. a panel participant ID)",
    cell: (s: SessionRecord) => s.params[k] ?? null,
  }));
  add(base, params);

  const design: Column[] = [];
  const questions: Column[] = [];
  const timing: Column[] = [];
  const attention: { q: Question & { attentionCheck?: { expected: number } }; block: Block; key: string; name: string }[] = [];

  for (const cfg of configsNewestFirst) {
    add(design, designColumns(cfg));
    for (const block of cfg.blocks) {
      const factor = block.repeat ? cfg.design.factors.find((f) => f.id === block.repeat!.factorId) : undefined;
      const levels = factor ? (factor.kind === "mapping" ? factor.targets : factor.levels) : [undefined];
      for (const level of levels) {
        const stepKey = level ? `${block.id}#${level.value}` : block.id;
        if (block.type !== "end") {
          add(timing, [
            {
              name: sanitizeName(`time_${block.id}${level ? `_${level.value}` : ""}`),
              label: {
                en: `Time on block "${block.name || block.type}"${level ? ` [${level.label.en ?? level.value}]` : ""} (seconds)`,
                ar: `الوقت في القسم "${block.name || block.type}"${level ? ` [${level.label.ar ?? level.value}]` : ""} (ثوانٍ)`,
              },
              type: "numeric",
              measure: "scale",
              sourceBlock: stepKey,
              questionType: "timing",
              rule: "Seconds between showing the block and submitting it",
              cell: (s) => s.blockSeconds[stepKey] ?? null,
            },
          ]);
        }
        if (!isQuestionBlock(block)) continue;
        for (const q of block.questions) {
          add(questions, questionColumns(q, block, level));
          if ("attentionCheck" in q && q.attentionCheck) {
            const key = level ? `${q.variable}_${level.value}` : q.variable;
            if (!attention.some((a) => a.key === key)) attention.push({ q: q as Question & { attentionCheck: { expected: number } }, block, key, name: `${key}_attn_pass` });
          }
        }
      }
    }
  }

  const attentionCols: Column[] = attention.map(({ q, block, key, name }) => ({
    name,
    label: { en: `Attention check passed: ${q.text.en ?? ""}`, ar: `اجتياز سؤال الانتباه: ${q.text.ar ?? ""}` },
    type: "numeric",
    measure: "nominal",
    valueLabels: yesNo,
    sourceBlock: block.id,
    questionType: "attention_check",
    rule: `1 if ${key} = ${q.attentionCheck!.expected}, 0 if answered otherwise, empty if not answered`,
    cell: (s) => {
      const v = s.answers[key];
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
          rule: `Count of ${attention.map((a) => `${a.name} = 0`).join(", ")}`,
          cell: (s) => attentionCols.reduce((n, c) => n + (c.cell(s) === 0 ? 1 : 0), 0),
        },
      ]
    : [];

  const media: Column[] = extras.assets.flatMap((a) => {
    const short = a.id.replace(/-/g, "").slice(0, 8);
    const label = (en: string, ar: string) => ({ en: `${en}: ${a.label}`, ar: `${ar}: ${a.label}` });
    const cols: Column[] = [
      {
        name: `media_${short}_visible_sec`,
        label: label("Seconds visible on screen", "ثوانٍ ظاهرة على الشاشة"),
        type: "numeric",
        measure: "scale",
        sourceBlock: "",
        questionType: "computed",
        rule: `Sum of media_visible durations (at least 50% of the item in view) for asset ${a.id}`,
        cell: (s) => (s.media[a.id] ? Math.round(s.media[a.id].visibleMs / 100) / 10 : null),
      },
    ];
    if (a.kind !== "image") {
      cols.push(
        {
          name: `media_${short}_pct`,
          label: label("Furthest point played (%)", "أبعد نقطة تم تشغيلها (%)"),
          type: "numeric",
          measure: "scale",
          sourceBlock: "",
          questionType: "computed",
          rule: `Highest progress quartile reached (0, 25, 50, 75, 100) for asset ${a.id}`,
          cell: (s) => (s.media[a.id] ? s.media[a.id].maxPct : null),
        },
        {
          name: `media_${short}_plays`,
          label: label("Number of times played", "عدد مرات التشغيل"),
          type: "numeric",
          measure: "scale",
          sourceBlock: "",
          questionType: "computed",
          rule: `Count of play events for asset ${a.id}`,
          cell: (s) => (s.media[a.id] ? s.media[a.id].plays : null),
        },
      );
    }
    return cols;
  });

  return [...base, ...design, ...attentionSummary, ...questions, ...attentionCols, ...media, ...timing];
}
