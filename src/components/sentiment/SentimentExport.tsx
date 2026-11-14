"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { buildRecords, summarise } from "@/lib/sentiment/aggregate";
import { agreementOf, byRow } from "./SentimentReview";
import { dataCsv, methodNote, summaryCsv, type Strings } from "@/lib/sentiment/exporter";
import { getDataset, type SentimentDataset } from "@/lib/sentiment/session";

const panel = "flex flex-col gap-4 rounded-lg border border-line-2 bg-carbon p-6";
const h2 = "font-display text-xl";

/** Column names and fixed words in the CSV files are English, so they match analysis software. */
const CSV_WORDS = {
  headers: {
    row: "row",
    text: "text",
    final: "final_label",
    first: "coder1_label",
    second: "coder2_label",
    source: "final_source",
    date: "date",
    group: { category: "category", account: "account", language: "language", dialect: "dialect_or_country" },
  },
  source: { first: "coder1", second: "coder2", researcher: "researcher", none: "not_counted" },
  status: { counted: "counted", blank: "no_label", unrecognised: "label_not_recognised" },
  sentiment: { positive: "positive", neutral: "neutral", negative: "negative" },
  summary: { metric: "metric", value: "value", group: "group", n: "texts", mean: "net", positive: "positive", neutral: "neutral", negative: "negative" },
  metrics: { texts: "texts_counted", net: "net_sentiment", alpha: "krippendorff_alpha", percent: "percent_agreement", pairs: "texts_coded_by_both", disagreements: "disagreements", left: "not_counted", test: "chi_square_test", p: "p", v: "cramers_v" },
};

function save(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Final data, summary and a method note: exactly what was counted, with the agreement figures. */
export function SentimentExport() {
  const t = useTranslations("tools.review");
  const [data, setData] = useState<SentimentDataset | null | undefined>(undefined);
  useEffect(() => setData(getDataset()), []);

  if (data === undefined) return null;
  if (!data)
    return (
      <section className={panel}>
        <h2 className={h2}>{t("noData")}</h2>
        <Link href="/tools/sentiment/upload" className="tracked inline-flex min-h-12 items-center self-start bg-photon px-6 font-semibold uppercase tracking-[0.05em] text-void hover:bg-white">
          {t("noDataAction")}
        </Link>
      </section>
    );

  const built = buildRecords(data);
  const numeric = built.numeric;
  const total = summarise(built.records, numeric);
  const ag = agreementOf(data, built.records);
  const leftOut = built.blank + built.unread;
  const slug = data.fileName.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "sentiment";
  const strings: Strings = {
    ...CSV_WORDS,
    note: {
      title: t("noteTitle"),
      generated: t("noteGenerated"),
      file: t("noteFile"),
      method: t.raw("noteMethod") as string[],
      agreement: t("noteAgreement"),
      // The reading of alpha in the note uses the same plain wording as the results page.
      alphaReading: { none: t("alphaReading.none"), poor: t("alphaReading.poor"), fair: t("alphaReading.fair"), good: t("alphaReading.good"), strong: t("alphaReading.strong") },
      cautions: t.raw("noteCautions") as string[],
      none: t("noteNone"),
      labels: t.raw("noteLabels") as Strings["note"]["labels"],
    },
  };
  const when = new Date().toISOString().slice(0, 16).replace("T", " ");
  const dataFile = () => save(`${slug}-final-data.csv`, dataCsv(data, byRow(built.records), strings), "text/csv");
  const summaryFile = () => save(`${slug}-summary.csv`, summaryCsv(data, built.records, numeric, ag, leftOut, strings), "text/csv");
  const noteFile = () => save(`${slug}-method-note.md`, methodNote(data, total, ag, numeric, strings, when), "text/markdown");

  return (
    <section className={panel} aria-labelledby="exp-h">
      <div className="flex flex-col gap-1">
        <h2 id="exp-h" className={h2}>
          {t("exportTitle")}
        </h2>
        <p className="text-sm leading-relaxed text-dim">{t("exportHint")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <button type="button" onClick={dataFile} disabled={built.records.length === 0} className="min-h-12 rounded-md bg-photon px-4 font-semibold text-void hover:bg-white disabled:opacity-40">
          {t("btnData")}
        </button>
        <button type="button" onClick={summaryFile} disabled={built.records.length === 0} className="min-h-12 rounded-md border border-line-3 px-4 font-semibold hover:border-photon disabled:opacity-40">
          {t("btnSummary")}
        </button>
        <button type="button" onClick={noteFile} disabled={built.records.length === 0} className="min-h-12 rounded-md border border-line-3 px-4 font-semibold hover:border-photon disabled:opacity-40">
          {t("btnMethod")}
        </button>
      </div>
      <p className="text-xs leading-relaxed text-faint">{t("exportNote")}</p>
    </section>
  );
}
