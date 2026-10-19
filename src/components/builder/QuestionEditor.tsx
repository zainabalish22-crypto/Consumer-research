"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { QUESTION_TYPES, type ChoiceOption, type Language, type Question, type QuestionType } from "@/lib/study/schema";
import { newQuestion, AGREE_5, AGREE_7, shortId } from "@/lib/study/factories";
import { likertValues } from "@/lib/study/answers";
import { Button, Select } from "@/components/ui";
import { LocalizedField } from "./LocalizedField";
import { Checkbox, IconButton, NumberField, TextField, moveItem } from "./controls";
import { MediaPicker } from "./MediaPicker";

type Props = { q: Question; languages: Language[]; onChange: (q: Question) => void };

export function QuestionEditor({ q, languages, onChange }: Props) {
  const t = useTranslations("builder.question");
  const set = (patch: Record<string, unknown>) => onChange({ ...q, ...patch } as Question);

  const changeType = (type: QuestionType) => {
    const fresh = newQuestion(type, q.variable);
    onChange({ ...fresh, id: q.id, text: q.text, help: q.help, required: q.required } as Question);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={`type-${q.id}`}>
            {t("type")}
          </label>
          <Select id={`type-${q.id}`} value={q.type} onChange={(e) => changeType(e.target.value as QuestionType)}>
            {QUESTION_TYPES.map((qt) => (
              <option key={qt} value={qt}>
                {t(`types.${qt}`)}
              </option>
            ))}
          </Select>
        </div>
        <TextField
          label={t("variable")}
          value={q.variable}
          onChange={(v) => set({ variable: v.replace(/\s/g, "_") })}
          hint={t("variableHint")}
          dir="ltr"
          mono
          error={/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(q.variable) ? undefined : t("variableInvalid")}
        />
      </div>
      <LocalizedField label={t("text")} value={q.text} onChange={(v) => set({ text: v })} languages={languages} multiline rows={2} />
      <LocalizedField label={t("help")} value={q.help} onChange={(v) => set({ help: v })} languages={languages} />
      <Checkbox label={t("required")} checked={q.required} onChange={(v) => set({ required: v })} />

      <TypeSpecific q={q} languages={languages} onChange={onChange} />
    </div>
  );
}

