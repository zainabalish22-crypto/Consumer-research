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
import type { Assignment } from "@/lib/study/flow";
import { libraryOf, offerForItem, offerForStore, orderItems, resolveAd } from "@/lib/study/environment";
import { basketValue, cartValue } from "@/lib/study/envAnswers";
import { lt } from "@/lib/study/text";

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
  /** Step keys (block id or block#level) the participant submitted. */
  blocksDone?: string[];
  /** Computed from events, per media asset id (and "ad:<id>" per ad). */
  media: Record<string, MediaSummary>;
  /** Computed from environment events, per block id and store id. */
  env: Record<string, EnvSummary>;
}

export interface EnvSummary {
  stores: Record<string, { approached: boolean; entered: boolean; dwellMs: number; views: number; passes: number }>;
  productsViewed: number;
  details: number;
  /** Online shop blocks only. */
  shop?: ShopSummary;
  /** Social feed blocks only: ms on screen per post id. */
  feed?: { visibleMs: Record<string, number> };
}

export interface ShopSummary {
  products: Record<string, { views: number; details: number }>;
  searches: number;
  filters: number;
  sorts: number;
  checkoutStarted: boolean;
  popupCloseMs: number | null;
  /** Highest scroll depth (%) reached on any shop page. */
  maxScroll: number;
}

