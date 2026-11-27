"use client";

import { useTranslations } from "next-intl";
import { cells } from "@/lib/study/engine";
import type { Design, Factor, Lang, Level, Quota, Study } from "@/lib/study/types";
import { uid } from "@/lib/study/util";
import { Button, IconButton, Icon, inputCls, NumberInput, Select, TextInput } from "./ui";

type Update = (fn: (s: Study) => Study) => void;

/** A variable-safe name: letters, digits and underscores, starting with a letter. */
const safe = (v: string, fallback: string) => {
  const s = v
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
  return /^[a-z]/.test(s) ? s : s ? `${fallback}_${s}` : fallback;
};

/**
 * The experiment: factors with their levels (between or within subjects) and quotas on
 * screening answers. Steps, wording, media and shop prices are then varied per level from the
 * Questions and Shop tabs.
 */
export function DesignPanel({ study, update }: { study: Study; update: Update }) {
  const t = useTranslations("studio.design");
  const L: Lang = study.languages[0] ?? "en";
  const design: Design = study.design ?? { factors: [], quotas: [] };
  const set = (fn: (d: Design) => Design) => update((s) => ({ ...s, design: fn(s.design ?? { factors: [], quotas: [] }) }));
  const setFactor = (id: string, fn: (f: Factor) => Factor) => set((d) => ({ ...d, factors: d.factors.map((f) => (f.id === id ? fn(f) : f)) }));
  const groups = cells(design).length;
  const within = design.factors.filter((f) => f.kind === "within" && f.levels.length > 1);

  // Screening-type questions a quota can use: single choice and dropdown.
  const choices = study.blocks.flatMap((b) => (b.type === "questions" ? b.questions.filter((q) => (q.type === "single" || q.type === "dropdown") && q.options?.length) : []));

  function addFactor() {
    const n = design.factors.length + 1;
    const lv = (k: number): Level => ({ id: uid("l"), value: `level${k}`, label: { [L]: t("levelN", { n: k }) } });
    set((d) => ({ ...d, factors: [...d.factors, { id: uid("f"), name: `factor${n}`, kind: "between", levels: [lv(1), lv(2)] }] }));
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-2xl font-light">{t("title")}</h2>
        <p className="text-sm leading-relaxed text-dim">{t("intro")}</p>
      </div>

      {design.factors.map((f) => (
        <section key={f.id} className="flex flex-col gap-4 rounded-lg border border-line-2 bg-carbon p-5" aria-label={f.name}>
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <TextInput label={t("factorName")} value={f.name} dir="ltr" hint={t("factorNameHint", { name: f.name })} onChange={(v) => setFactor(f.id, (x) => ({ ...x, name: safe(v, "factor") }))} />
            <Select
              label={t("kind")}
              value={f.kind}
              onChange={(v) => setFactor(f.id, (x) => ({ ...x, kind: v }))}
              options={[
                ["between", t("between")],
                ["within", t("within")],
              ]}
            />
            <Button kind="danger" onClick={() => window.confirm(t("confirmRemoveFactor", { name: f.name })) && set((d) => ({ ...d, factors: d.factors.filter((x) => x.id !== f.id) }))}>
              {t("removeFactor")}
            </Button>
          </div>
          <p className="text-xs text-faint">{f.kind === "between" ? t("betweenHint") : t("withinHint")}</p>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-mist">{t("levels")}</span>
            {f.levels.map((l, i) => (
              <div key={l.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                <input
                  aria-label={t("levelLabel", { n: i + 1 })}
                  value={l.label[L] ?? ""}
                  placeholder={t("levelLabel", { n: i + 1 })}
                  onChange={(e) => setFactor(f.id, (x) => ({ ...x, levels: x.levels.map((y) => (y.id === l.id ? { ...y, label: { ...y.label, [L]: e.target.value } } : y)) }))}
                  className={inputCls}
                />
                <input
                  aria-label={t("levelValue", { n: i + 1 })}
                  value={l.value}
                  dir="ltr"
                  placeholder={t("levelValue", { n: i + 1 })}
                  onChange={(e) => setFactor(f.id, (x) => ({ ...x, levels: x.levels.map((y) => (y.id === l.id ? { ...y, value: safe(e.target.value, "level") } : y)) }))}
                  className={`${inputCls} font-mono`}
                />
                <IconButton label={t("removeLevel")} disabled={f.levels.length <= 2} onClick={() => setFactor(f.id, (x) => ({ ...x, levels: x.levels.filter((y) => y.id !== l.id) }))}>
                  {Icon.x}
                </IconButton>
              </div>
            ))}
            <p className="text-xs text-faint">{t("levelHint")}</p>
            <div>
              <Button onClick={() => setFactor(f.id, (x) => ({ ...x, levels: [...x.levels, { id: uid("l"), value: `level${x.levels.length + 1}`, label: { [L]: t("levelN", { n: x.levels.length + 1 }) } }] }))}>
                {Icon.plus} {t("addLevel")}
              </Button>
            </div>
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-4">
        <Button kind="primary" onClick={addFactor}>
          {Icon.plus} {t("addFactor")}
        </Button>
        {design.factors.length > 0 && (
          <p className="text-sm text-mist" aria-live="polite">
            {t("summary", { groups, within: within.length })}
          </p>
        )}
      </div>

      {design.factors.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border border-line-2 p-5">
          <h3 className="font-display text-lg">{t("howTitle")}</h3>
          <ul className="flex list-disc flex-col gap-1.5 ps-5 text-sm leading-relaxed text-dim">
            <li>{t("how1")}</li>
            <li>{t("how2")}</li>
            <li>{t("how3")}</li>
            <li>{t("how4")}</li>
            <li>{t("how5")}</li>
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-4" aria-labelledby="quotas-h">
        <div className="flex flex-col gap-1">
          <h3 id="quotas-h" className="font-display text-lg">
            {t("quotas")}
          </h3>
          <p className="text-sm leading-relaxed text-dim">{t("quotasHint")}</p>
        </div>
        {choices.length === 0 ? (
          <p className="text-sm text-faint">{t("noScreening")}</p>
        ) : (
          <>
            {design.quotas.map((q) => {
              const question = choices.find((x) => x.variable === q.variable) ?? choices[0];
              const patch = (p: Partial<Quota>) => set((d) => ({ ...d, quotas: d.quotas.map((x) => (x.id === q.id ? { ...x, ...p } : x)) }));
              return (
                <div key={q.id} className="grid gap-3 rounded-lg border border-line-2 bg-carbon p-4 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end">
                  <Select label={t("quotaQuestion")} value={question.variable} onChange={(v) => patch({ variable: v, value: choices.find((x) => x.variable === v)?.options?.[0]?.value ?? "" })} options={choices.map((c) => [c.variable, `${c.variable} · ${(c.text[L] ?? "").slice(0, 40)}`])} />
                  <Select label={t("quotaAnswer")} value={q.value} onChange={(v) => patch({ value: v })} options={(question.options ?? []).map((o) => [o.value, o.label[L] || o.value])} />
                  <NumberInput label={t("quotaTarget")} value={q.target} step="1" onChange={(v) => patch({ target: Math.max(1, Math.round(v ?? 1)) })} />
                  <Button kind="danger" onClick={() => set((d) => ({ ...d, quotas: d.quotas.filter((x) => x.id !== q.id) }))}>
                    {t("removeQuota")}
                  </Button>
                </div>
              );
            })}
            <div>
              <Button onClick={() => set((d) => ({ ...d, quotas: [...d.quotas, { id: uid("qt"), variable: choices[0].variable, value: choices[0].options?.[0]?.value ?? "", target: 50 }] }))}>
                {Icon.plus} {t("addQuota")}
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
