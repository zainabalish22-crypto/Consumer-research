"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createProject } from "@/lib/actions/studio";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";

export function NewProjectForm({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("studio.projects");
  const te = useTranslations("errors");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      action={(form) =>
        start(async () => {
          const r = await createProject(workspaceId, form);
          if (r && !r.ok) setError(r.error);
        })
      }
    >
      {error && <Alert tone="danger">{te(error)}</Alert>}
      <Field label={t("name")} htmlFor="np-name">
        <Input id="np-name" name="name" required maxLength={200} dir="auto" />
      </Field>
      <Field label={t("description")} htmlFor="np-desc">
        <Textarea id="np-desc" name="description" maxLength={5000} dir="auto" />
      </Field>
      <Button type="submit" disabled={pending}>
        {t("create")}
      </Button>
    </form>
  );
}
