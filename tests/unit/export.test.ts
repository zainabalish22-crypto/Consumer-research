import { describe, expect, it } from "vitest";
import { buildColumns, type SessionRecord } from "@/lib/export/columns";
import { BOM, codebookCsv, csvCell, wideCsv } from "@/lib/export/csv";
import { newBlock, newQuestion, startingConfig } from "@/lib/study/factories";
import type { Question, StudyConfig } from "@/lib/study/schema";

function studyWith(questions: Question[]): StudyConfig {
  const cfg = startingConfig("blank");
  const block = newBlock("questionnaire", cfg) as { id: string; questions: Question[] };
  block.id = "b_q";
  block.questions = questions;
  cfg.blocks.splice(2, 0, block as never);
  return cfg;
}

const session = (patch: Partial<SessionRecord>): SessionRecord => ({
  id: "s1",
  version_number: 1,
  status: "completed",
  is_test: false,
  excluded: false,
  exclusion_reason: null,
  language: "ar",
  device_class: "mobile",
  started_at: "2026-10-19T10:00:00.000Z",
  ended_at: "2026-10-19T10:05:30.000Z",
  consent: "given",
  answers: {},
  blockSeconds: {},
  ...patch,
});

function parseCsv(text: string): string[][] {
  // Minimal RFC 4180 parser for tests.
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const s = text.startsWith(BOM) ? text.slice(1) : text;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\r" && s[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
    } else cell += c;
  }
  return rows;
}

describe("wide export", () => {
  const likert = { ...newQuestion("likert", "trust"), attentionCheck: { expected: 4 } } as Question;
  const multi = newQuestion("multiple", "brands");
  const text = newQuestion("text", "comment");
  const rank = newQuestion("ranking", "pref");
  const matrix = newQuestion("matrix", "att");
  const cfg = studyWith([likert, multi, text, rank, matrix]);
  const columns = buildColumns([cfg]);

  it("produces one column per variable with stable names", () => {
    const names = columns.map((c) => c.name);
    for (const n of ["session_id", "study_version", "completed", "is_test", "consent", "trust", "brands_1", "brands_2", "brands_3", "comment", "pref_1", "att_1", "att_2", "trust_attn_pass", "attention_failed", "time_b_q"]) {
      expect(names).toContain(n);
    }
    expect(new Set(names).size).toBe(names.length);
  });

  it("writes values, dummies, ranks, attention flags and keeps Arabic intact", () => {
    const s = session({
      answers: { trust: 2, brands: [1, 3], comment: "القهوة ممتازة، \"جدًا\"", pref: [3, 1, 2], att: { "1": 5, "2": 4 } },
      blockSeconds: { b_q: 42.5 },
    });
    const csv = wideCsv(columns, [s, session({ id: "s2", answers: {}, status: "in_progress", ended_at: null })]);
    expect(csv.startsWith(BOM)).toBe(true);
    const [header, row, row2] = parseCsv(csv);
    const get = (r: string[], name: string) => r[header.indexOf(name)];
    expect(get(row, "trust")).toBe("2");
    expect(get(row, "brands_1")).toBe("1");
    expect(get(row, "brands_2")).toBe("0");
    expect(get(row, "brands_3")).toBe("1");
    expect(get(row, "comment")).toBe("القهوة ممتازة، \"جدًا\"");
    expect(get(row, "pref_3")).toBe("1");
    expect(get(row, "pref_1")).toBe("2");
    expect(get(row, "att_1")).toBe("5");
    expect(get(row, "trust_attn_pass")).toBe("0");
    expect(get(row, "attention_failed")).toBe("1");
    expect(get(row, "duration_sec")).toBe("330");
    expect(get(row, "time_b_q")).toBe("42.5");
    expect(get(row, "language")).toBe("ar");
    // Unanswered questions are empty, not zero.
    expect(get(row2, "brands_1")).toBe("");
    expect(get(row2, "trust_attn_pass")).toBe("");
    expect(get(row2, "completed")).toBe("0");
  });

  it("neutralises spreadsheet formulas in participant text only", () => {
    expect(csvCell("=HYPERLINK(1)", true)).toBe("'=HYPERLINK(1)");
    expect(csvCell(-3, false)).toBe("-3");
  });

  it("codebook lists labels in both languages and value labels", () => {
    const [header, ...rows] = parseCsv(codebookCsv(columns));
    expect(header).toEqual(["variable", "label_en", "label_ar", "type", "measure", "values_en", "values_ar", "source_block", "question_type", "rule"]);
    const trust = rows.find((r) => r[0] === "trust")!;
    expect(trust[5]).toContain("1=Strongly disagree");
    expect(trust[6]).toContain("1=أعارض بشدة");
    expect(trust[7]).toBe("b_q");
  });

  it("merges columns across versions", () => {
    const v2 = studyWith([likert, multi, text, rank, matrix, newQuestion("numeric", "age2")]);
    const merged = buildColumns([v2, cfg]).map((c) => c.name);
    expect(merged).toContain("age2");
    expect(merged.filter((n) => n === "trust")).toHaveLength(1);
  });
});
