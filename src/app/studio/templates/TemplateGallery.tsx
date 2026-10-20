"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { createFromTemplate } from "@/lib/actions/studio";
import { createFromSavedTemplate, deleteTemplate, duplicateTemplate, updateTemplate } from "@/lib/actions/templates";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Select, Textarea } from "@/components/ui";

export interface SavedTemplate {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  blocks: number;
  conditions: number;
  factors: number;
  tools: string[];
  languages: string[];
}

const BUILT_IN = [
  { kind: "foodcourt", tools: ["village", "questionnaire"] },
  { kind: "deepfake", tools: ["ad_exposure", "village", "questionnaire"] },
] as const;

export function TemplateGallery({ saved, projects, initialProject }: { saved: SavedTemplate[]; projects: { id: string; name: string }[]; initialProject?: string }) {
  const t = useTranslations("templates");
  const tp = useTranslations("studio.projects.templates");
  const tb = useTranslations("builder.blockTypes");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [project, setProject] = useState(projects.some((p) => p.id === initialProject) ? initialProject! : (projects[0]?.id ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string } | void>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r && !r.ok) setError(te(r.error ?? "saveFailed"));
    });

  const Tools = ({ tools }: { tools: readonly string[] }) => (
    <div className="flex flex-wrap gap-1">
      {tools.map((x) => (
        <Badge key={x}>{tb(x)}</Badge>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {projects.length === 0 ? (
        <Alert>
          {t("needProject")}{" "}
          <Link href="/studio" className="underline">
            {t("toDashboard")}
          </Link>
        </Alert>
      ) : (
        <Field label={t("createIn")} htmlFor="tpl-project">
          <Select id="tpl-project" value={project} onChange={(e) => setProject(e.target.value)} className="max-w-md">
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {error && <Alert tone="danger">{error}</Alert>}

      <section className="flex flex-col gap-3" aria-labelledby="tpl-builtin">
        <h2 id="tpl-builtin" className="text-lg font-semibold">
          {t("builtIn")}
        </h2>
        <p className="-mt-2 text-sm text-muted">{tp("hint")}</p>
        <ul className="grid gap-3 md:grid-cols-2">
          {BUILT_IN.map((b) => (
            <li key={b.kind}>
              <Card className="flex h-full flex-col gap-2">
                <h3 className="font-semibold">{tp(`${b.kind}.title`)}</h3>
                <p className="text-sm text-muted">{tp(`${b.kind}.body`)}</p>
                <Tools tools={b.tools} />
                <Button size="sm" className="mt-auto self-start" disabled={pending || !project} onClick={() => run(() => createFromTemplate(project, b.kind))}>
                  {t("use")}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="tpl-saved">
        <h2 id="tpl-saved" className="text-lg font-semibold">
          {t("saved")}
        </h2>
        {saved.length === 0 ? (
          <EmptyState title={t("noSaved")}>{t("noSavedHint")}</EmptyState>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {saved.map((s) => (
              <li key={s.id}>
                <Card className="flex h-full flex-col gap-2">
                  {editing === s.id ? (
                    <form
                      className="flex flex-col gap-2"
                      action={(form) =>
                        run(async () => {
                          const r = await updateTemplate(s.id, String(form.get("title") ?? ""), String(form.get("description") ?? ""));
                          if (r.ok) setEditing(null);
                          return r;
                        })
                      }
                    >
                      <Field label={t("name")} htmlFor={`tt-${s.id}`}>
                        <Input id={`tt-${s.id}`} name="title" defaultValue={s.title} required maxLength={200} dir="auto" />
                      </Field>
                      <Field label={t("description")} htmlFor={`td-${s.id}`}>
                        <Textarea id={`td-${s.id}`} name="description" defaultValue={s.description} maxLength={2000} rows={3} dir="auto" />
                      </Field>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={pending}>
                          {t("save")}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
                          {t("cancel")}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <h3 className="font-semibold" dir="auto">
                        {s.title}
                      </h3>
                      {s.description && (
                        <p className="whitespace-pre-line text-sm text-muted" dir="auto">
                          {s.description}
                        </p>
                      )}
                      <Tools tools={s.tools} />
                      <p className="text-xs text-muted">
                        {t("facts", { blocks: s.blocks, conditions: s.conditions, factors: s.factors })} · {s.languages.map((l) => l.toUpperCase()).join(" / ")} ·{" "}
                        {new Date(s.createdAt).toLocaleDateString(locale)}
                      </p>
                    </>
                  )}
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    <Button size="sm" disabled={pending || !project} onClick={() => run(() => createFromSavedTemplate(s.id, project))}>
                      {t("use")}
                    </Button>
                    <Button variant="secondary" size="sm" disabled={pending} onClick={() => setEditing(s.id)}>
                      {t("edit")}
                    </Button>
                    <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => duplicateTemplate(s.id, t("copySuffix")))}>
                      {t("duplicate")}
                    </Button>
                    {confirmDelete === s.id ? (
                      <>
                        <Button variant="danger" size="sm" disabled={pending} onClick={() => run(() => deleteTemplate(s.id))}>
                          {t("confirmDelete")}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>
                          {t("cancel")}
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirmDelete(s.id)}>
                        {t("delete")}
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">{t("howToSave")}</p>
      </section>
    </div>
  );
}
