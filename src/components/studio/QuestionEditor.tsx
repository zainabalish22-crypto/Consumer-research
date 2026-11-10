"use client";

import { useLocale, useTranslations } from "next-intl";
import { QUESTION_TYPES, newQuestion } from "@/lib/study/defaults";
import type { Lang, Option, Question } from "@/lib/study/types";
import { tx, uid, variableName } from "@/lib/study/util";
import { Button, Icon, IconButton, L10nInput, MediaInput, NumberInput, Select, TextInput, Toggle } from "./ui";

const CHOICE = new Set<Question["type"]>(["single", "multiple", "dropdown", "ranking", "image", "matrix"]);
const SHUFFLE = new Set<Question["type"]>(["single", "multiple", "dropdown", "ranking", "image"]);
const EXTRA = new Set<Question["type"]>(["single", "multiple", "dropdown", "likert", "semantic", "image"]);

export function QuestionEditor({
  q,
  index,
  count,
  langs,
  open,
  toggle,
  change,
  remove,
  moveBy,
  duplicate,
  duplicateVar,
}: {
  q: Question;
  index: number;
  count: number;
  langs: Lang[];
  open: boolean;
  toggle: () => void;
  change: (q: Question) => void;
  remove: () => void;
  moveBy: (d: number) => void;
  duplicate: () => void;
  duplicateVar: boolean;
}) {
  const t = useTranslations("studio.q");
  const qt = useTranslations("studio.qtypes");
  const ex = useTranslations("studio.extras");
  const locale = useLocale() as Lang;
  const set = (p: Partial<Question>) => change({ ...q, ...p });
  const headId = `qh-${q.id}`;

  return (
    <article aria-labelledby={headId} className="rounded-md border border-line-2 bg-void">
      <div className="flex items-center gap-1 p-1">
        <button type="button" id={headId} onClick={toggle} aria-expanded={open} className="flex min-h-11 min-w-0 flex-1 flex-col items-start px-2 py-1.5 text-start">
          <span className="font-mono text-[11px] text-faint" dir="ltr">
            {index + 1} · {qt(q.type)} · {q.variable}
            {q.required ? " · *" : ""}
            {q.attention ? " · ✓" : ""}
          </span>
          <span className="w-full truncate text-sm">{tx(q.text, locale)}</span>
        </button>
        <IconButton label={t("up")} disabled={index === 0} onClick={() => moveBy(-1)}>
          {Icon.up}
        </IconButton>
        <IconButton label={t("down")} disabled={index === count - 1} onClick={() => moveBy(1)}>
          {Icon.down}
        </IconButton>
        <IconButton label={t("duplicate")} onClick={duplicate}>
          {Icon.copy}
        </IconButton>
        <IconButton label={t("remove")} onClick={remove}>
          {Icon.x}
        </IconButton>
      </div>

      {open && (
        <div className="flex flex-col gap-4 border-t border-line-2 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t("type")}
              value={q.type}
              onChange={(ty) => {
                // Keep the wording and variable; take the new type's starting options and scale.
                const fresh = newQuestion(ty, 0);
                change({ ...fresh, id: q.id, variable: q.variable, text: q.text, help: q.help, required: q.required });
              }}
              options={QUESTION_TYPES.map((k) => [k, qt(k)] as [Question["type"], string])}
            />
            <TextInput label={t("variable")} hint={duplicateVar ? `⚠ ${t("variableHint")}` : t("variableHint")} value={q.variable} onChange={(v) => set({ variable: variableName(v) })} dir="ltr" />
          </div>
          <L10nInput label={t("text")} value={q.text} onChange={(v) => set({ text: v })} langs={langs} multiline />
          <L10nInput label={t("help")} value={q.help ?? {}} onChange={(v) => set({ help: v })} langs={langs} />
          <div className="flex flex-wrap gap-x-6">
            <Toggle label={t("required")} checked={q.required} onChange={(v) => set({ required: v })} />
            {SHUFFLE.has(q.type) && <Toggle label={t("randomize")} checked={!!q.randomize} onChange={(v) => set({ randomize: v })} />}
          </div>

          {(q.type === "likert" || q.type === "semantic") && q.scale && (
            <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
              <NumberInput label={t("points")} value={q.scale.points} step="1" onChange={(v) => set({ scale: { ...q.scale!, points: Math.min(11, Math.max(2, v ?? 5)) } })} />
              <div className="flex flex-col gap-3">
                <L10nInput label={t("left")} value={q.scale.left} onChange={(v) => set({ scale: { ...q.scale!, left: v } })} langs={langs} />
                <L10nInput label={t("right")} value={q.scale.right} onChange={(v) => set({ scale: { ...q.scale!, right: v } })} langs={langs} />
              </div>
            </div>
          )}

          {q.type === "slider" && q.range && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <NumberInput label={t("min")} value={q.range.min} onChange={(v) => set({ range: { ...q.range!, min: v ?? 0 } })} />
                <NumberInput label={t("max")} value={q.range.max} onChange={(v) => set({ range: { ...q.range!, max: v ?? 100 } })} />
                <NumberInput label={t("step")} value={q.range.step} onChange={(v) => set({ range: { ...q.range!, step: v ?? 1 } })} />
              </div>
              <L10nInput label={t("left")} value={q.range.left} onChange={(v) => set({ range: { ...q.range!, left: v } })} langs={langs} />
              <L10nInput label={t("right")} value={q.range.right} onChange={(v) => set({ range: { ...q.range!, right: v } })} langs={langs} />
            </>
          )}

          {q.type === "numeric" && (
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label={t("min")} value={q.limits?.min} onChange={(v) => set({ limits: { ...q.limits, min: v } })} />
              <NumberInput label={t("max")} value={q.limits?.max} onChange={(v) => set({ limits: { ...q.limits, max: v } })} />
            </div>
          )}

          {q.type === "matrix" && <Options label={t("rows")} addLabel={t("addRow")} items={q.rows ?? []} langs={langs} onChange={(rows) => set({ rows })} />}
          {CHOICE.has(q.type) && (
            <Options label={q.type === "matrix" ? t("columns") : t("options")} addLabel={t("addOption")} items={q.options ?? []} langs={langs} images={q.type === "image"} onChange={(options) => set({ options })} />
          )}

          {EXTRA.has(q.type) && (
            <Select
              label={t("extra")}
              value={q.extra ?? ""}
              onChange={(v) => set({ extra: (v || undefined) as Question["extra"] })}
              options={[
                ["", t("extraNone")],
                ["none", ex("none")],
                ["not_sure", ex("not_sure")],
                ["prefer_not", ex("prefer_not")],
              ]}
            />
          )}

          {(q.type === "single" || q.type === "dropdown" || q.type === "likert" || q.type === "semantic" || q.type === "image") && (
            <TextInput label={t("attention")} hint={t("attentionHint")} value={q.attention} onChange={(v) => set({ attention: v || undefined })} dir="ltr" />
          )}
        </div>
      )}
    </article>
  );
}

