"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  createStudy,
  deleteProject,
  duplicateProject,
  setProjectArchived,
  updateProject,
} from "@/lib/actions/studio";
import type { ProjectRow } from "@/lib/data";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

export function ProjectDetailsForm({ project }: { project: ProjectRow }) {
  const t = useTranslations("studio.projects");
  const te = useTranslations("errors");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const fields = ["description", "objectives", "research_questions", "hypotheses", "notes"] as const;
  return (
    <form
      className="flex flex-col gap-3"
      action={(form) =>
        start(async () => {
          const r = await updateProject(project.id, form);
          setMsg(r.ok ? { ok: true, text: t("saved") } : { ok: false, text: te(r.error) });
        })
      }
    >
      {msg && <Alert tone={msg.ok ? "ok" : "danger"}>{msg.text}</Alert>}
      <Field label={t("name")} htmlFor="p-name">
        <Input id="p-name" name="name" defaultValue={project.name} required maxLength={200} dir="auto" />
      </Field>
      {fields.map((f) => (
        <Field key={f} label={t(f)} htmlFor={`p-${f}`}>
          <Textarea id={`p-${f}`} name={f} defaultValue={project[f] ?? ""} dir="auto" />
        </Field>
      ))}
      <Button type="submit" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}

export function ProjectActions({ projectId, projectName, archived }: { projectId: string; projectName: string; archived: boolean }) {
  const t = useTranslations("studio.projects");
  const te = useTranslations("errors");
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string } | void>) =>
    start(async () => {
      const r = await fn();
      if (r && !r.ok && r.error) setError(te(r.error));
    });
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => duplicateProject(projectId, t("copySuffix")))}>
          {t("duplicate")}
        </Button>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => setProjectArchived(projectId, !archived))}>
          {archived ? t("unarchive") : t("archive")}
        </Button>
        <Button variant="danger" size="sm" disabled={pending} onClick={() => setConfirming((v) => !v)}>
          {t("delete")}
        </Button>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {confirming && (
        <div className="flex w-full max-w-sm flex-col gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3">
          <p className="text-sm text-danger">{t("deleteWarning")}</p>
          <Field label={t("typeNameToConfirm", { name: projectName })} htmlFor="confirm-del">
            <Input id="confirm-del" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} dir="auto" />
          </Field>
          <Button
            variant="danger"
            disabled={pending || confirmText.trim() !== projectName}
            onClick={() => run(() => deleteProject(projectId, confirmText))}
          >
            {t("deleteForever")}
          </Button>
        </div>
      )}
    </div>
  );
}

export function NewStudyForm({ projectId }: { projectId: string }) {
  const t = useTranslations("studio.projects");
  const te = useTranslations("errors");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      action={(form) =>
        start(async () => {
          const r = await createStudy(projectId, form);
          if (r && !r.ok) setError(te(r.error));
        })
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label={t("studyTitle")} htmlFor="s-title">
        <Input id="s-title" name="title" required maxLength={200} dir="auto" />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("startingPoint")}</legend>
        {(["blank", "questionnaire", "media"] as const).map((k, i) => (
          <label key={k} className="flex cursor-pointer items-start gap-2 rounded-lg border border-line p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
            <input type="radio" name="start" value={k} defaultChecked={i === 1} className="mt-1" />
            <span>
              <span className="block text-sm font-medium">{t(`start.${k}.title`)}</span>
              <span className="block text-xs text-muted">{t(`start.${k}.body`)}</span>
            </span>
          </label>
        ))}
        <p className="text-xs text-muted">{t("moreStartingPointsLater")}</p>
      </fieldset>
      <Field label={t("studyLanguages")} htmlFor="s-langs">
        <Select id="s-langs" name="languages" defaultValue="both-en">
          <option value="both-en">{t("langs.bothEn")}</option>
          <option value="both-ar">{t("langs.bothAr")}</option>
          <option value="en">{t("langs.en")}</option>
          <option value="ar">{t("langs.ar")}</option>
        </Select>
      </Field>
      <Button type="submit" disabled={pending}>
        {t("createStudy")}
      </Button>
    </form>
  );
}
