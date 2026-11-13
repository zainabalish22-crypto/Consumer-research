import { columnsOf, questionsOf } from "./export";
import type { L10n, Lang, Study } from "./types";

/** SPSS syntax that applies variable and value labels to participants.csv. */
export function spssSyntax(study: Study, lang: Lang) {
  const esc = (s: string) => s.replace(/'/g, "''").replace(/\s+/g, " ").trim();
  const lab = (l: L10n | undefined) => esc(l?.[lang] || l?.en || l?.ar || "");
  const qs = questionsOf(study);
  const lines = [
    `* Tessellum: labels for participants.csv (study version ${study.version}).`,
    "* Open the CSV in SPSS first (File > Import Data > CSV, UTF-8), then run this file.",
    "",
    "VARIABLE LABELS",
    qs.flatMap((q) => columnsOf(q).map((c) => `  ${c} '${lab(q.text)}'`)).join("\n") + ".",
    "",
  ];
  for (const q of qs) {
    let values: [string | number, string][] = [];
    if (q.type === "multiple") values = [[0, "Not selected"], [1, "Selected"]];
    else if (q.type === "ranking") values = [];
    else if (q.scale) values = [[1, lab(q.scale.left)], [q.scale.points, lab(q.scale.right)]];
    else if (q.options) values = q.options.filter((o) => /^-?\d+(\.\d+)?$/.test(o.value)).map((o) => [o.value, lab(o.label)]);
    if (!values.length) continue;
    lines.push(`VALUE LABELS ${columnsOf(q).join(" ")}`, values.map(([v, l]) => `  ${v} '${l}'`).join("\n") + ".", "");
  }
  lines.push("EXECUTE.");
  return lines.join("\n");
}
