"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { DatasetInput, Rec } from "@/lib/sentiment/aggregate";
import { agreement, readAlpha, type Agreement } from "@/lib/sentiment/agreement";
import type { Sentiment } from "@/lib/sentiment/normalize";
import { setDataset, type SentimentDataset } from "@/lib/sentiment/session";

const panel = "flex flex-col gap-4 rounded-lg border border-line-2 bg-carbon p-6";
const h2 = "font-display text-xl";
const PAGE = 50;

/** Agreement figures, from the two label columns, computed on the labels as read. */
export function agreementOf(d: DatasetInput, records: Rec[]): Agreement | null {
  if (!d.mapping.label2) return null;
  return agreement(records.map((r) => ({ index: r.row, a: r.primary, b: r.label2 })));
}

export function AgreementPanel({ ag }: { ag: Agreement }) {
  const t = useTranslations("tools.review");
  const reading = readAlpha(ag.alpha);
  return (
    <section className={panel} aria-labelledby="agree-h">
      <h2 id="agree-h" className={h2}>
        {t("agreementTitle")}
      </h2>
      <p className="text-sm leading-relaxed text-dim">{t("agreementHint")}</p>
      <ul className="grid gap-px overflow-hidden rounded-md border border-line-2 bg-line-2 sm:grid-cols-3">
        <li className="flex flex-col gap-1 bg-void px-4 py-3">
          <span className="text-xs text-faint">{t("agreementPairs")}</span>
          <span className="font-display text-2xl" dir="ltr">
            {ag.pairs}
          </span>
        </li>
        <li className="flex flex-col gap-1 bg-void px-4 py-3">
          <span className="text-xs text-faint">{t("agreementPercent")}</span>
          <span className="font-display text-2xl" dir="ltr">
            {ag.percent.toFixed(1)}%
          </span>
        </li>
        <li className="flex flex-col gap-1 bg-void px-4 py-3">
          <span className="text-xs text-faint">Krippendorff α</span>
          <span className="font-display text-2xl" dir="ltr">
            {ag.alpha === null ? "—" : ag.alpha.toFixed(3)}
          </span>
          <span className="text-xs text-mist">{t(`alphaReading.${reading}`)}</span>
        </li>
      </ul>
      {ag.alpha === null && <p className="text-sm text-warn">{t("agreementNone")}</p>}
    </section>
  );
}

/** The texts the two coders disagreed on, each with a choice of final label. */
export function DisagreementList({ data, records, onChange }: { data: SentimentDataset; records: Rec[]; onChange: (next: SentimentDataset) => void }) {
  const t = useTranslations("tools.review");
  const u = useTranslations("tools.upload");
  const [shown, setShown] = useState(PAGE);
  const resolved = useMemo(() => new Map(data.resolved), [data.resolved]);
  const disputed = useMemo(() => records.filter((r) => r.label2 !== null && r.label2 !== r.primary), [records]);
  if (disputed.length === 0) return null;
  const pick = (row: number, value: string) => {
    const next = new Map(data.resolved);
    if (value) next.set(row, value as Sentiment);
    else next.delete(row);
    const updated = { ...data, resolved: [...next] };
    setDataset(updated);
    onChange(updated);
  };
  const decided = disputed.filter((r) => resolved.has(r.row)).length;
  return (
    <section className={panel} aria-labelledby="dis-h">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="dis-h" className={h2}>
          {t("disagreeTitle")}
        </h2>
        <span className="font-mono text-xs text-faint">
          {decided} / {disputed.length}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-dim">{t("disagreeHint")}</p>
      <p className="text-sm text-mist">{t("disagreeCount", { n: disputed.length })}</p>
      <ul className="flex flex-col gap-3">
        {disputed.slice(0, shown).map((r) => (
          <li key={r.row} className="grid gap-3 rounded-md border border-line-2 bg-void p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex min-w-0 flex-col gap-2">
              <span className="font-mono text-xs text-faint" dir="ltr">
                #{r.row + 1}
              </span>
              <p className="text-[15px] leading-relaxed" dir="auto">
                {r.text}
              </p>
              <span className="text-xs text-mist">
                {u("col.label")}: <strong className="font-semibold text-photon">{u(`sentiment.${r.primary}`)}</strong> · {u("col.label2")}:{" "}
                <strong className="font-semibold text-photon">{u(`sentiment.${r.label2}`)}</strong>
              </span>
            </div>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-mist lg:w-56">
              {t("pickFinal", { n: r.row + 1 })}
              <select
                value={resolved.get(r.row) ?? ""}
                onChange={(e) => pick(r.row, e.target.value)}
                className="min-h-11 rounded-md border border-line-2 bg-carbon px-3 text-[15px] text-photon focus:border-ice focus:outline-none"
              >
                <option value="">{t("undecided")}</option>
                {(["positive", "neutral", "negative"] as const).map((k) => (
                  <option key={k} value={k}>
                    {u(`sentiment.${k}`)}
                  </option>
                ))}
              </select>
            </label>
          </li>
        ))}
      </ul>
      {disputed.length > shown && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-faint">{t("moreRows", { shown, total: disputed.length })}</p>
          <button type="button" onClick={() => setShown((n) => n + PAGE)} className="min-h-11 self-start rounded-md border border-line-3 px-4 text-sm font-semibold hover:border-photon">
            {t("showMore")}
          </button>
        </div>
      )}
    </section>
  );
}

/** Records keyed by their row, for the export. */
export function byRow(records: Rec[]): Map<number, Rec> {
  return new Map(records.map((r) => [r.row, r]));
}

