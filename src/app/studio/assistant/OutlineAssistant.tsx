"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createStudyFromOutline, draftOutline } from "@/lib/actions/ai";
import type { Outline } from "@/lib/ai/outline";
import { Alert, Badge, Button, Card, Field, Select, Textarea } from "@/components/ui";

export function OutlineAssistant({ projects }: { projects: { id: string; name: string }[] }) {
  const t = useTranslations("assistant");
  const te = useTranslations("errors");
  const [idea, setIdea] = useState("");
  const [outline, setOutline] = useState<Outline | null>(null);
  const [project, setProject] = useState(projects[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const List = ({ title, items }: { title: string; items: string[] }) =>
    items.length ? (
      <section className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <ul className="list-disc ps-5 text-sm" dir="auto">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </section>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      <Alert>{t("note")}</Alert>
      {error && <Alert tone="danger">{error}</Alert>}
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setError(null);
            const r = await draftOutline(idea);
            if (!r.ok) return setError(te(r.error));
            setOutline(r.data);
          });
        }}
      >
        <Field label={t("ideaLabel")} htmlFor="ai-idea">
          <Textarea id="ai-idea" value={idea} onChange={(e) => setIdea(e.target.value)} rows={5} maxLength={4000} placeholder={t("ideaPlaceholder")} dir="auto" />
        </Field>
        <Button type="submit" className="self-start" disabled={pending || idea.trim().length < 10}>
          {pending && !outline ? t("working") : t("draftOutline")}
        </Button>
      </form>

      {outline && (
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold" dir="auto">
              {outline.title}
            </h2>
            <p className="text-sm text-muted" dir="auto">
              {outline.summary}
            </p>
            <Badge>{t(`designs.${outline.design}`)}</Badge>
          </div>
          {outline.conditions.length > 0 && (
            <section className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold">{t("conditions")}</h3>
              <ul className="flex flex-col gap-1 text-sm" dir="auto">
                {outline.conditions.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium">{c.label}</span> <span className="font-mono text-xs text-muted">({c.id})</span> — {c.description}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{t("measures")}</h3>
            {outline.measures.map((m, i) => (
              <div key={i} className="rounded-lg border border-line p-3 text-sm">
                <p className="font-medium" dir="auto">
                  {m.construct}
                </p>
                <p className="text-muted" dir="auto">
                  {m.rationale}
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {m.items.map((it, k) => (
                    <li key={k} className="grid gap-1 sm:grid-cols-2">
                      <span dir="ltr">{it.en}</span>
                      <span dir="rtl" lang="ar">
                        {it.ar}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-warn" dir="auto">
                  {m.scaleNote}
                </p>
              </div>
            ))}
          </section>
          <List title={t("manipulationChecks")} items={outline.manipulationChecks.map((x) => `${x.en} / ${x.ar}`)} />
          <List title={t("confounds")} items={outline.confounds} />
          <List title={t("counterbalancing")} items={outline.counterbalancing ? [outline.counterbalancing] : []} />
          <List title={t("analyses")} items={outline.analyses} />
          <List title={t("caveats")} items={outline.caveats} />

          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <p className="text-sm text-muted">{t("createHint")}</p>
            {projects.length === 0 ? (
              <p className="text-sm text-muted">{t("needProject")}</p>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <Field label={t("project")} htmlFor="ai-project">
                  <Select id="ai-project" value={project} onChange={(e) => setProject(e.target.value)} className="w-auto max-w-xs">
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button
                  disabled={pending || !project}
                  onClick={() =>
                    start(async () => {
                      setError(null);
                      const r = await createStudyFromOutline(project, outline);
                      if (r && !r.ok) setError(te(r.error));
                    })
                  }
                >
                  {t("createStudy")}
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
