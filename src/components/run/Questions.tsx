"use client";

import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import type { Answer, Block, Lang, Option, Question } from "@/lib/study/types";
import { useMediaUrl } from "@/lib/study/useMedia";
import { shuffle, tx } from "@/lib/study/util";
import { Card, PrimaryButton } from "./parts";

type QBlock = Extract<Block, { type: "questions" }>;
const EXTRA_VALUE = { none: "none", not_sure: "not_sure", prefer_not: "prefer_not" } as const;

const isEmpty = (q: Question, a: Answer | undefined) => {
  if (a === undefined || a === "") return true;
  if (Array.isArray(a)) return q.type === "multiple" ? a.length === 0 : false;
  if (typeof a === "object") return (q.rows ?? []).some((r) => !(a as Record<string, string>)[r.id]);
  return false;
};

/** One page of questions. Answers are checked for required items, then passed up. */
export function QuestionsPage({ block, lang, seed, onNext }: { block: QBlock; lang: Lang; seed: string; onNext: (a: Record<string, Answer>, flags: string[]) => void }) {
  const t = useTranslations("run");
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [tried, setTried] = useState(false);
  const missing = block.questions.filter((q) => q.required && isEmpty(q, answers[q.variable]));

  function submit() {
    // Ranking counts as answered with its shown order when untouched.
    const filled = { ...answers };
    for (const q of block.questions)
      if (q.type === "ranking" && filled[q.variable] === undefined) filled[q.variable] = shuffleFor(q, seed).map((o) => o.value);
    const stillMissing = block.questions.filter((q) => q.required && isEmpty(q, filled[q.variable]));
    if (stillMissing.length) {
      setTried(true);
      document.getElementById(`qw-${stillMissing[0].id}`)?.focus();
      return;
    }
    const flags = block.questions.filter((q) => q.attention && String(filled[q.variable] ?? "") !== q.attention).map((q) => q.variable);
    onNext(filled, flags);
  }

  return (
    <div className="flex flex-col gap-4">
      {tx(block.title, lang) && <h1 className="px-1 text-2xl font-semibold">{tx(block.title, lang)}</h1>}
      {block.questions.map((q) => (
        <QuestionCard key={q.id} q={q} lang={lang} seed={seed} value={answers[q.variable]} error={tried && missing.includes(q) && q.type !== "ranking"} onChange={(v) => setAnswers((a) => ({ ...a, [q.variable]: v }))} />
      ))}
      {tried && missing.filter((q) => q.type !== "ranking").length > 0 && (
        <p role="alert" className="px-1 text-sm font-medium text-[#B42318]">
          {t("requiredAll")}
        </p>
      )}
      <div>
        <PrimaryButton onClick={submit}>{t("next")}</PrimaryButton>
      </div>
    </div>
  );
}

function shuffleFor(q: Question, seed: string) {
  const opts = q.options ?? [];
  return q.randomize ? shuffle(opts, `${seed}-${q.id}`) : opts;
}

