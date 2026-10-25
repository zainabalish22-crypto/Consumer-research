"use client";
import { useEffect, useMemo, useState } from "react";
import { SPECIAL_CODES, type Language, type MediaRef, type Question } from "@/lib/study/schema";
import { likertValues, type AnswerError } from "@/lib/study/answers";
import { lt } from "@/lib/study/text";
import { seededShuffle } from "@/lib/random";
import { cx } from "@/components/ui";
import { normalizeDigits, type Tr } from "./i18n";

interface Props {
  q: Question;
  lang: Language;
  fallback: Language;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: AnswerError;
  seed: string;
  mediaUrls: Record<string, string>;
  tr: Tr;
  /** Replaces {{stimulus}} / {{factor:x}} placeholders. */
  pipeText?: (s: string) => string;
}

const choiceRow =
  "flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-base hover:border-accent/60 has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent";

export function QuestionView({ q, lang, fallback, value, onChange, error, seed, mediaUrls, tr, pipeText }: Props) {
  const text = (t: Parameters<typeof lt>[0]) => {
    const s = lt(t, lang, fallback);
    return pipeText ? pipeText(s) : s;
  };
  const name = `q_${q.id}`;
  const errId = `${name}_err`;
  const helpId = `${name}_help`;
  const described = [q.help && text(q.help) ? helpId : null, error ? errId : null].filter(Boolean).join(" ") || undefined;

  const specials = (s?: { notSure: boolean; preferNot: boolean }) => [
    ...(s?.notSure ? [{ value: SPECIAL_CODES.notSure, label: tr("notSure") }] : []),
    ...(s?.preferNot ? [{ value: SPECIAL_CODES.preferNot, label: tr("preferNot") }] : []),
  ];

  const orderedOptions = useMemo(() => {
    if (!("options" in q)) return [];
    const r = "randomizeOptions" in q && q.randomizeOptions;
    return r ? seededShuffle(q.options, `${seed}:${q.id}`) : q.options;
  }, [q, seed]);

  const header = (
    <>
      <legend className="mb-1 text-lg font-medium leading-snug">
        <span className="prose-study">{text(q.text)}</span>
        {q.required && (
          <span className="ms-1 text-danger" aria-hidden>
            *
          </span>
        )}
        {q.required && <span className="sr-only"> ({tr("required")})</span>}
      </legend>
      {q.help && text(q.help) && (
        <p id={helpId} className="prose-study mb-3 text-sm text-muted">
          {text(q.help)}
        </p>
      )}
    </>
  );
  const errorLine = error && (
    <p id={errId} role="alert" className="mt-2 text-sm text-danger">
      {tr(`err_${error}`)}
    </p>
  );

  switch (q.type) {
    case "single":
    case "image_choice":
    case "multiple": {
      const multi = q.type === "multiple" || (q.type === "image_choice" && q.multiple);
      const selected: number[] = multi ? (Array.isArray(value) ? (value as number[]) : []) : value != null ? [value as number] : [];
      const sp = q.type === "image_choice" ? [] : specials(q.special);
      const toggle = (v: number, isSpecial: boolean) => {
        if (!multi) return onChange(v);
        if (isSpecial) return onChange(selected.includes(v) ? [] : [v]);
        const base = selected.filter((x) => !sp.some((s) => s.value === x));
        onChange(base.includes(v) ? base.filter((x) => x !== v) : [...base, v]);
      };
      const isImage = q.type === "image_choice";
      return (
        <fieldset aria-describedby={described} aria-invalid={!!error}>
          {header}
          <div className={cx(isImage ? "grid grid-cols-2 gap-3 sm:grid-cols-3" : "flex flex-col gap-2")}>
            {orderedOptions.map((o) => {
              const imageRef = isImage ? (o as { image?: MediaRef }).image : undefined;
              const img = imageRef ? mediaUrls[imageRef.storagePath] : undefined;
              return (
                <label key={o.id} className={cx(choiceRow, isImage && "flex-col items-stretch p-2")}>
                  <input
                    type={multi ? "checkbox" : "radio"}
                    name={name}
                    value={o.value}
                    checked={selected.includes(o.value)}
                    onChange={() => toggle(o.value, false)}
                    className={cx("size-5 shrink-0 accent-[var(--color-accent)]", isImage && "sr-only")}
                  />
                  {isImage && (
                    <span className="block aspect-square overflow-hidden rounded-md bg-paper">
                      {img && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={imageRef ? text(imageRef.alt) : ""} loading="lazy" className="size-full object-cover" />
                      )}
                    </span>
                  )}
                  <span className={cx(isImage && "px-1 pb-1 text-center text-sm")}>{text(o.label)}</span>
                </label>
              );
            })}
            {sp.length > 0 && <hr className="my-1 border-line" />}
            {sp.map((s) => (
              <label key={s.value} className={choiceRow}>
                <input
                  type={multi ? "checkbox" : "radio"}
                  name={name}
                  value={s.value}
                  checked={selected.includes(s.value)}
                  onChange={() => toggle(s.value, true)}
                  className="size-5 shrink-0 accent-[var(--color-accent)]"
                />
                <span className="text-muted">{s.label}</span>
              </label>
            ))}
          </div>
          {errorLine}
        </fieldset>
      );
    }

    case "dropdown":
      return (
        <div>
          <label htmlFor={name} className="mb-1 block text-lg font-medium">
            {text(q.text)}
            {q.required && <span className="ms-1 text-danger">*</span>}
          </label>
          {q.help && text(q.help) && (
            <p id={helpId} className="mb-2 text-sm text-muted">
              {text(q.help)}
            </p>
          )}
          <select
            id={name}
            value={value == null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            aria-describedby={described}
            aria-invalid={!!error}
            className="w-full rounded-lg border border-line bg-surface px-3 py-3 text-base"
          >
            <option value="">{tr("selectPlaceholder")}</option>
            {orderedOptions.map((o) => (
              <option key={o.id} value={o.value}>
                {text(o.label)}
              </option>
            ))}
            {specials(q.special).map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {errorLine}
        </div>
      );

    case "likert": {
      const vals = likertValues(q);
      return (
        <fieldset aria-describedby={described} aria-invalid={!!error}>
          {header}
          {/* A row of numbered boxes with the end labels underneath; when every point has a
              label, the chosen point's label is shown too, so no wording is lost. */}
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${vals.length}, minmax(0, 1fr))` }}>
            {vals.map((v, i) => (
              <label
                key={v}
                className="flex h-12 cursor-pointer items-center justify-center rounded-lg border border-line-strong bg-surface text-base tabular-nums hover:border-accent/60 has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:font-semibold has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2"
              >
                <input
                  type="radio"
                  name={name}
                  value={v}
                  checked={value === v}
                  onChange={() => onChange(v)}
                  aria-label={text(q.labels[i]) ? `${v}, ${text(q.labels[i])}` : String(v)}
                  className="sr-only"
                />
                <span aria-hidden>{v}</span>
              </label>
            ))}
          </div>
          {(text(q.labels[0]) || text(q.labels[vals.length - 1])) && (
            <div className="mt-1.5 flex justify-between gap-4 text-sm text-muted" aria-hidden>
              <span>{text(q.labels[0])}</span>
              <span className="text-end">{text(q.labels[vals.length - 1])}</span>
            </div>
          )}
          {vals.length > 2 && q.labels.slice(1, -1).some((l) => text(l)) && typeof value === "number" && vals.includes(value) && (
            <p className="mt-1 text-center text-sm font-medium text-accent-strong" aria-live="polite">
              {text(q.labels[vals.indexOf(value)])}
            </p>
          )}
          {specials(q.special).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {specials(q.special).map((s) => (
                <label key={s.value} className={cx(choiceRow, "py-2 text-sm")}>
                  <input
                    type="radio"
                    name={name}
                    checked={value === s.value}
                    onChange={() => onChange(s.value)}
                    className="size-4 accent-[var(--color-accent)]"
                  />
                  <span className="text-muted">{s.label}</span>
                </label>
              ))}
            </div>
          )}
          {errorLine}
        </fieldset>
      );
    }

    case "semantic": {
      const vals = likertValues(q);
      return (
        <fieldset aria-describedby={described} aria-invalid={!!error}>
          {header}
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-end text-sm sm:w-28">{text(q.leftLabel)}</span>
            <div className="flex flex-1 justify-between gap-1">
              {vals.map((v, i) => (
                <label key={v} className="flex flex-1 cursor-pointer justify-center py-2">
                  <input
                    type="radio"
                    name={name}
                    value={v}
                    checked={value === v}
                    onChange={() => onChange(v)}
                    className="size-6 accent-[var(--color-accent)]"
                    aria-label={
                      i === 0 ? text(q.leftLabel) : i === vals.length - 1 ? text(q.rightLabel) : tr("scalePoint", { n: i + 1, total: vals.length })
                    }
                  />
                </label>
              ))}
            </div>
            <span className="w-20 shrink-0 text-sm sm:w-28">{text(q.rightLabel)}</span>
          </div>
          {errorLine}
        </fieldset>
      );
    }

    case "slider": {
      const touched = typeof value === "number";
      const mid = q.min + Math.round((q.max - q.min) / 2 / q.step) * q.step;
      return (
        <div>
          <label htmlFor={name} className="mb-1 block text-lg font-medium">
            {text(q.text)}
            {q.required && <span className="ms-1 text-danger">*</span>}
          </label>
          {q.help && text(q.help) && (
            <p id={helpId} className="mb-2 text-sm text-muted">
              {text(q.help)}
            </p>
          )}
          <div className="flex items-center gap-3">
            <input
              id={name}
              type="range"
              min={q.min}
              max={q.max}
              step={q.step}
              value={touched ? (value as number) : mid}
              onChange={(e) => onChange(Number(e.target.value))}
              onClick={(e) => onChange(Number((e.target as HTMLInputElement).value))}
              aria-describedby={described}
              aria-invalid={!!error}
              className={cx("flex-1 accent-[var(--color-accent)]", !touched && "opacity-50")}
            />
            <output htmlFor={name} className="w-14 text-center font-medium tabular-nums" dir="ltr">
              {touched ? String(value) : "–"}
            </output>
          </div>
          <div className="mt-1 flex justify-between text-sm text-muted">
            <span>{text(q.leftLabel) || q.min}</span>
            <span>{text(q.rightLabel) || q.max}</span>
          </div>
          {!touched && <p className="mt-1 text-xs text-muted">{tr("sliderUntouched")}</p>}
          {errorLine}
        </div>
      );
    }

    case "matrix": {
      const v = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, number>;
      const rows = q.randomizeRows ? seededShuffle(q.rows, `${seed}:${q.id}`) : q.rows;
      return (
        <fieldset aria-describedby={described} aria-invalid={!!error}>
          {header}
          <div className="flex flex-col gap-3">
            {rows.map((r) => (
              <fieldset key={r.id} className="rounded-lg border border-line bg-surface p-3">
                <legend className="px-1 text-base font-medium">{text(r.text)}</legend>
                <div className="mt-1 flex flex-col gap-1 sm:grid sm:gap-1" style={{ gridTemplateColumns: `repeat(${q.columns.length}, minmax(0, 1fr))` }}>
                  {q.columns.map((c) => (
                    <label
                      key={c.value}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-paper has-[:checked]:bg-accent-soft sm:flex-col sm:text-center"
                    >
                      <input
                        type="radio"
                        name={`${name}_${r.code}`}
                        checked={v[r.code] === c.value}
                        onChange={() => onChange({ ...v, [r.code]: c.value })}
                        className="size-5 accent-[var(--color-accent)]"
                      />
                      <span>{text(c.label) || c.value}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          {errorLine}
        </fieldset>
      );
    }

    case "constant_sum":
      return <ConstantSum q={q} options={orderedOptions} name={name} value={value} onChange={onChange} text={text} tr={tr} header={header} errorLine={errorLine} described={described} error={error} />;

    case "ranking":
      return <Ranking q={q} options={orderedOptions} value={value} onChange={onChange} text={text} tr={tr} header={header} errorLine={errorLine} />;

    case "numeric":
      return <NumericInput q={q} name={name} value={value} onChange={onChange} text={text} tr={tr} described={described} error={error} errorLine={errorLine} helpId={helpId} />;

    case "text": {
      const common = {
        id: name,
        value: typeof value === "string" ? value : "",
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
        maxLength: q.maxLength,
        dir: "auto" as const,
        "aria-describedby": described,
        "aria-invalid": !!error,
        className: "w-full rounded-lg border border-line bg-surface px-3 py-3 text-base",
      };
      return (
        <div>
          <label htmlFor={name} className="mb-1 block text-lg font-medium">
            {text(q.text)}
            {q.required && <span className="ms-1 text-danger">*</span>}
          </label>
          {q.help && text(q.help) && (
            <p id={helpId} className="mb-2 text-sm text-muted">
              {text(q.help)}
            </p>
          )}
          {q.multiline ? <textarea rows={5} {...common} /> : <input type="text" {...common} />}
          {errorLine}
        </div>
      );
    }

    case "date":
      return (
        <div>
          <label htmlFor={name} className="mb-1 block text-lg font-medium">
            {text(q.text)}
            {q.required && <span className="ms-1 text-danger">*</span>}
          </label>
          <input
            id={name}
            type="date"
            min={q.min}
            max={q.max}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            aria-describedby={described}
            aria-invalid={!!error}
            className="rounded-lg border border-line bg-surface px-3 py-3 text-base"
          />
          {errorLine}
        </div>
      );
  }
}

function Ranking({
  q,
  options,
  value,
  onChange,
  text,
  tr,
  header,
  errorLine,
}: {
  q: Extract<Question, { type: "ranking" }>;
  options: Extract<Question, { type: "ranking" }>["options"];
  value: unknown;
  onChange: (v: unknown) => void;
  text: (t: Parameters<typeof lt>[0]) => string;
  tr: Tr;
  header: React.ReactNode;
  errorLine: React.ReactNode;
}) {
  const order: number[] = Array.isArray(value) ? (value as number[]) : options.map((o) => o.value);
  // The displayed starting order counts as the participant's answer unless they change it.
  useEffect(() => {
    if (!Array.isArray(value)) onChange(order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const move = (i: number, d: -1 | 1) => {
    const next = [...order];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const byValue = new Map(q.options.map((o) => [o.value, o]));
  return (
    <fieldset>
      {header}
      <p className="mb-2 text-sm text-muted">{tr("rankingHint")}</p>
      <ol className="flex flex-col gap-2">
        {order.map((v, i) => (
          <li key={v} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
            <span className="w-6 text-center font-semibold tabular-nums">{i + 1}</span>
            <span className="flex-1">{text(byValue.get(v)?.label)}</span>
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label={tr("moveUp", { item: text(byValue.get(v)?.label) })}
              className="rounded-md border border-line px-2 py-1 disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === order.length - 1}
              aria-label={tr("moveDown", { item: text(byValue.get(v)?.label) })}
              className="rounded-md border border-line px-2 py-1 disabled:opacity-30"
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      {errorLine}
    </fieldset>
  );
}

function ConstantSum({
  q,
  options,
  name,
  value,
  onChange,
  text,
  tr,
  header,
  errorLine,
  described,
  error,
}: {
  q: Extract<Question, { type: "constant_sum" }>;
  options: Extract<Question, { type: "constant_sum" }>["options"];
  name: string;
  value: unknown;
  onChange: (v: unknown) => void;
  text: (t: Parameters<typeof lt>[0]) => string;
  tr: Tr;
  header: React.ReactNode;
  errorLine: React.ReactNode;
  described?: string;
  error?: string;
}) {
  const v = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, number>;
  const sum = Object.values(v).reduce((s, x) => s + (Number.isFinite(x) ? x : 0), 0);
  const left = q.total - sum;
  const unit = text(q.unit);
  const set = (key: string, raw: string) => {
    const n = Number(normalizeDigits(raw).replace(/[^0-9]/g, ""));
    const next = { ...v };
    if (!raw.trim() || !Number.isFinite(n) || n === 0) delete next[key];
    else next[key] = Math.min(q.total, Math.round(n));
    onChange(next);
  };
  return (
    <fieldset aria-describedby={described} aria-invalid={!!error}>
      {header}
      <p className="mb-2 text-sm text-muted">{tr("sumHint", { total: q.total, unit })}</p>
      <div className="flex flex-col gap-2">
        {options.map((o) => {
          const id = `${name}_${o.value}`;
          return (
            <label key={o.id} htmlFor={id} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
              <span className="flex-1">{text(o.label)}</span>
              <input
                id={id}
                inputMode="numeric"
                dir="ltr"
                value={v[String(o.value)] ?? ""}
                onChange={(e) => set(String(o.value), e.target.value)}
                className="w-20 rounded-md border border-line px-2 py-1.5 text-end tabular-nums"
                aria-label={text(o.label)}
              />
              {unit && <span className="w-14 text-sm text-muted">{unit}</span>}
            </label>
          );
        })}
      </div>
      <p role="status" className={cx("mt-2 text-sm tabular-nums", left === 0 ? "text-accent" : left < 0 ? "text-danger" : "text-muted")}>
        {left === 0 ? tr("sumDone", { total: q.total, unit }) : left > 0 ? tr("sumLeft", { n: left, unit }) : tr("sumOver", { n: -left, unit })}
      </p>
      {errorLine}
    </fieldset>
  );
}

function NumericInput({
  q,
  name,
  value,
  onChange,
  text,
  described,
  error,
  errorLine,
  helpId,
}: {
  q: Extract<Question, { type: "numeric" }>;
  name: string;
  value: unknown;
  onChange: (v: unknown) => void;
  text: (t: Parameters<typeof lt>[0]) => string;
  tr: Tr;
  described?: string;
  error?: AnswerError;
  errorLine: React.ReactNode;
  helpId: string;
}) {
  const [raw, setRaw] = useState(typeof value === "number" ? String(value) : "");
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-lg font-medium">
        {text(q.text)}
        {q.required && <span className="ms-1 text-danger">*</span>}
      </label>
      {q.help && text(q.help) && (
        <p id={helpId} className="mb-2 text-sm text-muted">
          {text(q.help)}
        </p>
      )}
      <div className="flex items-center gap-2">
        <input
          id={name}
          type="text"
          inputMode={q.integerOnly ? "numeric" : "decimal"}
          dir="ltr"
          value={raw}
          onChange={(e) => {
            const s = normalizeDigits(e.target.value);
            setRaw(s);
            const n = s.trim() === "" ? null : Number(s);
            onChange(n === null ? null : Number.isFinite(n) ? n : s);
          }}
          aria-describedby={described}
          aria-invalid={!!error}
          className="w-40 rounded-lg border border-line bg-surface px-3 py-3 text-base"
        />
        {q.unit && text(q.unit) && <span className="text-muted">{text(q.unit)}</span>}
      </div>
      {errorLine}
    </div>
  );
}
