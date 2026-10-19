import { describe, expect, it } from "vitest";
import { buildColumns, type SessionRecord } from "@/lib/export/columns";
import { BOM, codebookCsv, csvCell, eventLogCsv, wideCsv } from "@/lib/export/csv";
import { spssSyntax } from "@/lib/export/spss";
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
  last_activity_at: "2026-10-19T10:05:30.000Z",
  screen_reason: null,
  consent: "given",
  condition: null,
  factors: {},
  groups: {},
  params: {},
  completion_code: null,
  answers: {},
  blockSeconds: {},
  media: {},
  env: {},
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

  it("exports design, repeated-block, parameter and media columns", () => {
    const cfg = studyWith([newQuestion("likert", "att")]);
    cfg.design.conditions = [
      { id: "none", label: "No label", weight: 1 },
      { id: "label", label: "Label", weight: 1 },
    ];
    const lv = (v: string) => ({ id: v, value: v, label: { en: `Brand ${v}`, ar: `علامة ${v}` } });
    cfg.design.factors = [
      { id: "fb", variable: "target_brand", name: "", kind: "pick", method: "balanced", balanceWithinCondition: true, levels: [lv("A"), lv("B")], targets: [] },
      { id: "fo", variable: "ad_order", name: "", kind: "order", method: "latin", balanceWithinCondition: true, levels: [lv("A"), lv("B")], targets: [] },
      { id: "fm", variable: "offer", name: "", kind: "mapping", method: "latin", balanceWithinCondition: true, levels: [lv("X"), lv("Y")], targets: [lv("S1"), lv("S2")] },
    ];
    const qb = cfg.blocks.find((b) => b.id === "b_q")!;
    qb.repeat = { factorId: "fo", order: "assigned" };
    const asset = "0f0e0d0c-1111-4222-8333-444455556666";
    const cols = buildColumns([cfg], { paramKeys: ["PROLIFIC_PID"], assets: [{ id: asset, kind: "video", label: "ad.mp4" }] });
    const names = cols.map((c) => c.name);
    for (const n of ["condition", "target_brand", "ad_order", "ad_order_pos_A", "offer_S1", "offer_S2", "att_A", "att_B", "time_b_q_A", "param_PROLIFIC_PID", "media_0f0e0d0c_pct", "media_0f0e0d0c_visible_sec", "completion_code", "abandoned"]) {
      expect(names).toContain(n);
    }
    expect(names).not.toContain("att");

    const s = session({
      condition: "label",
      factors: { target_brand: "B", ad_order: ["B", "A"], offer: { S1: "Y", S2: "X" } },
      params: { PROLIFIC_PID: "abc" },
      answers: { att_A: 2, att_B: 5 },
      blockSeconds: { "b_q#A": 12 },
      media: { [asset]: { visibleMs: 30500, maxPct: 75, plays: 2, completed: false } },
    });
    const [header, row] = parseCsv(wideCsv(cols, [s]));
    const get = (n: string) => row[header.indexOf(n)];
    expect(get("condition")).toBe("label");
    expect(get("ad_order")).toBe("B>A");
    expect(get("ad_order_pos_A")).toBe("2");
    expect(get("offer_S1")).toBe("Y");
    expect(get("att_B")).toBe("5");
    expect(get("time_b_q_A")).toBe("12");
    expect(get("param_PROLIFIC_PID")).toBe("abc");
    expect(get("media_0f0e0d0c_pct")).toBe("75");
    expect(get("media_0f0e0d0c_visible_sec")).toBe("30.5");
    expect(get("media_0f0e0d0c_plays")).toBe("2");
  });

  it("writes SPSS syntax with labels in either language", () => {
    const cols = buildColumns([cfg]);
    const en = spssSyntax(cols, "study_data.csv", "en");
    expect(en).toContain("GET DATA");
    expect(en).toContain("/FILE='study_data.csv'");
    expect(en).toContain("trust F12.2");
    expect(en).toContain("comment A4000");
    expect(en).toContain("1 'Strongly disagree'");
    expect(en).toMatch(/VARIABLE LEVEL [^\n]*trust[^\n]*\(ORDINAL\)/);
    const ar = spssSyntax(cols, "study_data.csv", "ar");
    expect(ar).toContain("1 'أعارض بشدة'");
    // Single quotes inside labels are escaped for SPSS.
    const tricky = buildColumns([studyWith([{ ...newQuestion("numeric", "n1"), text: { en: "Participant's age" } }])]);
    expect(spssSyntax(tricky, "x.csv", "en")).toContain("'Participant''s age'");
  });

  it("writes the event log in long format", () => {
    const csv = eventLogCsv([
      { id: 1, session_id: "s1", type: "video_progress", block_key: "ads#B", client_at: "2026-10-20T10:00:00Z", created_at: "2026-10-20T10:00:01Z", data: { asset: "a1", pct: 50 } },
      { id: 2, session_id: "s1", type: "session_start", block_key: null, client_at: null, created_at: "2026-10-20T09:59:00Z", data: { version: 2 } },
    ]);
    const [header, r1, r2] = parseCsv(csv);
    const get = (r: string[], n: string) => r[header.indexOf(n)];
    expect(get(r1, "block_id")).toBe("ads");
    expect(get(r1, "iteration")).toBe("B");
    expect(get(r1, "progress_pct")).toBe("50");
    expect(get(r1, "asset_id")).toBe("a1");
    expect(get(r2, "other")).toBe('{"version":2}');
  });

  it("merges columns across versions", () => {
    const v2 = studyWith([likert, multi, text, rank, matrix, newQuestion("numeric", "age2")]);
    const merged = buildColumns([v2, cfg]).map((c) => c.name);
    expect(merged).toContain("age2");
    expect(merged.filter((n) => n === "trust")).toHaveLength(1);
  });
});
