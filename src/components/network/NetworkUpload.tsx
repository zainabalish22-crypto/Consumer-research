"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { graphFromTable, graphFromXml, type BuildReport, type Graph } from "@/lib/network/graph";
import { guessMapping, PRESET_IDS, type PresetId } from "@/lib/network/presets";
import { sampleEdgesCsv } from "@/lib/network/sample";
import { getNetwork, setNetwork, type NetworkDataset } from "@/lib/network/session";
import { decodeBytes, detectDelimiter, parseCsv, type ParsedCsv } from "@/lib/tools/csv";

const MAX_BYTES = 50 * 1024 * 1024;
type FileError = { code: "type" | "size" | "empty" | "oneColumn" | "emptyHeader" | "duplicateHeader" | "read" | "xml"; n?: number; names?: string };

const field = "min-h-11 w-full rounded-md border border-line-2 bg-void px-3 text-[15px] text-photon focus:border-ice focus:outline-none";
const panel = "flex flex-col gap-4 rounded-lg border border-line-2 bg-carbon p-6";
const h2 = "font-display text-xl";

/**
 * Upload step of the network tool. The file is read on this device and turned into a graph
 * of nodes and ties. Every problem in the file is counted and listed; nothing is repaired
 * silently. Nothing is sent anywhere.
 */