export const emptyShop = (): ShopSummary => ({ products: {}, searches: 0, filters: 0, sorts: 0, checkoutStarted: false, popupCloseMs: null, maxScroll: 0 });

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
    case "constant_sum":
      return q.options.map((o) => ({
        ...base,
        name: name(`${q.variable}_${codeSuffix(o.value)}`),
        label: { en: `${label.en} — ${o.label.en ?? ""}`, ar: `${label.ar} — ${o.label.ar ?? ""}` },
        type: "numeric",
        measure: "scale",
        rule: `Points given to this option (all options add up to ${q.total})`,
        cell: (s) => {
          const v = answer(s);
          if (!v || typeof v !== "object" || Array.isArray(v)) return null;
          return (v as Record<string, number>)[String(o.value)] ?? 0;
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

const assignmentOf = (s: SessionRecord): Assignment => ({
  condition: s.condition,
  factors: s.factors as Assignment["factors"],
  groups: s.groups,
});

/** Columns for shopping-environment and ad blocks, computed from answers, events and the assignment. */
function environmentColumns(cfg: StudyConfig): Column[] {
  const lib = libraryOf(cfg);
  const out: Column[] = [];
  const col = (c: Omit<Column, "measure" | "questionType"> & { measure?: Measure }): Column => ({ measure: "scale", questionType: "computed", ...c });

  for (const b of cfg.blocks) {
    if (b.type === "village" || b.type === "store_choice") {
      const P = b.variable;
      const order = (s: SessionRecord) => orderItems(b.stores, b.storeOrder, cfg, assignmentOf(s), `${s.id}:${b.id}`);
      const offerCode = (s: SessionRecord, sid: string) => offerForStore(b.offers, sid, cfg, assignmentOf(s))?.code ?? null;
      const answer = (s: SessionRecord) => s.answers[P] as Record<string, unknown> | undefined;
      for (const sid of b.stores) {
        const st = lib.stores[sid];
        if (!st) continue;
        const name = lt(st.name, "en") || st.code;
        const nameAr = lt(st.name, "ar") || name;
        const base = { sourceBlock: b.id };
        out.push(
          col({ ...base, name: `${P}_${st.code}_pos`, label: { en: `${name}: position shown`, ar: `${nameAr}: موضع العرض` }, type: "numeric", measure: "ordinal", rule: `1 = first store shown (store id ${sid})`, cell: (s) => order(s).indexOf(sid) + 1 || null }),
          col({ ...base, name: `${P}_${st.code}_offer`, label: { en: `${name}: offer shown`, ar: `${nameAr}: العرض المقدم` }, type: "string", measure: "nominal", rule: "Offer code from the library (empty = no offer)", cell: (s) => offerCode(s, sid) }),
        );
        if (b.type === "village") {
          const env = (s: SessionRecord) => s.env[b.id]?.stores[sid];
          const basket = (s: SessionRecord) => ((answer(s)?.basket as { store: string; qty: number }[] | undefined) ?? null);
          out.push(
            col({ ...base, name: `${P}_${st.code}_approached`, label: { en: `${name}: stopped in front`, ar: `${nameAr}: توقف أمامه` }, type: "numeric", measure: "nominal", valueLabels: yesNo, rule: `1 if the participant stayed within ${b.approachDistance} units for ${b.approachSeconds}s (store_approach event)`, cell: (s) => (s.env[b.id] ? (env(s)?.approached ? 1 : 0) : null) }),
            col({ ...base, name: `${P}_${st.code}_entered`, label: { en: `${name}: entered`, ar: `${nameAr}: دخل المتجر` }, type: "numeric", measure: "nominal", valueLabels: yesNo, rule: "1 if a store_enter event exists", cell: (s) => (s.env[b.id] ? (env(s)?.entered ? 1 : 0) : null) }),
            col({ ...base, name: `${P}_${st.code}_dwell_sec`, label: { en: `${name}: seconds inside`, ar: `${nameAr}: ثوانٍ داخل المتجر` }, type: "numeric", rule: "Sum of store_leave durations", cell: (s) => (s.env[b.id] ? Math.round((env(s)?.dwellMs ?? 0) / 100) / 10 : null) }),
            col({ ...base, name: `${P}_${st.code}_views`, label: { en: `${name}: products viewed`, ar: `${nameAr}: منتجات تمت مشاهدتها` }, type: "numeric", rule: "Count of product_view events in this store", cell: (s) => (s.env[b.id] ? (env(s)?.views ?? 0) : null) }),
            col({
              ...base,
              name: `${P}_${st.code}_items`,
              label: { en: `${name}: items bought`, ar: `${nameAr}: عدد القطع المشتراة` },
              type: "numeric",
              rule: "Quantity in the final basket from this store",
              cell: (s) => {
                const bk = basket(s);
                return bk ? bk.filter((l) => l.store === sid).reduce((n, l) => n + l.qty, 0) : null;
              },
            }),
          );
          if (b.considerationPrompt) {
            out.push(
              col({
                ...base,
                name: `${P}_${st.code}_consider`,
                label: { en: `${name}: would consider buying`, ar: `${nameAr}: سيفكر في الشراء` },
                type: "numeric",
                measure: "nominal",
                valueLabels: yesNo,
                rule: "Answer to the question asked when leaving the store (empty = never entered)",
                cell: (s) => {
                  const c = answer(s)?.consideration as Record<string, number> | undefined;
                  return c && c[sid] !== undefined ? c[sid] : null;
                },
              }),
            );
          }
        }
      }
      if (b.type === "store_choice") {
        const chosen = (s: SessionRecord) => (answer(s) ? ((answer(s)!.store as string | null) ?? null) : undefined);
        out.push(
          col({ sourceBlock: b.id, name: `${P}_store`, label: { en: "Chosen store", ar: "المتجر المختار" }, type: "string", measure: "nominal", rule: "Store code (empty = none chosen or not answered)", cell: (s) => { const c = chosen(s); return c ? (lib.stores[c]?.code ?? c) : null; } }),
          col({ sourceBlock: b.id, name: `${P}_offer`, label: { en: "Offer at the chosen store", ar: "العرض في المتجر المختار" }, type: "string", measure: "nominal", cell: (s) => { const c = chosen(s); return c ? offerCode(s, c) : null; } }),
          col({ sourceBlock: b.id, name: `${P}_pos`, label: { en: "Position of the chosen store", ar: "موضع المتجر المختار" }, type: "numeric", measure: "ordinal", cell: (s) => { const c = chosen(s); return c ? order(s).indexOf(c) + 1 || null : null; } }),
        );
      } else {
        const blk = b;
        const bk = (s: SessionRecord) => (answer(s)?.basket as { store: string; product: string; qty: number }[] | undefined) ?? null;
        // The "chosen" store is the one with most items; ties go to the first added.
        const chosenStore = (s: SessionRecord) => {
          const lines = bk(s);
          if (!lines?.length) return null;
          const byStore = new Map<string, number>();
          lines.forEach((l) => byStore.set(l.store, (byStore.get(l.store) ?? 0) + l.qty));
          return [...byStore.entries()].sort((x, y) => y[1] - x[1])[0][0];
        };
        out.push(
          col({ sourceBlock: b.id, name: `${P}_items`, label: { en: "Items in final basket", ar: "عدد القطع في السلة النهائية" }, type: "numeric", cell: (s) => { const l = bk(s); return l ? l.reduce((n, x) => n + x.qty, 0) : null; } }),
          col({ sourceBlock: b.id, name: `${P}_value`, label: { en: `Basket value (${b.currency})`, ar: `قيمة السلة (${b.currency})` }, type: "numeric", rule: "Sum of line totals after offers (simulated spend)", cell: (s) => { const l = bk(s); return l ? basketValue(blk, cfg, assignmentOf(s), l) : null; } }),
          col({ sourceBlock: b.id, name: `${P}_choice_store`, label: { en: "Chosen store (most items)", ar: "المتجر المختار (أكثر القطع)" }, type: "string", measure: "nominal", rule: "Store code with the most items in the final basket", cell: (s) => { const c = chosenStore(s); return c ? (lib.stores[c]?.code ?? c) : null; } }),
          col({ sourceBlock: b.id, name: `${P}_choice_offer`, label: { en: "Offer at the chosen store", ar: "العرض في المتجر المختار" }, type: "string", measure: "nominal", cell: (s) => { const c = chosenStore(s); return c ? offerCode(s, c) : null; } }),
          col({ sourceBlock: b.id, name: `${P}_choice_product`, label: { en: "First product in basket", ar: "أول منتج في السلة" }, type: "string", measure: "nominal", cell: (s) => { const l = bk(s); return l?.length ? (lib.products[l[0].product]?.code ?? l[0].product) : null; } }),
          col({ sourceBlock: b.id, name: `${P}_stores_entered`, label: { en: "Number of stores entered", ar: "عدد المتاجر التي دخلها" }, type: "numeric", cell: (s) => (s.env[b.id] ? Object.values(s.env[b.id].stores).filter((x) => x.entered).length : null) }),
          col({ sourceBlock: b.id, name: `${P}_products_viewed`, label: { en: "Product views (all stores)", ar: "مشاهدات المنتجات (كل المتاجر)" }, type: "numeric", cell: (s) => s.env[b.id]?.productsViewed ?? null }),
          col({ sourceBlock: b.id, name: `${P}_details_opened`, label: { en: "Product details opened", ar: "مرات فتح تفاصيل المنتج" }, type: "numeric", cell: (s) => s.env[b.id]?.details ?? null }),
          col({ sourceBlock: b.id, name: `${P}_timed_out`, label: { en: "Time limit reached", ar: "انتهى الوقت المحدد" }, type: "numeric", measure: "nominal", valueLabels: yesNo, cell: (s) => (answer(s) ? (answer(s)!.timedOut ? 1 : 0) : null) }),
        );
      }
    }
    if (b.type === "online_shop") {
      const P = b.variable;
      const blk = b;
      const a = (s: SessionRecord) => assignmentOf(s);
      const order = (s: SessionRecord) => orderItems(b.products, b.productOrder, cfg, a(s), `${s.id}:${b.id}`);
      const answer = (s: SessionRecord) => s.answers[P] as { cart?: { product: string; qty: number }[]; checkedOut?: boolean; timedOut?: boolean } | undefined;
      const shop = (s: SessionRecord) => (s.env[b.id] ? (s.env[b.id].shop ?? null) : null);
      for (const pid of b.products) {
        const p = lib.products[pid];
        if (!p) continue;
        const name = lt(p.name, "en") || p.code;
        const nameAr = lt(p.name, "ar") || name;
        const base = { sourceBlock: b.id };
        out.push(
          col({ ...base, name: `${P}_${p.code}_pos`, label: { en: `${name}: position in listing`, ar: `${nameAr}: الموضع في القائمة` }, type: "numeric", measure: "ordinal", rule: `1 = first product in the default listing (product id ${pid}); sponsored products are also lifted to the top`, cell: (s) => order(s).indexOf(pid) + 1 || null }),
          col({ ...base, name: `${P}_${p.code}_offer`, label: { en: `${name}: offer shown`, ar: `${nameAr}: العرض المقدم` }, type: "string", measure: "nominal", rule: "Offer code from the library (empty = no offer)", cell: (s) => offerForItem(b.offers, pid, cfg, a(s))?.code ?? null }),
          col({ ...base, name: `${P}_${p.code}_viewed`, label: { en: `${name}: times seen in a listing`, ar: `${nameAr}: مرات الظهور في القائمة` }, type: "numeric", rule: "Count of product_view events (card at least half visible)", cell: (s) => { const x = shop(s); return x ? (x.products[pid]?.views ?? 0) : null; } }),
          col({ ...base, name: `${P}_${p.code}_detail`, label: { en: `${name}: product page opened`, ar: `${nameAr}: مرات فتح صفحة المنتج` }, type: "numeric", rule: "Count of product_detail events", cell: (s) => { const x = shop(s); return x ? (x.products[pid]?.details ?? 0) : null; } }),
          col({ ...base, name: `${P}_${p.code}_qty`, label: { en: `${name}: quantity bought`, ar: `${nameAr}: الكمية المشتراة` }, type: "numeric", rule: "Quantity in the final cart", cell: (s) => { const c = answer(s)?.cart; return c ? (c.find((l) => l.product === pid)?.qty ?? 0) : null; } }),
        );
      }
      const cart = (s: SessionRecord) => answer(s)?.cart ?? null;
      out.push(
        col({ sourceBlock: b.id, name: `${P}_items`, label: { en: "Items in final cart", ar: "عدد القطع في السلة النهائية" }, type: "numeric", cell: (s) => { const c = cart(s); return c ? c.reduce((n, l) => n + l.qty, 0) : null; } }),
        col({ sourceBlock: b.id, name: `${P}_value`, label: { en: `Cart value (${b.currency})`, ar: `قيمة السلة (${b.currency})` }, type: "numeric", rule: "Sum of line totals after offers (simulated spend)", cell: (s) => { const c = cart(s); return c ? cartValue(blk, cfg, a(s), c) : null; } }),
        col({ sourceBlock: b.id, name: `${P}_searches`, label: { en: "Searches made", ar: "عدد عمليات البحث" }, type: "numeric", rule: "Count of shop_search events (the queries are in the event log)", cell: (s) => shop(s)?.searches ?? null }),
        col({ sourceBlock: b.id, name: `${P}_filters`, label: { en: "Filter changes", ar: "تغييرات التصفية" }, type: "numeric", cell: (s) => shop(s)?.filters ?? null }),
        col({ sourceBlock: b.id, name: `${P}_sorts`, label: { en: "Sort changes", ar: "تغييرات الترتيب" }, type: "numeric", cell: (s) => shop(s)?.sorts ?? null }),
        col({ sourceBlock: b.id, name: `${P}_details_opened`, label: { en: "Product pages opened", ar: "مرات فتح صفحات المنتجات" }, type: "numeric", cell: (s) => (s.env[b.id] ? s.env[b.id].details : null) }),
        col({ sourceBlock: b.id, name: `${P}_checkout_started`, label: { en: "Went to checkout", ar: "انتقل إلى إتمام الطلب" }, type: "numeric", measure: "nominal", valueLabels: yesNo, cell: (s) => { const x = shop(s); return x ? (x.checkoutStarted ? 1 : 0) : null; } }),
        col({ sourceBlock: b.id, name: `${P}_checked_out`, label: { en: "Placed the simulated order", ar: "أكمل الطلب التجريبي" }, type: "numeric", measure: "nominal", valueLabels: yesNo, rule: "0 = left the shop or ran out of time without placing the simulated order", cell: (s) => (answer(s) ? (answer(s)!.checkedOut ? 1 : 0) : null) }),
        col({ sourceBlock: b.id, name: `${P}_timed_out`, label: { en: "Time limit reached", ar: "انتهى الوقت المحدد" }, type: "numeric", measure: "nominal", valueLabels: yesNo, cell: (s) => (answer(s) ? (answer(s)!.timedOut ? 1 : 0) : null) }),
        col({ sourceBlock: b.id, name: `${P}_max_scroll`, label: { en: "Deepest scroll on any page (%)", ar: "أعمق تمرير في أي صفحة (%)" }, type: "numeric", cell: (s) => shop(s)?.maxScroll ?? null }),
      );
      if (b.placements.popup) {
        out.push(col({ sourceBlock: b.id, name: `${P}_popup_close_sec`, label: { en: "Seconds before closing the pop-up ad", ar: "ثوانٍ قبل إغلاق الإعلان المنبثق" }, type: "numeric", rule: "Empty = pop-up not shown or never closed", cell: (s) => { const ms = shop(s)?.popupCloseMs; return ms == null ? null : Math.round(ms / 100) / 10; } }));
      }
      const adIds = [...new Set([...b.placements.banner, ...b.placements.sidebar, ...(b.placements.popup ? [b.placements.popup] : [])])];
      for (const adId of adIds) {
        const ad = lib.ads[adId];
        if (!ad) continue;
        const n = lt(ad.name, "en") || ad.code;
        const nAr = lt(ad.name, "ar") || n;
        const shown = (s: SessionRecord) => resolveAd(ad, b.ads, cfg, a(s));
        const m = (s: SessionRecord) => s.media[`ad:${adId}`];
        out.push(
          col({ sourceBlock: b.id, name: `${P}_ad_${ad.code}_version`, label: { en: `${n}: version shown`, ar: `${nAr}: النسخة المعروضة` }, type: "string", measure: "nominal", cell: (s) => shown(s).versionKey }),
          col({ sourceBlock: b.id, name: `${P}_ad_${ad.code}_disclosed`, label: { en: `${n}: disclosure label shown`, ar: `${nAr}: ظهرت علامة الإفصاح` }, type: "numeric", measure: "nominal", valueLabels: yesNo, cell: (s) => (shown(s).disclosed ? 1 : 0) }),
          col({ sourceBlock: b.id, name: `${P}_ad_${ad.code}_visible_sec`, label: { en: `${n}: seconds visible`, ar: `${nAr}: ثوانٍ ظاهرة` }, type: "numeric", rule: "Sum of media_visible durations for this ad (any placement in the study)", cell: (s) => (m(s) ? Math.round(m(s)!.visibleMs / 100) / 10 : null) }),
        );
      }
    }
    if (b.type === "social_feed") {
      const P = b.variable;
      const a = (s: SessionRecord) => assignmentOf(s);
      const order = (s: SessionRecord) => orderItems(b.posts.map((p) => p.id), b.postOrder, cfg, a(s), `${s.id}:${b.id}`);
      const answer = (s: SessionRecord) => s.answers[P] as { liked?: string[]; saved?: string[]; hidden?: string[] } | undefined;
      const feed = (s: SessionRecord) => (s.env[b.id] ? (s.env[b.id].feed ?? { visibleMs: {} }) : null);
      const has = (s: SessionRecord, list: "liked" | "saved" | "hidden", id: string) => {
        const v = answer(s);
        return v ? ((v[list] ?? []).includes(id) ? 1 : 0) : null;
      };
      for (const p of b.posts) {
        const ad = p.adId ? lib.ads[p.adId] : undefined;
        const name = lt(p.author, "en") || (ad ? lt(ad.name, "en") : "") || p.id;
        const nameAr = lt(p.author, "ar") || (ad ? lt(ad.name, "ar") : "") || name;
        const base = { sourceBlock: b.id };
        const K = `${P}_${p.id}`;
        out.push(
          col({ ...base, name: `${K}_pos`, label: { en: `Post ${p.id} (${name}): position`, ar: `المنشور ${p.id} (${nameAr}): الموضع` }, type: "numeric", measure: "ordinal", rule: "1 = first post in the feed", cell: (s) => order(s).indexOf(p.id) + 1 || null }),
          col({ ...base, name: `${K}_liked`, label: { en: `Post ${p.id}: liked`, ar: `المنشور ${p.id}: أُعجب به` }, type: "numeric", measure: "nominal", valueLabels: yesNo, rule: "Liked when leaving the feed", cell: (s) => has(s, "liked", p.id) }),
          col({ ...base, name: `${K}_saved`, label: { en: `Post ${p.id}: saved`, ar: `المنشور ${p.id}: حُفظ` }, type: "numeric", measure: "nominal", valueLabels: yesNo, cell: (s) => has(s, "saved", p.id) }),
          col({ ...base, name: `${K}_hidden`, label: { en: `Post ${p.id}: hidden`, ar: `المنشور ${p.id}: أُخفي` }, type: "numeric", measure: "nominal", valueLabels: yesNo, cell: (s) => has(s, "hidden", p.id) }),
          col({ ...base, name: `${K}_visible_sec`, label: { en: `Post ${p.id}: seconds on screen`, ar: `المنشور ${p.id}: ثوانٍ على الشاشة` }, type: "numeric", rule: "Time at least half of the post was on screen (post_visible events)", cell: (s) => { const f = feed(s); return f ? Math.round((f.visibleMs[p.id] ?? 0) / 100) / 10 : null; } }),
        );
        if (ad) {
          const shown = (s: SessionRecord) => resolveAd(ad, b.ads, cfg, a(s));
          out.push(
            col({ ...base, name: `${K}_ad_version`, label: { en: `Post ${p.id}: ad version shown`, ar: `المنشور ${p.id}: نسخة الإعلان` }, type: "string", measure: "nominal", cell: (s) => shown(s).versionKey }),
            col({ ...base, name: `${K}_ad_disclosed`, label: { en: `Post ${p.id}: disclosure label shown`, ar: `المنشور ${p.id}: ظهرت علامة الإفصاح` }, type: "numeric", measure: "nominal", valueLabels: yesNo, cell: (s) => (shown(s).disclosed ? 1 : 0) }),
          );
        }
      }
      const count = (s: SessionRecord, list: "liked" | "saved" | "hidden") => { const v = answer(s); return v ? (v[list] ?? []).length : null; };
      out.push(
        col({ sourceBlock: b.id, name: `${P}_n_liked`, label: { en: "Posts liked", ar: "عدد المنشورات المُعجب بها" }, type: "numeric", cell: (s) => count(s, "liked") }),
        col({ sourceBlock: b.id, name: `${P}_n_saved`, label: { en: "Posts saved", ar: "عدد المنشورات المحفوظة" }, type: "numeric", cell: (s) => count(s, "saved") }),
        col({ sourceBlock: b.id, name: `${P}_n_hidden`, label: { en: "Posts hidden", ar: "عدد المنشورات المخفية" }, type: "numeric", cell: (s) => count(s, "hidden") }),
      );
    }
    if (b.type === "ad_exposure") {
      const order = (s: SessionRecord) => orderItems(b.ads, b.order, cfg, assignmentOf(s), `${s.id}:${b.id}`);
      for (const adId of b.ads) {
        const ad = lib.ads[adId];
        if (!ad) continue;
        const shown = (s: SessionRecord) => resolveAd(ad, b.rules, cfg, assignmentOf(s));
        const m = (s: SessionRecord) => s.media[`ad:${adId}`];
        const base = { sourceBlock: b.id };
        const n = lt(ad.name, "en") || ad.code;
        out.push(
          col({ ...base, name: `ad_${ad.code}_version`, label: { en: `${n}: version shown`, ar: `${lt(ad.name, "ar") || n}: النسخة المعروضة` }, type: "string", measure: "nominal", rule: `Version key from the library (${ad.versions.map((v) => v.key).join(", ")})`, cell: (s) => shown(s).versionKey }),
          col({ ...base, name: `ad_${ad.code}_disclosed`, label: { en: `${n}: disclosure label shown`, ar: `${lt(ad.name, "ar") || n}: ظهرت علامة الإفصاح` }, type: "numeric", measure: "nominal", valueLabels: yesNo, cell: (s) => (shown(s).disclosed ? 1 : 0) }),
          col({ ...base, name: `ad_${ad.code}_pos`, label: { en: `${n}: position shown`, ar: `${lt(ad.name, "ar") || n}: موضع العرض` }, type: "numeric", measure: "ordinal", cell: (s) => order(s).indexOf(adId) + 1 || null }),
          col({ ...base, name: `ad_${ad.code}_visible_sec`, label: { en: `${n}: seconds visible`, ar: `${lt(ad.name, "ar") || n}: ثوانٍ ظاهرة` }, type: "numeric", rule: "Sum of media_visible durations for this ad (any placement)", cell: (s) => (m(s) ? Math.round(m(s)!.visibleMs / 100) / 10 : null) }),
          col({ ...base, name: `ad_${ad.code}_pct`, label: { en: `${n}: furthest point played (%)`, ar: `${lt(ad.name, "ar") || n}: أبعد نقطة تشغيل (%)` }, type: "numeric", rule: "Highest progress quartile reached (0, 25, 50, 75, 100)", cell: (s) => (m(s) ? m(s)!.maxPct : null) }),
        );
      }
    }
  }
  // A block shown only to some conditions has no data for the others: leave those cells blank
  // instead of reporting positions, offers or ad versions the participant never saw.
  const shownTo = new Map(cfg.blocks.map((b) => [b.id, b.showTo]));
  return out.map((c) => {
    const only = shownTo.get(c.sourceBlock);
    if (!only?.length) return c;
    const cell = c.cell;
    return { ...c, cell: (s: SessionRecord) => (s.condition !== null && only.includes(s.condition) ? cell(s) : null) };
  });
}

/**
 * For blocks repeated over a factor whose levels match a "pick" factor (e.g. brands
 * and target_brand), add the value for the participant's target level and the mean
 * of the other levels, so within-participant comparisons are one subtraction away.
 */
function targetColumns(cfg: StudyConfig, perLevel: Map<string, { factorId: string; byLevel: Map<string, Column> }>): Column[] {
  const out: Column[] = [];
  for (const [baseName, { factorId, byLevel }] of perLevel) {
    const rf = cfg.design.factors.find((f) => f.id === factorId);
    if (!rf) continue;
    const levels = new Set((rf.kind === "mapping" ? rf.targets : rf.levels).map((l) => l.value));
    const sample = [...byLevel.values()][0];
    if (!sample || sample.type !== "numeric") continue;
    for (const pf of cfg.design.factors.filter((f) => f.kind === "pick")) {
      const pv = new Set(pf.levels.map((l) => l.value));
      if (pv.size !== levels.size || ![...pv].every((v) => levels.has(v))) continue;
      const target = (s: SessionRecord) => (typeof s.factors[pf.variable] === "string" ? (s.factors[pf.variable] as string) : null);
      out.push(
        {
          ...sample,
          name: `${baseName}_target`,
          label: { en: `${sample.label.en} — ${pf.variable} level`, ar: `${sample.label.ar} — مستوى ${pf.variable}` },
          questionType: "computed",
          rule: `Value of ${baseName}_<level> for the participant's ${pf.variable}`,
          cell: (s) => {
            const tl = target(s);
            return tl && byLevel.get(tl) ? byLevel.get(tl)!.cell(s) : null;
          },
        },
        {
          ...sample,
          name: `${baseName}_nontarget_mean`,
          label: { en: `${sample.label.en} — mean of other levels`, ar: `${sample.label.ar} — متوسط المستويات الأخرى` },
          valueLabels: undefined,
          measure: "scale",
          questionType: "computed",
          rule: `Mean of ${baseName}_<level> over levels other than ${pf.variable} (answered levels only)`,
          cell: (s) => {
            const tl = target(s);
            if (!tl) return null;
            const vals = [...byLevel.entries()].filter(([lv]) => lv !== tl).map(([, c]) => c.cell(s)).filter((v): v is number => typeof v === "number" && v >= 0);
            return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 1000) / 1000 : null;
          },
        },
      );
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

  const env: Column[] = [];
  const targets: Column[] = [];
  for (const cfg of configsNewestFirst) {
    add(design, designColumns(cfg));
    add(env, environmentColumns(cfg));
    const perLevel = new Map<string, { factorId: string; byLevel: Map<string, Column> }>();
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
          const cols = questionColumns(q, block, level);
          add(questions, cols);
          if (factor && level) {
            questionColumns(q, block).forEach((bc, i) => {
              const e = perLevel.get(bc.name) ?? { factorId: factor.id, byLevel: new Map<string, Column>() };
              e.byLevel.set(level.value, cols[i]);
              perLevel.set(bc.name, e);
            });
          }
          if ("attentionCheck" in q && q.attentionCheck) {
            const key = level ? `${q.variable}_${level.value}` : q.variable;
            if (!attention.some((a) => a.key === key)) attention.push({ q: q as Question & { attentionCheck: { expected: number } }, block, key, name: `${key}_attn_pass` });
          }
        }
      }
    }
    add(targets, targetColumns(cfg, perLevel));
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

  return [...base, ...design, ...attentionSummary, ...questions, ...targets, ...attentionCols, ...env, ...media, ...timing];
}