function QuestionCard({ q, lang, seed, value, onChange, error }: { q: Question; lang: Lang; seed: string; value: Answer | undefined; onChange: (v: Answer) => void; error: boolean }) {
  const t = useTranslations("run");
  const st = useTranslations("studio.extras");
  const titleId = useId();
  const options = useMemo(() => shuffleFor(q, seed), [q, seed]);
  const extra: Option | null = q.extra ? { id: "extra", value: EXTRA_VALUE[q.extra], label: { en: st(q.extra), ar: st(q.extra) } } : null;
  const label = (o: Option) => (o.id === "extra" ? st(q.extra!) : tx(o.label, lang));
  const choiceCls = (on: boolean) => `flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] px-4 py-3 text-start ${on ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,white)]" : "border-[#E3E0D8] hover:border-[#C9C5BB]"}`;
  const textCls = "w-full min-h-[52px] rounded-[14px] border-[1.5px] border-[#E3E0D8] px-4 py-3 text-base focus:border-[var(--accent)] focus:outline-none";

  let body: React.ReactNode = null;
  switch (q.type) {
    case "single":
    case "image": {
      const list = [...options, ...(extra ? [extra] : [])];
      body = (
        <div role="radiogroup" aria-labelledby={titleId} className={q.type === "image" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2.5"}>
          {list.map((o) => (
            <label key={o.id} className={choiceCls(value === o.value) + (q.type === "image" && o.id !== "extra" ? " flex-col !items-stretch p-2" : "")}>
              <input type="radio" name={q.id} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
              {q.type === "image" && o.id !== "extra" && <OptionImage src={o.image} />}
              <span className="flex items-center gap-3">
                <span aria-hidden="true" className={`h-5 w-5 shrink-0 rounded-full border-2 ${value === o.value ? "border-[var(--accent)] bg-[var(--accent)] shadow-[inset_0_0_0_3px_white]" : "border-[#B9B5AC]"}`} />
                {label(o)}
              </span>
            </label>
          ))}
        </div>
      );
      break;
    }
    case "multiple": {
      const sel = (value as string[] | undefined) ?? [];
      const list = [...options, ...(extra ? [extra] : [])];
      body = (
        <div role="group" aria-labelledby={titleId} className="flex flex-col gap-2.5">
          {list.map((o) => {
            const on = sel.includes(o.value);
            return (
              <label key={o.id} className={choiceCls(on)}>
                <input
                  type="checkbox"
                  checked={on}
                  className="sr-only"
                  onChange={() => {
                    // The extra answer ("none of these" etc.) excludes the others.
                    if (o.id === "extra") onChange(on ? [] : [o.value]);
                    else onChange(on ? sel.filter((v) => v !== o.value) : [...sel.filter((v) => v !== extra?.value), o.value]);
                  }}
                />
                <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-xs text-white ${on ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[#B9B5AC]"}`}>
                  {on ? "✓" : ""}
                </span>
                {label(o)}
              </label>
            );
          })}
        </div>
      );
      break;
    }
    case "dropdown":
      body = (
        <select id={`q-${q.id}`} aria-labelledby={titleId} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={textCls + " bg-white"}>
          <option value="">{t("select")}</option>
          {[...options, ...(extra ? [extra] : [])].map((o) => (
            <option key={o.id} value={o.value}>
              {label(o)}
            </option>
          ))}
        </select>
      );
      break;
    case "likert":
    case "semantic": {
      const n = q.scale?.points ?? 7;
      body = (
        <div className="flex flex-col gap-2">
          <div role="radiogroup" aria-labelledby={titleId} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {Array.from({ length: n }, (_, i) => String(i + 1)).map((v) => (
              <label key={v} className={`flex h-12 cursor-pointer items-center justify-center rounded-xl border-[1.5px] font-semibold ${value === v ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[#E3E0D8] hover:border-[#C9C5BB]"}`}>
                <input type="radio" name={q.id} value={v} checked={value === v} onChange={() => onChange(v)} className="sr-only" aria-label={v === "1" ? `${v} · ${tx(q.scale?.left, lang)}` : v === String(n) ? `${v} · ${tx(q.scale?.right, lang)}` : v} />
                <span dir="ltr">{v}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-between gap-4 text-sm text-[#5C6066]">
            <span>{tx(q.scale?.left, lang)}</span>
            <span className="text-end">{tx(q.scale?.right, lang)}</span>
          </div>
          {extra && (
            <label className={choiceCls(value === extra.value) + " mt-1"}>
              <input type="radio" name={q.id} checked={value === extra.value} onChange={() => onChange(extra.value)} className="sr-only" />
              {label(extra)}
            </label>
          )}
        </div>
      );
      break;
    }
    case "slider": {
      const r = q.range ?? { min: 0, max: 100, step: 1, left: {}, right: {} };
      const v = value === undefined ? undefined : Number(value);
      body = (
        <div className="flex flex-col gap-2">
          <input type="range" id={`q-${q.id}`} aria-labelledby={titleId} min={r.min} max={r.max} step={r.step} value={v ?? (r.min + r.max) / 2} onChange={(e) => onChange(Number(e.target.value))} className={`h-11 w-full accent-[var(--accent)] ${v === undefined ? "opacity-50" : ""}`} />
          <div className="flex justify-between gap-4 text-sm text-[#5C6066]">
            <span>{tx(r.left, lang)}</span>
            <span className="font-mono font-semibold text-[#16181B]" dir="ltr" aria-live="polite">
              {v ?? "—"}
            </span>
            <span className="text-end">{tx(r.right, lang)}</span>
          </div>
        </div>
      );
      break;
    }
    case "matrix": {
      const a = (value as Record<string, string> | undefined) ?? {};
      const cols = q.options ?? [];
      body = (
        <div className="flex flex-col gap-4">
          {(q.rows ?? []).map((row) => (
            <fieldset key={row.id} className="flex flex-col gap-2">
              <legend className="mb-1 font-medium">{tx(row.label, lang)}</legend>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
                {cols.map((c) => (
                  <label key={c.id} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-[1.5px] px-1 text-center text-sm ${a[row.id] === c.value ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[#E3E0D8]"}`}>
                    <input type="radio" name={`${q.id}-${row.id}`} checked={a[row.id] === c.value} onChange={() => onChange({ ...a, [row.id]: c.value })} className="sr-only" />
                    {tx(c.label, lang)}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      );
      break;
    }
    case "ranking": {
      const order = (value as string[] | undefined) ?? options.map((o) => o.value);
      const byValue = new Map(options.map((o) => [o.value, o]));
      const moveTo = (i: number, d: number) => {
        const a = [...order];
        [a[i], a[i + d]] = [a[i + d], a[i]];
        onChange(a);
      };
      body = (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[#5C6066]">{t("rankHint")}</p>
          <ol className="flex flex-col gap-2">
            {order.map((v, i) => (
              <li key={v} className="flex items-center gap-2 rounded-[14px] border-[1.5px] border-[#E3E0D8] py-1 ps-4 pe-1">
                <span className="w-6 font-mono font-semibold" dir="ltr">
                  {i + 1}
                </span>
                <span className="flex-1">{tx(byValue.get(v)?.label, lang)}</span>
                <button type="button" aria-label={`${t("moveUp")}: ${tx(byValue.get(v)?.label, lang)}`} disabled={i === 0} onClick={() => moveTo(i, -1)} className="h-11 w-11 rounded-xl text-lg disabled:opacity-25">
                  ↑
                </button>
                <button type="button" aria-label={`${t("moveDown")}: ${tx(byValue.get(v)?.label, lang)}`} disabled={i === order.length - 1} onClick={() => moveTo(i, 1)} className="h-11 w-11 rounded-xl text-lg disabled:opacity-25">
                  ↓
                </button>
              </li>
            ))}
          </ol>
        </div>
      );
      break;
    }
    case "numeric":
      body = <input id={`q-${q.id}`} aria-labelledby={titleId} type="number" inputMode="decimal" dir="ltr" min={q.limits?.min} max={q.limits?.max} value={(value as number | undefined) ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} className={textCls} />;
      break;
    case "short":
      body = <input id={`q-${q.id}`} aria-labelledby={titleId} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={textCls} maxLength={500} />;
      break;
    case "long":
      body = <textarea id={`q-${q.id}`} aria-labelledby={titleId} rows={5} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={textCls} maxLength={5000} />;
      break;
    case "date":
      body = <input id={`q-${q.id}`} aria-labelledby={titleId} type="date" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={textCls} />;
      break;
  }

  return (
    <Card>
      <div id={`qw-${q.id}`} tabIndex={-1} className="flex flex-col gap-4 outline-none">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="text-lg font-semibold leading-snug">
            {tx(q.text, lang)}
            {q.required && (
              <span aria-hidden="true" className="ms-1 text-[#B42318]">
                *
              </span>
            )}
          </h2>
          {tx(q.help, lang) && <p className="text-sm text-[#5C6066]">{tx(q.help, lang)}</p>}
        </div>
        {body}
        {error && (
          <p className="text-sm font-medium text-[#B42318]" role="alert">
            {t("required")}
          </p>
        )}
      </div>
    </Card>
  );
}

function OptionImage({ src }: { src?: string }) {
  const { url } = useMediaUrl(src);
  return <div className="mb-2 aspect-square w-full overflow-hidden rounded-xl bg-[#F1EFEA]">{url && <img src={url} alt="" className="h-full w-full object-cover" />}</div>;
}
