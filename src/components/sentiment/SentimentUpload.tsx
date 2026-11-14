"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { fold, guessColumns, readLabel, unreadValues, type Sentiment } from "@/lib/sentiment/normalize";
import { sampleCsv, templateCsv } from "@/lib/sentiment/sample";
import { COLUMN_ROLES, getDataset, setDataset, type ColumnRole, type SentimentDataset } from "@/lib/sentiment/session";
import { decodeBytes, parseCsv, toCsv, type ParsedCsv } from "@/lib/tools/csv";

const MAX_BYTES = 50 * 1024 * 1024;
const SEP = { ",": "comma", ";": "semicolon", "\t": "tab" } as const;
type FileError = { code: "type" | "size" | "empty" | "oneColumn" | "emptyHeader" | "duplicateHeader" | "read"; n?: number; names?: string };

const field = "min-h-11 w-full rounded-md border border-line-2 bg-void px-3 text-[15px] text-photon focus:border-ice focus:outline-none";
const panel = "flex flex-col gap-4 rounded-lg border border-line-2 bg-carbon p-6";
const h2 = "font-display text-xl";

function save(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Upload step of the sentiment tool. The file is read on this device, checked, and its
 * columns matched; nothing is sent anywhere. The researcher's labels are recognised, not
 * produced: values the tool cannot read are listed for the researcher to decide.
 */
export function SentimentUpload() {
  const t = useTranslations("tools.upload");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<SentimentDataset | null>(null);
  const [error, setError] = useState<FileError | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [anonMsg, setAnonMsg] = useState(0);

  // Coming back from a later step keeps the file that is already in memory.
  useEffect(() => setData(getDataset()), []);
  const update = (d: SentimentDataset | null) => {
    setDataset(d);
    setData(d);
  };

  function load(parsed: ParsedCsv, fileName: string, encoding: SentimentDataset["encoding"]) {
    if (parsed.header.length < 2) return setError({ code: "oneColumn" });
    if (parsed.headerProblems.empty) return setError({ code: "emptyHeader", n: parsed.headerProblems.empty });
    if (parsed.headerProblems.duplicates.length) return setError({ code: "duplicateHeader", names: parsed.headerProblems.duplicates.join(", ") });
    if (parsed.rows.length === 0) return setError({ code: "empty" });
    setError(null);
    setAnonMsg(0);
    update({ fileName, encoding, delimiter: parsed.delimiter, header: parsed.header, rows: parsed.rows, badRows: parsed.badRows, emptyRows: parsed.emptyRows, mapping: guessColumns(parsed.header), custom: [], resolved: [], anonymised: 0 });
  }

  async function readFile(file: File) {
    if (!/\.(csv|tsv|txt)$/i.test(file.name)) return setError({ code: "type" });
    if (file.size > MAX_BYTES) return setError({ code: "size" });
    setBusy(true);
    try {
      const { text, encoding } = decodeBytes(new Uint8Array(await file.arrayBuffer()));
      load(parseCsv(text), file.name, encoding);
    } catch {
      setError({ code: "read" });
    } finally {
      setBusy(false);
    }
  }

  const stats = useMemo(() => {
    if (!data?.mapping.label) return null;
    const col = data.header.indexOf(data.mapping.label);
    if (col < 0) return null;
    const custom = new Map(data.custom);
    const values = data.rows.map((r) => r[col]);
    const counts: Record<Sentiment, number> = { positive: 0, negative: 0, neutral: 0 };
    let blank = 0;
    let numeric = 0;
    for (const v of values) {
      if (!v.trim()) blank++;
      else {
        const l = readLabel(v, custom);
        if (l) {
          counts[l.sentiment]++;
          if (l.score !== null) numeric++;
        }
      }
    }
    // Values the tool cannot read by itself, whether or not the researcher has mapped them yet.
    const unread = unreadValues(values);
    return { counts, blank, numeric, read: counts.positive + counts.negative + counts.neutral, unread };
  }, [data]);

  if (!data)
    return (
      <div className="flex flex-col gap-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files[0];
            if (f) readFile(f);
          }}
          className={`flex flex-col items-center gap-4 rounded-lg border border-dashed p-10 text-center ${over ? "border-ice bg-steel" : "border-line-3"}`}
        >
          <p className="font-display text-xl">{busy ? t("reading") : t("drop")}</p>
          <input
            ref={input}
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) readFile(f);
            }}
          />
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="tracked min-h-12 bg-photon px-6 font-semibold uppercase tracking-[0.05em] text-void hover:bg-white disabled:opacity-50">
            {t("choose")}
          </button>
          <p className="text-sm text-faint">{t("formats")}</p>
        </div>
        {error && (
          <p role="alert" className="rounded-md border border-danger px-4 py-3 text-sm text-danger">
            {t(`errors.${error.code}`, { n: error.n ?? 0, names: error.names ?? "" })}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => load(parseCsv(sampleCsv().slice(1)), "sample.csv", "utf-8")} className="min-h-11 rounded-md border border-line-3 px-4 text-sm font-semibold hover:border-photon">
            {t("sample")}
          </button>
          <button type="button" onClick={() => save("sentiment-template.csv", templateCsv())} className="min-h-11 rounded-md px-4 text-sm text-mist hover:text-photon">
            {t("template")}
          </button>
        </div>
      </div>
    );

  const m = data.mapping;
  const setRole = (role: ColumnRole, column: string) => update({ ...data, mapping: { ...m, [role]: column || undefined } });
  const same = !!m.text && m.text === m.label;
  const ready = !!m.text && !!m.label && !same && !!stats && stats.read > 0;
  const custom = new Map(data.custom);

  function anonymise() {
    if (!data || !m.account) return;
    const col = data.header.indexOf(m.account);
    const codes = new Map<string, string>();
    const width = Math.max(3, String(new Set(data.rows.map((r) => r[col])).size).length);
    const rows = data.rows.map((r) => {
      const name = r[col];
      if (!name) return r;
      if (!codes.has(name)) codes.set(name, `A${String(codes.size + 1).padStart(width, "0")}`);
      const copy = [...r];
      copy[col] = codes.get(name)!;
      return copy;
    });
    save("account-key-KEEP-PRIVATE.csv", toCsv([["code", "account"], ...[...codes].map(([name, code]) => [code, name])]));
    update({ ...data, rows, anonymised: codes.size });
    setAnonMsg(codes.size);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* What was read */}
      <section className={panel} aria-labelledby="file-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="file-h" className={h2}>
            <span className="text-faint">{t("file")}:</span> <span dir="ltr">{data.fileName}</span>
          </h2>
          <button type="button" onClick={() => update(null)} className="min-h-11 rounded-md border border-line-3 px-4 text-sm font-semibold hover:border-photon">
            {t("replace")}
          </button>
        </div>
        <ul className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-mist">
          <li>{t("rowsRead", { n: data.rows.length })}</li>
          <li>
            {t("encoding")}: <span dir="ltr">{data.encoding}</span>
          </li>
          <li>
            {t("separator")}: {t(`separators.${SEP[data.delimiter]}`)}
          </li>
          {data.emptyRows > 0 && <li>{t("emptySkipped", { n: data.emptyRows })}</li>}
        </ul>
        {data.badRows.length > 0 && (
          <div role="status" className="flex flex-col gap-1 rounded-md border border-warn/60 p-4 text-sm">
            <strong className="font-semibold text-warn">{t("rowsSkipped", { n: data.badRows.length })}</strong>
            <span className="text-mist">
              {t("skippedLines", { lines: data.badRows.slice(0, 12).join(", ") })}
              {data.badRows.length > 12 && ` ${t("skippedMore", { n: data.badRows.length - 12 })}`}
            </span>
            <span className="text-faint">{t("skippedWhy")}</span>
          </div>
        )}
      </section>

      {/* Columns */}
      <section className={panel} aria-labelledby="cols-h">
        <div className="flex flex-col gap-1">
          <h2 id="cols-h" className={h2}>
            {t("columnsTitle")}
          </h2>
          <p className="text-sm text-dim">{t("columnsHint")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMN_ROLES.map((role) => (
            <label key={role} className="flex flex-col gap-1.5 text-[13px] font-medium text-mist">
              <span>
                {t(`col.${role}`)}
                {(role === "text" || role === "label") && <span className="ms-2 font-mono text-[11px] text-signal">{t("required")}</span>}
              </span>
              <select value={m[role] ?? ""} onChange={(e) => setRole(role, e.target.value)} className={field} dir="auto">
                <option value="">{t("none")}</option>
                {data.header.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {same && (
          <p role="alert" className="text-sm text-danger">
            {t("sameColumn")}
          </p>
        )}
      </section>

      {/* Labels */}
      {stats && !same && (
        <section className={panel} aria-labelledby="labels-h">
          <h2 id="labels-h" className={h2}>
            {t("labelsTitle")}
          </h2>
          <p role="note" className="text-sm text-dim">
            {t("disclaimer")}
          </p>
          {stats.read === 0 ? (
            <p role="alert" className="text-sm text-danger">
              {t("noLabels")}
            </p>
          ) : (
            <ul className="grid gap-px overflow-hidden rounded-md border border-line-2 bg-line-2 sm:grid-cols-3">
              {(["positive", "neutral", "negative"] as const).map((k) => (
                <li key={k} className="flex items-baseline justify-between gap-3 bg-void px-4 py-3">
                  <span className="text-sm text-mist">{t(`sentiment.${k}`)}</span>
                  <span className="font-display text-2xl" dir="ltr">
                    {stats.counts[k]}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ul className="flex flex-col gap-1 text-sm text-mist">
            <li>{t("labelsRead", { n: stats.read })}</li>
            {stats.blank > 0 && <li>{t("labelsBlank", { n: stats.blank })}</li>}
            {stats.numeric > 0 && <li className="text-faint">{t("labelsNumeric")}</li>}
          </ul>
          {stats.unread.length > 0 && (
            <div className="flex flex-col gap-3 rounded-md border border-warn/60 p-4">
              <div className="flex flex-col gap-1">
                <strong className="text-sm font-semibold text-warn">{t("unreadTitle", { n: stats.unread.length })}</strong>
                <span className="text-sm text-faint">{t("unreadHint")}</span>
              </div>
              <ul className="flex flex-col gap-2">
                {stats.unread.slice(0, 40).map(({ value, count }) => (
                  <li key={value} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(140px,200px)] items-center gap-3 text-sm">
                    <span className="truncate font-mono" dir="auto" title={value}>
                      {value}
                    </span>
                    <span className="text-faint">{t("times", { n: count })}</span>
                    <select
                      aria-label={value}
                      value={custom.get(fold(value)) ?? ""}
                      onChange={(e) => {
                        const next = new Map(data.custom);
                        if (e.target.value) next.set(fold(value), e.target.value as Sentiment);
                        else next.delete(fold(value));
                        update({ ...data, custom: [...next] });
                      }}
                      className={field}
                    >
                      <option value="">{t("leaveOut")}</option>
                      {(["positive", "neutral", "negative"] as const).map((k) => (
                        <option key={k} value={k}>
                          {t(`sentiment.${k}`)}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Anonymise */}
      <section className={panel} aria-labelledby="anon-h">
        <div className="flex flex-col gap-1">
          <h2 id="anon-h" className={h2}>
            {t("anonTitle")}
          </h2>
          <p className="max-w-3xl text-sm leading-relaxed text-dim">{t("anonHint")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={anonymise} disabled={!m.account || data.anonymised > 0} className="min-h-11 rounded-md border border-line-3 px-4 text-sm font-semibold hover:border-photon disabled:opacity-40">
            {t("anonButton")}
          </button>
          <span role="status" className="text-sm text-mist">
            {!m.account ? t("anonNeedsColumn") : anonMsg || data.anonymised ? t("anonDone", { n: anonMsg || data.anonymised }) : ""}
          </span>
        </div>
      </section>

      {/* Preview */}
      <section className={panel} aria-labelledby="prev-h">
        <h2 id="prev-h" className={h2}>
          {t("previewTitle")}
        </h2>
        <div className="overflow-x-auto rounded-md border border-line-2">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-steel font-mono text-xs text-mist">
              <tr>
                {data.header.map((h) => (
                  <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 text-start font-normal" dir="auto">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.slice(0, 5).map((r, i) => (
                <tr key={i} className="border-t border-line-2">
                  {r.map((c, j) => (
                    <td key={j} className="max-w-[320px] truncate px-3 py-2" dir="auto" title={c}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" disabled={!ready} onClick={() => router.push("/tools/sentiment/results")} className="tracked min-h-12 bg-photon px-6 font-semibold uppercase tracking-[0.05em] text-void hover:bg-white disabled:opacity-40">
          {t("continue")}
        </button>
        {!ready && <span className="text-sm text-faint">{t("notReady")}</span>}
      </div>
    </div>
  );
}
