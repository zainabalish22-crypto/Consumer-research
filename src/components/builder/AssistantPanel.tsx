"use client";
/**
 * Builder tab for the optional AI assistant. Suggestions are shown side by
 * side with the current text; nothing changes until the researcher applies
 * a suggestion, and changes only ever go into the draft.
 */
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { critiqueQuestions, suggestAnalyses, translateMissing, type Analysis, type Critique } from "@/lib/actions/ai";
import { isQuestionBlock, type Language, type LocalizedText, type StudyConfig } from "@/lib/study/schema";
import { lt } from "@/lib/study/text";
import { Alert, Badge, Button, Card, Select } from "@/components/ui";

type Field = { key: string; from: Language; to: Language; text: string };

/** Every text field in the study with exactly one of its two languages written. */
export function missingTranslations(config: StudyConfig): Field[] {
  if (config.settings.languages.length < 2) return [];
  const out: Field[] = [];
  const visit = (v: unknown, path: string) => {
    if (Array.isArray(v)) return v.forEach((x, i) => visit(x, `${path}.${i}`));
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length && keys.every((k) => k === "en" || k === "ar") && keys.some((k) => typeof o[k] === "string")) {
      const en = typeof o.en === "string" ? o.en.trim() : "";
      const ar = typeof o.ar === "string" ? o.ar.trim() : "";
      if (en && !ar) out.push({ key: path, from: "en", to: "ar", text: o.en as string });
      else if (ar && !en) out.push({ key: path, from: "ar", to: "en", text: o.ar as string });
      return;
    }
    for (const k of keys) if (k !== "library") visit(o[k], path ? `${path}.${k}` : k);
  };
  visit(config.blocks, "blocks");
  return out;
}

function setAtPath(config: StudyConfig, path: string, lang: Language, text: string): StudyConfig {
  const next = structuredClone(config);
  const parts = path.split(".");
  let cur: unknown = next;
  for (const p of parts) cur = (cur as Record<string, unknown>)[p];
  if (cur && typeof cur === "object") (cur as Record<string, string>)[lang] = text;
  return next;
}