/** Editable list of options (value + label in each language, optionally an image). */
function Options({ label, addLabel, items, langs, onChange, images = false }: { label: string; addLabel: string; items: Option[]; langs: Lang[]; onChange: (o: Option[]) => void; images?: boolean }) {
  const t = useTranslations("studio.q");
  const f = useTranslations("studio.fields");
  const set = (i: number, p: Partial<Option>) => onChange(items.map((o, j) => (j === i ? { ...o, ...p } : o)));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-[13px] font-medium text-mist">{label}</legend>
      {items.map((o, i) => (
        <div key={o.id} className="flex flex-col gap-2 rounded-md border border-line-2 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <input aria-label={`${t("value")} ${i + 1}`} value={o.value} onChange={(e) => set(i, { value: e.target.value })} dir="ltr" className="h-11 w-16 rounded-md border border-line-2 bg-void px-2 text-center font-mono text-sm" />
            {langs.map((l) => (
              <input
                key={l}
                aria-label={`${label} ${i + 1} · ${f(l)}`}
                lang={l}
                dir={l === "ar" ? "rtl" : "ltr"}
                value={o.label[l] ?? ""}
                onChange={(e) => set(i, { label: { ...o.label, [l]: e.target.value } })}
                className="h-11 min-w-[140px] flex-1 rounded-md border border-line-2 bg-void px-3 text-sm"
              />
            ))}
            <IconButton label={t("up")} disabled={i === 0} onClick={() => onChange(items.map((_, j) => items[j === i - 1 ? i : j === i ? i - 1 : j]))}>
              {Icon.up}
            </IconButton>
            <IconButton label={t("remove")} onClick={() => onChange(items.filter((_, j) => j !== i))}>
              {Icon.x}
            </IconButton>
          </div>
          {images && <MediaInput label={f("image")} value={o.image} onChange={(v) => set(i, { image: v })} />}
        </div>
      ))}
      <div>
        <Button
          onClick={() => {
            const used = new Set(items.map((o) => o.value));
            let n = items.length + 1;
            while (used.has(String(n))) n++;
            onChange([...items, { id: uid("o"), value: String(n), label: {} }]);
          }}
        >
          {Icon.plus}
          {addLabel}
        </Button>
      </div>
    </fieldset>
  );
}
