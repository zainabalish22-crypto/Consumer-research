"use server";
/**
 * Saved study templates: a copy of a study's draft configuration, kept in the
 * workspace. Starting from one creates a normal draft study.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { normalizeDraft } from "@/lib/study/factories";
import type { ActionResult } from "./studio";

const uuid = z.string().uuid();
const Meta = z.object({ title: z.string().trim().min(1).max(200), description: z.string().trim().max(2000).default("") });

async function workspaceOfProject(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], projectId: string) {
  const { data } = await supabase.from("projects").select("workspace_id").eq("id", projectId).single();
  return (data?.workspace_id as string | undefined) ?? null;
}

export async function saveAsTemplate(studyId: string, title: string, description: string): Promise<ActionResult> {
  const meta = Meta.safeParse({ title, description });
  if (!uuid.safeParse(studyId).success || !meta.success) return { ok: false, error: "invalidInput" };
  const { supabase, user } = await requireUser();
  const { data: study } = await supabase.from("studies").select("project_id, draft_config").eq("id", studyId).single();
  if (!study) return { ok: false, error: "notFound" };
  const ws = await workspaceOfProject(supabase, study.project_id as string);
  if (!ws) return { ok: false, error: "notFound" };
  const config = normalizeDraft(study.draft_config);
  // Dismissed warnings belong to the original study, not to studies made from the template.
  config.settings.dismissedWarnings = [];
  const { error } = await supabase.from("study_templates").insert({
    workspace_id: ws,
    title: meta.data.title,
    description: meta.data.description,
    config,
    source_study_id: studyId,
    created_by: user.id,
  });
  if (error) return { ok: false, error: "saveFailed" };
  revalidatePath("/studio/templates");
  return { ok: true };
}

export async function createFromSavedTemplate(templateId: string, projectId: string): Promise<ActionResult> {
  if (!uuid.safeParse(templateId).success || !uuid.safeParse(projectId).success) return { ok: false, error: "invalidInput" };
  const { supabase, user } = await requireUser();
  const { data: tpl } = await supabase.from("study_templates").select("workspace_id, title, config").eq("id", templateId).single();
  if (!tpl) return { ok: false, error: "notFound" };
  // Library items are referenced by id, so templates are only used inside their own workspace.
  if ((await workspaceOfProject(supabase, projectId)) !== tpl.workspace_id) return { ok: false, error: "notFound" };
  const { data, error } = await supabase
    .from("studies")
    .insert({ project_id: projectId, title: tpl.title as string, draft_config: normalizeDraft(tpl.config), created_by: user.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "saveFailed" };
  redirect(`/studio/studies/${data.id}`);
}

export async function duplicateTemplate(templateId: string, suffix: string): Promise<ActionResult> {
  if (!uuid.safeParse(templateId).success) return { ok: false, error: "invalidInput" };
  const { supabase, user } = await requireUser();
  const { data: tpl } = await supabase.from("study_templates").select("workspace_id, title, description, config").eq("id", templateId).single();
  if (!tpl) return { ok: false, error: "notFound" };
  const { error } = await supabase.from("study_templates").insert({
    workspace_id: tpl.workspace_id,
    title: `${tpl.title} ${suffix.slice(0, 40)}`.slice(0, 200),
    description: tpl.description,
    config: tpl.config,
    created_by: user.id,
  });
  if (error) return { ok: false, error: "saveFailed" };
  revalidatePath("/studio/templates");
  return { ok: true };
}

export async function updateTemplate(templateId: string, title: string, description: string): Promise<ActionResult> {
  const meta = Meta.safeParse({ title, description });
  if (!uuid.safeParse(templateId).success || !meta.success) return { ok: false, error: "invalidInput" };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("study_templates").update(meta.data).eq("id", templateId);
  if (error) return { ok: false, error: "saveFailed" };
  revalidatePath("/studio/templates");
  return { ok: true };
}

export async function deleteTemplate(templateId: string): Promise<ActionResult> {
  if (!uuid.safeParse(templateId).success) return { ok: false, error: "invalidInput" };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("study_templates").delete().eq("id", templateId);
  if (error) return { ok: false, error: "deleteFailed" };
  revalidatePath("/studio/templates");
  return { ok: true };
}