export function AssistantPanel({
  studyId,
  config,
  onChange,
  enabled,
  ensureSaved,
}: {
  studyId: string;
  config: StudyConfig;
  onChange: (c: StudyConfig) => void;
  enabled: boolean;
  ensureSaved: () => Promise<boolean>;
}) {
  const t = useTranslations("assistant");
  const te = useTranslations("errors");
  const locale = useLocale() as Language;
  const L = (x: LocalizedText | undefined) => lt(x, locale, locale === "ar" ? "en" : "ar");
  const pages = config.blocks.filter(isQuestionBlock);
  const [blockId, setBlockId] = useState(pages[0]?.id ?? "");
  const [critique, setCritique] = useState<Critique | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [translations, setTranslations] = useState<{ field: Field; text: string }[] | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const missing = missingTranslations(config);

  if (!enabled) {
    return (
      <Card className="flex max-w-2xl flex-col gap-2">
        <h2 className="font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted">{t("disabled")}</p>
      </Card>
    );
  }

  const run = <T,>(fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, done: (d: T) => void) =>
    start(async () => {
      setError(null);
      if (!(await ensureSaved())) return setError(te("saveFailed"));
      const r = await fn();
      if (!r.ok) return setError(te(r.error));
      done(r.data);
    });

  const block = pages.find((b) => b.id === blockId);

  return (
    <div className="flex flex-col gap-4">
      <Alert>{t("note")}</Alert>
      {error && <Alert tone="danger">{error}</Alert>}

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("critiqueTitle")}</h2>
        <p className="text-sm text-muted">{t("critiqueHint")}</p>
        {pages.length === 0 ? (
          <p className="text-sm text-muted">{t("noQuestionPages")}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Select aria-label={t("page")} value={blockId} onChange={(e) => (setBlockId(e.target.value), setCritique(null))} className="w-auto max-w-xs">
              {pages.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || L(b.heading) || b.id}
                </option>
              ))}
            </Select>
            <Button size="sm" disabled={pending || !block} onClick={() => run(() => critiqueQuestions(studyId, blockId), (d) => (setCritique(d), setApplied(new Set())))}>
              {pending ? t("working") : t("critique")}
            </Button>
          </div>
        )}
        {critique && block && (
          <div className="flex flex-col gap-3">
            {critique.questions.map((c) => {
              const q = block.questions.find((x) => x.variable === c.variable);
              if (!q) return null;
              const done = applied.has(c.variable);
              return (
                <div key={c.variable} className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
                  <p className="font-mono text-xs text-muted" dir="ltr">
                    {c.variable}
                  </p>
                  <p dir="auto">{L(q.text)}</p>
                  {c.issues.length === 0 ? (
                    <p className="text-accent">{t("noIssues")}</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {c.issues.map((i, k) => (
                        <li key={k} className="flex gap-2">
                          <Badge tone="warn">{t(`issues.${i.type}`)}</Badge>
                          <span dir="auto">{i.explanation}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {c.rewrite && (
                    <div className="flex flex-col gap-1 rounded-md bg-paper p-2">
                      <p className="text-xs font-medium text-muted">{t("suggested")}</p>
                      <p dir="ltr">{c.rewrite.en}</p>
                      <p dir="rtl" lang="ar">
                        {c.rewrite.ar}
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="self-start"
                        disabled={done}
                        onClick={() => {
                          const langs = config.settings.languages;
                          const nextText = { ...q.text, ...(langs.includes("en") ? { en: c.rewrite!.en } : {}), ...(langs.includes("ar") ? { ar: c.rewrite!.ar } : {}) };
                          onChange({
                            ...config,
                            blocks: config.blocks.map((b) => (b.id === block.id && isQuestionBlock(b) ? { ...b, questions: b.questions.map((x) => (x.id === q.id ? { ...x, text: nextText } : x)) } : b)),
                          });
                          setApplied(new Set([...applied, c.variable]));
                        }}
                      >
                        {done ? t("applied") : t("apply")}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {critique.general.length > 0 && (
              <ul className="list-disc ps-5 text-sm text-muted">
                {critique.general.map((g, i) => (
                  <li key={i} dir="auto">
                    {g}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("translateTitle")}</h2>
        <p className="text-sm text-muted">{config.settings.languages.length < 2 ? t("oneLanguage") : t("translateHint", { n: missing.length })}</p>
        {missing.length > 0 && (
          <Button size="sm" className="self-start" disabled={pending} onClick={() => run(() => translateMissing(studyId, missing.slice(0, 200)), (d) => setTranslations(d.items.flatMap((i) => { const f = missing.find((m) => m.key === i.key); return f ? [{ field: f, text: i.text }] : []; })))}>
            {pending ? t("working") : t("translate")}
          </Button>
        )}
        {translations && translations.length > 0 && (
          <div className="flex flex-col gap-2">
            <ul className="flex flex-col divide-y divide-line rounded-lg border border-line text-sm">
              {translations.map(({ field, text }) => (
                <li key={field.key} className="grid gap-1 p-2 sm:grid-cols-2">
                  <span dir={field.from === "ar" ? "rtl" : "ltr"} className="text-muted">
                    {field.text}
                  </span>
                  <span dir={field.to === "ar" ? "rtl" : "ltr"}>{text}</span>
                </li>
              ))}
            </ul>
            <Button
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() => {
                let next = config;
                for (const { field, text } of translations) next = setAtPath(next, field.key, field.to, text);
                onChange(next);
                setTranslations(null);
              }}
            >
              {t("applyAll", { n: translations.length })}
            </Button>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("analysisTitle")}</h2>
        <p className="text-sm text-muted">{t("analysisHint")}</p>
        <Button size="sm" className="self-start" disabled={pending} onClick={() => run(() => suggestAnalyses(studyId), setAnalysis)}>
          {pending ? t("working") : t("suggest")}
        </Button>
        {analysis && (
          <div className="flex flex-col gap-3 text-sm" dir="auto">
            {analysis.analyses.map((a, i) => (
              <div key={i} className="rounded-lg border border-line p-3">
                <p className="font-medium">{a.question}</p>
                <p>
                  <span className="text-muted">{t("method")}: </span>
                  {a.method}
                </p>
                {a.variables.length > 0 && (
                  <p className="font-mono text-xs" dir="ltr">
                    {a.variables.join(", ")}
                  </p>
                )}
                <p className="text-muted">{a.assumptions}</p>
                {a.notes && <p className="text-muted">{a.notes}</p>}
              </div>
            ))}
            {[...analysis.codebookNotes, ...analysis.caveats].length > 0 && (
              <ul className="list-disc ps-5 text-muted">
                {[...analysis.codebookNotes, ...analysis.caveats].map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