function TypeSpecific({ q, languages, onChange }: Props) {
  const t = useTranslations("builder.question");
  const patch = (p: Record<string, unknown>) => onChange({ ...q, ...p } as Question);

  const special = "special" in q && (
    <div className="flex flex-wrap gap-4">
      <Checkbox label={t("notSure")} checked={q.special.notSure} onChange={(v) => patch({ special: { ...q.special, notSure: v } })} />
      <Checkbox label={t("preferNot")} checked={q.special.preferNot} onChange={(v) => patch({ special: { ...q.special, preferNot: v } })} />
    </div>
  );

  const attention = "attentionCheck" in q || q.type === "single" || q.type === "dropdown" || q.type === "likert" ? (
    <AttentionCheck q={q as Extract<Question, { type: "single" | "dropdown" | "likert" }>} onChange={onChange} />
  ) : null;

  switch (q.type) {
    case "single":
    case "dropdown":
    case "multiple":
    case "ranking":
    case "image_choice":
      return (
        <div className="flex flex-col gap-3">
          <OptionsEditor
            options={q.options}
            languages={languages}
            withImages={q.type === "image_choice"}
            onChange={(options) => patch({ options })}
          />
          <Checkbox label={t("randomizeOptions")} checked={q.randomizeOptions} onChange={(v) => patch({ randomizeOptions: v })} hint={t("randomizeHint")} />
          {q.type === "image_choice" && <Checkbox label={t("allowMultiple")} checked={q.multiple} onChange={(v) => patch({ multiple: v })} />}
          {q.type === "multiple" && (
            <div className="grid grid-cols-2 gap-3">
              <NumberField label={t("minSelect")} value={q.minSelect} optional min={0} onChange={(v) => patch({ minSelect: v })} />
              <NumberField label={t("maxSelect")} value={q.maxSelect} optional min={1} onChange={(v) => patch({ maxSelect: v })} />
            </div>
          )}
          {special}
          {attention}
        </div>
      );
    case "likert":
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label={t("points")}
              value={q.points}
              min={2}
              max={11}
              onChange={(v) => {
                const points = Math.min(11, Math.max(2, v ?? 5));
                const labels = points === 5 ? AGREE_5 : points === 7 ? AGREE_7 : Array.from({ length: points }, (_, i) => q.labels[i] ?? {});
                patch({ points, labels });
              }}
            />
            <NumberField label={t("startValue")} value={q.startValue} min={-5} max={1} onChange={(v) => patch({ startValue: v ?? 1 })} />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t("pointLabels")}</p>
            {likertValues(q).map((val, i) => (
              <LocalizedField
                key={i}
                label={t("pointLabel", { n: val })}
                value={q.labels[i]}
                languages={languages}
                onChange={(v) => {
                  const labels = Array.from({ length: q.points }, (_, k) => q.labels[k] ?? {});
                  labels[i] = v;
                  patch({ labels });
                }}
              />
            ))}
          </div>
          {special}
          {attention}
        </div>
      );
    case "semantic":
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <NumberField label={t("points")} value={q.points} min={3} max={11} onChange={(v) => patch({ points: Math.min(11, Math.max(3, v ?? 7)) })} />
            <NumberField label={t("startValue")} value={q.startValue} min={-5} max={1} onChange={(v) => patch({ startValue: v ?? 1 })} />
          </div>
          <LocalizedField label={t("leftLabel")} value={q.leftLabel} languages={languages} onChange={(v) => patch({ leftLabel: v })} />
          <LocalizedField label={t("rightLabel")} value={q.rightLabel} languages={languages} onChange={(v) => patch({ rightLabel: v })} />
        </div>
      );
    case "slider":
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3">
            <NumberField label={t("min")} value={q.min} onChange={(v) => patch({ min: v ?? 0 })} />
            <NumberField label={t("max")} value={q.max} onChange={(v) => patch({ max: v ?? 100 })} />
            <NumberField label={t("step")} value={q.step} min={0} step={0.1} onChange={(v) => patch({ step: v && v > 0 ? v : 1 })} />
          </div>
          <LocalizedField label={t("leftLabel")} value={q.leftLabel} languages={languages} onChange={(v) => patch({ leftLabel: v })} />
          <LocalizedField label={t("rightLabel")} value={q.rightLabel} languages={languages} onChange={(v) => patch({ rightLabel: v })} />
        </div>
      );
    case "matrix":
      return (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t("rows")}</p>
            {q.rows.map((r, i) => (
              <div key={r.id} className="flex flex-col gap-2 rounded-lg border border-line p-3">
                <div className="flex items-end gap-2">
                  <TextField
                    label={t("rowCode")}
                    value={r.code}
                    dir="ltr"
                    mono
                    className="w-28"
                    onChange={(v) => patch({ rows: q.rows.map((x, k) => (k === i ? { ...x, code: v.replace(/[^A-Za-z0-9_]/g, "") } : x)) })}
                  />
                  <span className="flex-1 pb-2 text-xs text-muted" dir="ltr">
                    → {q.variable}_{r.code}
                  </span>
                  <IconButton label={t("moveUp")} disabled={i === 0} onClick={() => patch({ rows: moveItem(q.rows, i, i - 1) })}>
                    ↑
                  </IconButton>
                  <IconButton label={t("moveDown")} disabled={i === q.rows.length - 1} onClick={() => patch({ rows: moveItem(q.rows, i, i + 1) })}>
                    ↓
                  </IconButton>
                  <IconButton label={t("remove")} disabled={q.rows.length <= 1} onClick={() => patch({ rows: q.rows.filter((_, k) => k !== i) })}>
                    ✕
                  </IconButton>
                </div>
                <LocalizedField label={t("rowText")} value={r.text} languages={languages} onChange={(v) => patch({ rows: q.rows.map((x, k) => (k === i ? { ...x, text: v } : x)) })} />
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() => {
                let n = q.rows.length + 1;
                while (q.rows.some((r) => r.code === String(n))) n++;
                patch({ rows: [...q.rows, { id: shortId("r"), code: String(n), text: {} }] });
              }}
            >
              {t("addRow")}
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t("columns")}</p>
            {q.columns.map((c, i) => (
              <div key={i} className="flex items-end gap-2">
                <NumberField label={t("code")} value={c.value} className="w-24" onChange={(v) => patch({ columns: q.columns.map((x, k) => (k === i ? { ...x, value: v ?? 0 } : x)) })} />
                <div className="flex-1">
                  <LocalizedField label={t("columnLabel")} value={c.label} languages={languages} onChange={(v) => patch({ columns: q.columns.map((x, k) => (k === i ? { ...x, label: v } : x)) })} />
                </div>
                <IconButton label={t("remove")} disabled={q.columns.length <= 2} onClick={() => patch({ columns: q.columns.filter((_, k) => k !== i) })}>
                  ✕
                </IconButton>
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              className="self-start"
              disabled={q.columns.length >= 11}
              onClick={() => patch({ columns: [...q.columns, { value: Math.max(0, ...q.columns.map((c) => c.value)) + 1, label: {} }] })}
            >
              {t("addColumn")}
            </Button>
          </div>
          <Checkbox label={t("randomizeRows")} checked={q.randomizeRows} onChange={(v) => patch({ randomizeRows: v })} />
        </div>
      );
    case "numeric":
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <NumberField label={t("min")} value={q.min} optional onChange={(v) => patch({ min: v })} />
            <NumberField label={t("max")} value={q.max} optional onChange={(v) => patch({ max: v })} />
          </div>
          <Checkbox label={t("integerOnly")} checked={q.integerOnly} onChange={(v) => patch({ integerOnly: v })} />
          <LocalizedField label={t("unit")} value={q.unit} languages={languages} onChange={(v) => patch({ unit: v })} />
        </div>
      );
    case "text":
      return (
        <div className="flex flex-col gap-3">
          <Checkbox label={t("multiline")} checked={q.multiline} onChange={(v) => patch({ multiline: v })} />
          <NumberField label={t("maxLength")} value={q.maxLength} min={1} max={10000} onChange={(v) => patch({ maxLength: Math.min(10000, Math.max(1, v ?? 500)) })} />
        </div>
      );
    case "date":
      return (
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t("minDate")} value={q.min ?? ""} dir="ltr" hint="YYYY-MM-DD" onChange={(v) => patch({ min: v || undefined })} />
          <TextField label={t("maxDate")} value={q.max ?? ""} dir="ltr" hint="YYYY-MM-DD" onChange={(v) => patch({ max: v || undefined })} />
        </div>
      );
  }
}

