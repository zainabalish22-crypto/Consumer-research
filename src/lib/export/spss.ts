/**
 * SPSS syntax (.sps) that reads the wide CSV and applies variable labels,
 * value labels and measurement levels. Works in SPSS Unicode mode, so Arabic
 * labels display correctly.
 */
import type { Column } from "./columns";

const q = (s: string) => `'${s.replace(/'/g, "''").replace(/[\r\n]+/g, " ").slice(0, 250)}'`;

function format(c: Column): string {
  switch (c.type) {
    case "numeric":
      return "F12.2";
    case "date":
      return "A10";
    case "datetime":
      return "A30";
    case "string":
      return c.questionType === "text" ? "A4000" : "A255";
  }
}

export function spssSyntax(columns: Column[], dataFileName: string, lang: "en" | "ar"): string {
  const lines: string[] = [];
  const tooLong = columns.filter((c) => new TextEncoder().encode(c.name).length > 64);
  lines.push("* Encoding: UTF-8.");
  lines.push(`* Generated for ${dataFileName}. Put this file in the same folder as the CSV, or edit the path below.`);
  if (tooLong.length) {
    lines.push(`* WARNING: these variable names are longer than SPSS allows (64 bytes) and must be renamed: ${tooLong.map((c) => c.name).join(", ")}.`);
  }
  lines.push("SET UNICODE=ON.");
  lines.push("GET DATA");
  lines.push("  /TYPE=TXT");
  lines.push(`  /FILE=${q(dataFileName)}`);
  lines.push("  /ENCODING='UTF8'");
  lines.push("  /DELCASE=LINE");
  lines.push('  /DELIMITERS=","');
  lines.push("  /QUALIFIER='\"'");
  lines.push("  /ARRANGEMENT=DELIMITED");
  lines.push("  /FIRSTCASE=2");
  lines.push("  /VARIABLES=");
  for (const c of columns) lines.push(`    ${c.name} ${format(c)}`);
  lines.push(".");
  lines.push("CACHE.");
  lines.push("");

  lines.push("VARIABLE LABELS");
  lines.push(columns.map((c) => `  ${c.name} ${q(c.label[lang] || c.label.en || c.name)}`).join("\n  /") + ".");
  lines.push("");

  const withValues = columns.filter((c) => c.type === "numeric" && c.valueLabels?.length);
  if (withValues.length) {
    lines.push("VALUE LABELS");
    lines.push(
      withValues
        .map((c) => `  ${c.name}\n${c.valueLabels!.map((v) => `    ${v.value} ${q(v[lang] || v.en || String(v.value))}`).join("\n")}`)
        .join("\n  /") + ".",
    );
    lines.push("");
  }

  const numeric = columns.filter((c) => c.type === "numeric");
  for (const level of ["nominal", "ordinal", "scale"] as const) {
    const names = numeric.filter((c) => c.measure === level).map((c) => c.name);
    if (names.length) lines.push(`VARIABLE LEVEL ${names.join(" ")} (${level.toUpperCase()}).`);
  }
  const missing = numeric.filter((c) => c.valueLabels?.some((v) => v.value === -98 || v.value === -99)).map((c) => c.name);
  if (missing.length) {
    lines.push("* -98 = not sure, -99 = prefer not to say. Declared as user-missing; remove this line to analyse them.");
    lines.push(`MISSING VALUES ${missing.join(" ")} (-99, -98).`);
  }
  lines.push("EXECUTE.");
  return "﻿" + lines.join("\r\n") + "\r\n";
}
