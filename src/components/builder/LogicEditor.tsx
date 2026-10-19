"use client";
import { useTranslations } from "next-intl";
import { isQuestionBlock, type Logic, type LogicClause, type StudyConfig } from "@/lib/study/schema";
import { newClause } from "@/lib/study/factories";
import { Button, Select, inputClass } from "@/components/ui";
import { IconButton } from "./controls";

const OPS: LogicClause["op"][] = ["eq", "neq", "in", "notIn", "gt", "gte", "lt", "lte", "includes", "answered", "notAnswered"];

/** Variables that earlier answers can be referenced by. */
function answerKeys(config: StudyConfig, beforeBlockId?: string): string[] {
  const out: string[] = [];
  for (const b of config.blocks) {
    if (b.id === beforeBlockId) break;
    if (!isQuestionBlock(b)) continue;
    const f = b.repeat ? config.design.factors.find((x) => x.id === b.repeat!.factorId) : undefined;
    for (const q of b.questions) {
      if (f) (f.kind === "mapping" ? f.targets : f.levels).forEach((l) => out.push(`${q.variable}_${l.value}`));
      else out.push(q.variable);
    }
  }
  return out;
}

function factorKeys(config: StudyConfig): string[] {
  return config.design.factors.flatMap((f) => (f.kind === "mapping" ? f.targets.map((t) => `${f.variable}.${t.value}`) : [f.variable]));
}

function parseValue(raw: string, multi: boolean): LogicClause["value"] {
  const one = (s: string) => (s.trim() !== "" && Number.isFinite(Number(s)) ? Number(s) : s.trim());
  return multi ? raw.split(",").map(one).filter((x) => x !== "") : one(raw);
}

export function LogicEditor({
  logic,
  onChange,
  config,
  beforeBlockId,
  allowIteration,
  label,
  hint,
}: {
  logic: Logic | undefined;
  onChange: (l: Logic | undefined) => void;
  config: StudyConfig;
  beforeBlockId?: string;
  allowIteration?: boolean;
  label: string;
  hint?: string;
}) {
  const t = useTranslations("builder.logic");
  const sources: LogicClause["source"][] = ["answer", "condition", "factor", "param", ...(allowIteration ? (["iteration"] as const) : [])];
  const answers = answerKeys(config, beforeBlockId);
  const factors = factorKeys(config);
  const setClause = (i: number, c: LogicClause) => onChange({ mode: logic!.mode, clauses: logic!.clauses.map((x, k) => (k === i ? c : x)) });

  if (!logic) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
        <Button variant="secondary" size="sm" className="self-start" onClick={() => onChange({ mode: "all", clauses: [newClause()] })}>
          {t("addRule")}
        </Button>
      </div>
    );
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-line p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <div className="flex items-center gap-2 text-sm">
        <span>{t("when")}</span>
        <Select aria-label={t("mode")} className="w-auto py-1" value={logic.mode} onChange={(e) => onChange({ ...logic, mode: e.target.value as Logic["mode"] })}>
          <option value="all">{t("all")}</option>
          <option value="any">{t("any")}</option>
        </Select>
        <span>{t("ofTheseAreTrue")}</span>
      </div>
      {logic.clauses.map((c, i) => {
        const keyOptions = c.source === "answer" ? answers : c.source === "factor" ? factors : c.source === "condition" ? [] : null;
        const multi = c.op === "in" || c.op === "notIn";
        const needsValue = c.op !== "answered" && c.op !== "notAnswered";
        return (
          <div key={i} className="flex flex-wrap items-center gap-1.5">
            <Select aria-label={t("source")} className="w-auto py-1" value={c.source} onChange={(e) => setClause(i, { ...c, source: e.target.value as LogicClause["source"], key: "" })}>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {t(`sources.${s}`)}
                </option>
              ))}
            </Select>
            {keyOptions && keyOptions.length > 0 && (
              <Select aria-label={t("variable")} className="w-auto py-1 font-mono" dir="ltr" value={c.key} onChange={(e) => setClause(i, { ...c, key: e.target.value })}>
                <option value="">{t("choose")}</option>
                {keyOptions.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Select>
            )}
            {c.source === "param" && (
              <input aria-label={t("param")} className={`${inputClass} w-32 py-1 font-mono`} dir="ltr" value={c.key} placeholder="pid" onChange={(e) => setClause(i, { ...c, key: e.target.value.replace(/[^A-Za-z0-9_]/g, "") })} />
            )}
            <Select aria-label={t("operator")} className="w-auto py-1" value={c.op} onChange={(e) => setClause(i, { ...c, op: e.target.value as LogicClause["op"] })}>
              {OPS.map((o) => (
                <option key={o} value={o}>
                  {t(`ops.${o}`)}
                </option>
              ))}
            </Select>
            {needsValue &&
              (c.source === "condition" ? (
                <Select aria-label={t("value")} className="w-auto py-1" value={String(c.value ?? "")} onChange={(e) => setClause(i, { ...c, value: e.target.value })}>
                  <option value="">{t("choose")}</option>
                  {config.design.conditions.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label || x.id}
                    </option>
                  ))}
                </Select>
              ) : (
                <input
                  aria-label={t("value")}
                  className={`${inputClass} w-36 py-1`}
                  dir="ltr"
                  placeholder={multi ? "1, 2, 3" : "1"}
                  value={Array.isArray(c.value) ? c.value.join(", ") : String(c.value ?? "")}
                  onChange={(e) => setClause(i, { ...c, value: parseValue(e.target.value, multi) })}
                />
              ))}
            <IconButton
              label={t("removeRule")}
              onClick={() => {
                const clauses = logic.clauses.filter((_, k) => k !== i);
                onChange(clauses.length ? { ...logic, clauses } : undefined);
              }}
            >
              ✕
            </IconButton>
          </div>
        );
      })}
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => onChange({ ...logic, clauses: [...logic.clauses, newClause()] })} disabled={logic.clauses.length >= 20}>
          {t("addCondition")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onChange(undefined)}>
          {t("removeAll")}
        </Button>
      </div>
      <p className="text-xs text-muted">{t("valueHint")}</p>
    </fieldset>
  );
}