function AttentionCheck({
  q,
  onChange,
}: {
  q: Extract<Question, { type: "single" | "dropdown" | "likert" }>;
  onChange: (q: Question) => void;
}) {
  const t = useTranslations("builder.question");
  const on = !!q.attentionCheck;
  const values = q.type === "likert" ? likertValues(q) : q.options.map((o) => o.value);
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-paper p-3">
      <Checkbox
        label={t("attentionCheck")}
        hint={t("attentionCheckHint")}
        checked={on}
        onChange={(v) => onChange({ ...q, attentionCheck: v ? { expected: values[0] } : undefined } as Question)}
      />
      {on && (
        <div className="flex items-center gap-2">
          <label className="text-sm" htmlFor={`att-${q.id}`}>
            {t("expectedAnswer")}
          </label>
          <Select
            id={`att-${q.id}`}
            className="w-auto"
            value={q.attentionCheck!.expected}
            onChange={(e) => onChange({ ...q, attentionCheck: { expected: Number(e.target.value) } } as Question)}
          >
            {values.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}

type Opt = ChoiceOption & { image?: import("@/lib/study/schema").MediaRef };

function OptionsEditor({
  options,
  languages,
  withImages,
  onChange,
}: {
  options: Opt[];
  languages: Language[];
  withImages?: boolean;
  onChange: (o: Opt[]) => void;
}) {
  const t = useTranslations("builder.question");
  const [picking, setPicking] = useState<number | null>(null);
  const update = (i: number, p: Partial<Opt>) => onChange(options.map((o, k) => (k === i ? { ...o, ...p } : o)));
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{t("options")}</p>
      {options.map((o, i) => (
        <div key={o.id} className="flex flex-col gap-2 rounded-lg border border-line p-3">
          <div className="flex items-end gap-2">
            <NumberField label={t("code")} value={o.value} className="w-24" onChange={(v) => update(i, { value: v ?? 0 })} />
            <span className="flex-1" />
            <IconButton label={t("moveUp")} disabled={i === 0} onClick={() => onChange(moveItem(options, i, i - 1))}>
              ↑
            </IconButton>
            <IconButton label={t("moveDown")} disabled={i === options.length - 1} onClick={() => onChange(moveItem(options, i, i + 1))}>
              ↓
            </IconButton>
            <IconButton label={t("remove")} disabled={options.length <= 2} onClick={() => onChange(options.filter((_, k) => k !== i))}>
              ✕
            </IconButton>
          </div>
          <LocalizedField label={t("optionLabel")} value={o.label} languages={languages} onChange={(v) => update(i, { label: v })} />
          {withImages && (
            <div className="flex items-center gap-2 text-sm">
              <span className="truncate text-muted">{o.image ? o.image.storagePath.split("/").pop() : t("noImage")}</span>
              <Button variant="secondary" size="sm" onClick={() => setPicking(i)}>
                {o.image ? t("changeImage") : t("chooseImage")}
              </Button>
            </div>
          )}
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => onChange([...options, { id: shortId("o"), value: Math.max(0, ...options.map((o) => o.value)) + 1, label: {} }])}
      >
        {t("addOption")}
      </Button>
      {picking !== null && (
        <MediaPicker
          kinds={["image"]}
          onClose={() => setPicking(null)}
          onPick={(ref) => {
            update(picking, { image: ref });
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}
