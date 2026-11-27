"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Block, Design, L10n, Lang, MediaRef, Question, Variant } from "@/lib/study/types";

const chip = (on: boolean) => `min-h-9 rounded-full border px-3 text-[13px] ${on ? "border-photon bg-photon text-void" : "border-line-3 text-mist hover:border-photon"}`;

/**
 * Per-step settings for an experiment: which levels see this step, and for a page of questions,
 * whether it repeats per level of a within-subjects factor and whether its order is shuffled.
 */
export function StepConditions({ block, design, L, onChange }: { block: Block; design: Design | undefined; L: Lang; onChange: (patch: Partial<Block>) => void }) {
  const t = useTranslations("studio.design");
  const between = (design?.factors ?? []).filter((f) => f.kind === "between" && f.levels.length);
  const within = (design?.factors ?? []).filter((f) => f.kind === "within" && f.levels.length > 1);
  const isPage = block.type === "questions";
  if (!between.length && !within.length && !isPage) return null;

  const levelsFor = (factor: string) => block.showFor?.find((c) => c.factor === factor)?.levels;
  function toggle(factor: string, level: string, all: string[]) {
    const cur = new Set(levelsFor(factor) ?? all);
    if (cur.has(level)) cur.delete(level);
    else cur.add(level);
    const rest = (block.showFor ?? []).filter((c) => c.factor !== factor);
    // Everyone (all levels) is the default, stored as no rule.
    const next = cur.size === all.length || cur.size === 0 ? rest : [...rest, { factor, levels: [...cur] }];
    onChange({ showFor: next.length ? next : undefined });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-dashed border-line-3 p-3">
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">{t("stepTitle")}</span>
      {between.map((f) => {
        const all = f.levels.map((l) => l.id);
        const shown = levelsFor(f.id) ?? all;
        return (
          <div key={f.id} className="flex flex-col gap-1.5">
            <span className="text-[13px] text-dim">{t("showTo", { name: f.name })}</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("showTo", { name: f.name })}>
              {f.levels.map((l) => (
                <button key={l.id} type="button" aria-pressed={shown.includes(l.id)} onClick={() => toggle(f.id, l.id, all)} className={chip(shown.includes(l.id))}>
                  {l.label[L] || l.value}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {isPage && (
        <>
          {within.length > 0 && (
            <label className="flex flex-col gap-1.5 text-[13px] text-dim">
              {t("repeatFor")}
              <select value={block.repeatFor ?? ""} onChange={(e) => onChange({ repeatFor: e.target.value || undefined } as Partial<Block>)} className="min-h-10 rounded-md border border-line-2 bg-void px-3 text-sm text-photon">
                <option value="">{t("repeatNone")}</option>
                {within.map((f) => (
                  <option key={f.id} value={f.id}>
                    {t("repeatEach", { name: f.name, n: f.levels.length })}
                  </option>
                ))}
              </select>
              {block.repeatFor && <span className="text-xs text-faint">{t("repeatHint", { name: within.find((f) => f.id === block.repeatFor)?.name ?? "" })}</span>}
            </label>
          )}
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[13px] text-mist">
            <input type="checkbox" checked={!!block.shuffleQuestions} onChange={(e) => onChange({ shuffleQuestions: e.target.checked || undefined } as Partial<Block>)} className="h-4 w-4 accent-[#FF6A2B]" />
            {t("shuffleQuestions")}
          </label>
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[13px] text-mist">
            <input type="checkbox" checked={!!block.shuffleWith} onChange={(e) => onChange({ shuffleWith: e.target.checked || undefined } as Partial<Block>)} className="h-4 w-4 accent-[#FF6A2B]" />
            {t("shuffleWith")}
          </label>
        </>
      )}
    </div>
  );
}

/**
 * Different wording or media for a question (or text item) in some conditions. Empty fields
 * keep the original.
 */
export function QuestionVariants({ q, design, L, pick, onChange }: { q: Question; design: Design | undefined; L: Lang; pick: (accept: string, then: (ref: MediaRef) => void) => void; onChange: (variants: Variant[] | undefined) => void }) {
  const t = useTranslations("studio.design");
  const [open, setOpen] = useState(!!q.variants?.length);
  const factors = (design?.factors ?? []).filter((f) => f.levels.length);
  if (!factors.length) return null;
  const find = (factor: string, level: string) => q.variants?.find((v) => v.when.factor === factor && v.when.level === level);
  function patch(factor: string, level: string, p: { text?: L10n; media?: MediaRef }) {
    const others = (q.variants ?? []).filter((v) => !(v.when.factor === factor && v.when.level === level));
    const cur = find(factor, level) ?? { when: { factor, level } };
    const next: Variant = { ...cur, ...p };
    const empty = !next.text?.[L] && !next.media;
    const all = empty ? others : [...others, next];
    onChange(all.length ? all : undefined);
  }
  return (
    <div className="mx-6 mb-3 flex flex-col gap-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="self-start text-[13px] font-medium text-ice hover:text-photon">
        {open ? "▾" : "▸"} {t("variants", { n: q.variants?.length ?? 0 })}
      </button>
      {open && (
        <div className="flex flex-col gap-3 rounded-md border border-dashed border-line-3 p-3">
          <p className="text-xs text-faint">{t("variantsHint")}</p>
          {factors.map((f) =>
            f.levels.map((l) => {
              const v = find(f.id, l.id);
              return (
                <div key={`${f.id}-${l.id}`} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-center">
                  <span className="text-[13px] text-mist">
                    {f.name}: {l.label[L] || l.value}
                  </span>
                  <input value={v?.text?.[L] ?? ""} placeholder={q.text[L] || t("sameAsOriginal")} onChange={(e) => patch(f.id, l.id, { text: { ...(v?.text ?? {}), [L]: e.target.value } })} aria-label={t("variantText", { level: l.label[L] || l.value })} className="min-h-10 rounded-md border border-line-2 bg-void px-3 text-sm text-photon focus:border-ice focus:outline-none" />
                  <div className="flex gap-1">
                    <button type="button" onClick={() => pick("image/*,video/mp4,video/webm", (ref) => patch(f.id, l.id, { media: ref }))} className="min-h-10 rounded-md border border-line-3 px-3 text-[13px] hover:border-photon">
                      {v?.media ? t("variantMediaChange") : t("variantMedia")}
                    </button>
                    {v?.media && (
                      <button type="button" onClick={() => patch(f.id, l.id, { media: undefined })} className="min-h-10 px-2 text-[13px] text-mist hover:text-photon">
                        {t("variantMediaRemove")}
                      </button>
                    )}
                  </div>
                </div>
              );
            }),
          )}
        </div>
      )}
    </div>
  );
}