export function NetworkUpload() {
  const t = useTranslations("tools.netUpload");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<NetworkDataset | null>(null);
  const [error, setError] = useState<FileError | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  useEffect(() => setData(getNetwork()), []);
  const update = (d: NetworkDataset | null) => {
    setNetwork(d);
    setData(d);
  };

  function loadTable(parsed: ParsedCsv, fileName: string, encoding: NetworkDataset["encoding"]) {
    if (parsed.header.length < 2) return setError({ code: "oneColumn" });
    if (parsed.headerProblems.empty) return setError({ code: "emptyHeader", n: parsed.headerProblems.empty });
    if (parsed.headerProblems.duplicates.length) return setError({ code: "duplicateHeader", names: parsed.headerProblems.duplicates.join(", ") });
    if (parsed.rows.length === 0) return setError({ code: "empty" });
    setError(null);
    update({
      fileName,
      preset: "edgeList",
      kind: "table",
      encoding,
      delimiter: parsed.delimiter,
      header: parsed.header,
      rows: parsed.rows,
      badRows: parsed.badRows,
      emptyRows: parsed.emptyRows,
      mapping: guessMapping(parsed.header),
      directed: false,
    });
  }

  function loadXml(text: string, fileName: string, format: "gexf" | "graphml") {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) return setError({ code: "xml" });
    const xml = graphFromXml(doc, format);
    if (xml.graph.nodes.length === 0) return setError({ code: "empty" });
    setError(null);
    update({ fileName, preset: "edgeList", kind: "xml", header: [], rows: [], badRows: [], emptyRows: 0, mapping: {}, directed: xml.graph.directed, xml });
  }

  async function readFile(file: File) {
    const name = file.name.toLowerCase();
    const xmlFormat = name.endsWith(".gexf") ? "gexf" : name.endsWith(".graphml") || name.endsWith(".xml") ? "graphml" : null;
    if (!xmlFormat && !/\.(csv|tsv|txt)$/.test(name)) return setError({ code: "type" });
    if (file.size > MAX_BYTES) return setError({ code: "size" });
    setBusy(true);
    try {
      const { text, encoding } = decodeBytes(new Uint8Array(await file.arrayBuffer()));
      if (xmlFormat) loadXml(text, file.name, xmlFormat);
      else loadTable(parseCsv(text, detectDelimiter(text)), file.name, encoding);
    } catch {
      setError({ code: "read" });
    } finally {
      setBusy(false);
    }
  }

  // The graph built from the table, using the researcher's current column choices.
  const built = useMemo(() => {
    if (!data || data.kind !== "table") return null;
    const { source, target } = data.mapping;
    if (!source || !target || source === target) return null;
    return graphFromTable(data.header, data.rows, data.mapping, data.directed);
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
            accept=".csv,.tsv,.txt,.gexf,.graphml,.xml,text/csv"
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
          <button type="button" onClick={() => loadTable(parseCsv(sampleEdgesCsv), "sample-edges.csv", "utf-8")} className="min-h-11 rounded-md border border-line-3 px-4 text-sm font-semibold hover:border-photon">
            {t("sample")}
          </button>
        </div>
      </div>
    );

  const isTable = data.kind === "table";
  const report: BuildReport | null = isTable ? built?.report ?? null : data.xml?.report ?? null;
  const graph: Graph | null = isTable ? built?.graph ?? null : data.xml?.graph ?? null;
  const setMap = (role: "source" | "target" | "weight", column: string) => update({ ...data, mapping: { ...data.mapping, [role]: column || undefined } });
  const same = isTable && !!data.mapping.source && data.mapping.source === data.mapping.target;
  const ready = !!graph && graph.edges.length > 0 && !same;

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
        {isTable && data.encoding && data.delimiter && (
          <ul className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-mist">
            <li>{t("rowsRead", { n: data.rows.length })}</li>
            <li>
              {t("encoding")}: <span dir="ltr">{data.encoding}</span>
            </li>
            <li>
              {t("separator")}: {t(`separators.${data.delimiter === "\t" ? "tab" : data.delimiter === ";" ? "semicolon" : "comma"}`)}
            </li>
          </ul>
        )}
        {isTable && data.badRows.length > 0 && (
          <div role="status" className="flex flex-col gap-1 rounded-md border border-warn/60 p-4 text-sm">
            <strong className="font-semibold text-warn">{t("rowsSkipped", { n: data.badRows.length })}</strong>
            <span className="text-mist">{t("skippedLines", { lines: data.badRows.slice(0, 12).join(", ") })}</span>
            <span className="text-faint">{t("skippedWhy")}</span>
          </div>
        )}
      </section>

      {isTable && (
        <>
          {/* Preset */}
          <section className={panel} aria-labelledby="preset-h">
            <div className="flex flex-col gap-1">
              <h2 id="preset-h" className={h2}>
                {t("presetTitle")}
              </h2>
              <p className="text-sm text-dim">{t("presetHint")}</p>
            </div>
            <label className="flex max-w-md flex-col gap-1.5 text-[13px] font-medium text-mist">
              <span>{t("presetLabel")}</span>
              <select value={data.preset} onChange={(e) => update({ ...data, preset: e.target.value as PresetId })} className={field}>
                {PRESET_IDS.map((p) => (
                  <option key={p} value={p}>
                    {t(`presets.${p}`)}
                  </option>
                ))}
              </select>
            </label>
            {data.preset === "exportTool" && <p className="text-sm leading-relaxed text-warn">{t("exportToolNote")}</p>}
          </section>

          {/* Columns and direction */}
          <section className={panel} aria-labelledby="cols-h">
            <div className="flex flex-col gap-1">
              <h2 id="cols-h" className={h2}>
                {t("columnsTitle")}
              </h2>
              <p className="text-sm text-dim">{t("columnsHint")}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {(["source", "target", "weight"] as const).map((role) => (
                <label key={role} className="flex flex-col gap-1.5 text-[13px] font-medium text-mist">
                  <span>
                    {t(`col.${role}`)}
                    {role !== "weight" && <span className="ms-2 font-mono text-[11px] text-signal">{t("required")}</span>}
                  </span>
                  <select value={data.mapping[role] ?? ""} onChange={(e) => setMap(role, e.target.value)} className={field} dir="auto">
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
            <fieldset className="flex flex-col gap-2">
              <legend className="text-[13px] font-medium text-mist">{t("directionTitle")}</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="dir" checked={!data.directed} onChange={() => update({ ...data, directed: false })} />
                {t("undirected")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="dir" checked={data.directed} onChange={() => update({ ...data, directed: true })} />
                {t("directed")}
              </label>
            </fieldset>
          </section>
        </>
      )}

      {/* Checks */}
      {report && graph && (
        <section className={panel} aria-labelledby="checks-h">
          <h2 id="checks-h" className={h2}>
            {t("checksTitle")}
          </h2>
          <ul className="grid gap-px overflow-hidden rounded-md border border-line-2 bg-line-2 sm:grid-cols-2">
            <li className="flex items-baseline justify-between gap-3 bg-void px-4 py-3">
              <span className="text-sm text-mist">{t("nodes")}</span>
              <span className="font-display text-2xl" dir="ltr">
                {graph.nodes.length}
              </span>
            </li>
            <li className="flex items-baseline justify-between gap-3 bg-void px-4 py-3">
              <span className="text-sm text-mist">{t("ties")}</span>
              <span className="font-display text-2xl" dir="ltr">
                {graph.edges.length}
              </span>
            </li>
          </ul>
          <ul className="flex flex-col gap-1 text-sm text-mist">
            {report.blankEnds > 0 && <li>{t("checkBlank", { n: report.blankEnds })}</li>}
            {report.selfLoops > 0 && <li>{t("checkSelf", { n: report.selfLoops })}</li>}
            {report.merged > 0 && <li>{t("checkMerged", { n: report.merged })}</li>}
            {report.hasWeight && report.badWeights > 0 && <li className="text-warn">{t("checkBadWeights", { n: report.badWeights })}</li>}
            {!report.hasWeight && <li className="text-faint">{t("checkNoWeight")}</li>}
          </ul>
        </section>
      )}

      {/* Preview */}
      {graph && graph.edges.length > 0 && (
        <section className={panel} aria-labelledby="prev-h">
          <h2 id="prev-h" className={h2}>
            {t("previewTitle")}
          </h2>
          <div className="overflow-x-auto rounded-md border border-line-2">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-steel font-mono text-xs text-mist">
                <tr>
                  <th scope="col" className="px-3 py-2 text-start font-normal">{t("col.source")}</th>
                  <th scope="col" className="px-3 py-2 text-start font-normal">{t("col.target")}</th>
                  <th scope="col" className="px-3 py-2 text-start font-normal">{t("col.weight")}</th>
                </tr>
              </thead>
              <tbody>
                {graph.edges.slice(0, 5).map((e, i) => (
                  <tr key={i} className="border-t border-line-2">
                    <td className="px-3 py-2" dir="auto">{e.source}</td>
                    <td className="px-3 py-2" dir="auto">{e.target}</td>
                    <td className="px-3 py-2" dir="ltr">{e.weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" disabled={!ready} onClick={() => router.push("/tools/network/results")} className="tracked min-h-12 bg-photon px-6 font-semibold uppercase tracking-[0.05em] text-void hover:bg-white disabled:opacity-40">
          {t("continue")}
        </button>
        {!ready && <span className="text-sm text-faint">{t("notReady")}</span>}
      </div>
    </div>
  );
}
