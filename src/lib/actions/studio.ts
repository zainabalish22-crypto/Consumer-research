"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { StudyConfig } from "@/lib/study/schema";
import { startingConfig } from "@/lib/study/factories";
import { loadLibrary } from "@/lib/library/load";
import { TABLES, buildSnapshot, toRow } from "@/lib/library/rows";
import { mediaIssues } from "@/lib/library/checks";
import { LIBRARY_KINDS, type LibraryKind } from "@/lib/study/library";
import { buildTemplate, type TemplateKind } from "@/lib/templates";

export type ActionResult = { ok: true } | { ok: false; error: string; issues?: { path: string; message: string }[] };

const uuid = z.string().uuid();
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null));

async function audit(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  workspaceId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    actor_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  });
}

async function studyWorkspace(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], studyId: string) {
  const { data } = await supabase.from("studies").select("project_id, projects(workspace_id)").eq("id", studyId).single();
  const p = data?.projects as unknown as { workspace_id: string } | null;
  return p?.workspace_id ?? null;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

const ProjectFields = z.object({
  name: z.string().trim().min(1).max(200),
  description: optionalText(5000),
  objectives: optionalText(20000),
  research_questions: optionalText(20000),
  hypotheses: optionalText(20000),
  notes: optionalText(20000),
});

function projectForm(form: FormData) {
  return ProjectFields.safeParse({
    name: form.get("name") ?? "",
    description: form.get("description") ?? undefined,
    objectives: form.get("objectives") ?? undefined,
    research_questions: form.get("research_questions") ?? undefined,
    hypotheses: form.get("hypotheses") ?? undefined,
    notes: form.get("notes") ?? undefined,
  });
}

export async function createProject(workspaceId: string, form: FormData): Promise<ActionResult> {
  const parsed = projectForm(form);
  if (!parsed.success || !uuid.safeParse(workspaceId).success) return { ok: false, error: "invalidInput" };
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...parsed.data, workspace_id: workspaceId, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "saveFailed" };
  redirect(`/studio/projects/${data.id}`);
}

export async function updateProject(projectId: string, form: FormData): Promise<ActionResult> {
  const parsed = projectForm(form);
  if (!parsed.success || !uuid.safeParse(projectId).success) return { ok: false, error: "invalidInput" };
  const { supabase } = await requireUser();
  const { error, count } = await supabase.from("projects").update(parsed.data, { count: "exact" }).eq("id", projectId);
  if (error || !count) return { ok: false, error: "saveFailed" };
  revalidatePath(`/studio/projects/${projectId}`);
  return { ok: true };
}

export async function setProjectArchived(projectId: string, archived: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(projectId).success) return { ok: false, error: "invalidInput" };
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("projects")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", projectId);
  if (error) return { ok: false, error: "saveFailed" };
  revalidatePath("/studio");
  revalidatePath(`/studio/projects/${projectId}`);
  return { ok: true };
}

export async function duplicateProject(projectId: string, nameSuffix: string): Promise<ActionResult> {
  if (!uuid.safeParse(projectId).success) return { ok: false, error: "invalidInput" };
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from("projects").select("*").eq("id", projectId).single();
  if (!p) return { ok: false, error: "notFound" };
  const { data: copy, error } = await supabase
    .from("projects")
    .insert({
      workspace_id: p.workspace_id,
      name: `${p.name} ${nameSuffix}`.slice(0, 200),
      description: p.description,
      objectives: p.objectives,
      research_questions: p.research_questions,
      hypotheses: p.hypotheses,
      notes: p.notes,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !copy) return { ok: false, error: "saveFailed" };
  const { data: studies } = await supabase.from("studies").select("title, draft_config").eq("project_id", projectId);
  if (studies?.length) {
    await supabase
      .from("studies")
      .insert(studies.map((s) => ({ project_id: copy.id, title: s.title, draft_config: s.draft_config, created_by: user.id })));
  }
  redirect(`/studio/projects/${copy.id}`);
}

export async function deleteProject(projectId: string, confirmName: string): Promise<ActionResult> {
  if (!uuid.safeParse(projectId).success) return { ok: false, error: "invalidInput" };
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from("projects").select("name, workspace_id").eq("id", projectId).single();
  if (!p) return { ok: false, error: "notFound" };
  if (p.name !== confirmName.trim()) return { ok: false, error: "confirmMismatch" };
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) return { ok: false, error: "deleteFailed" };
  await audit(supabase, user.id, p.workspace_id, "project.deleted", "project", projectId, { name: p.name });
  redirect("/studio");
}

// ---------------------------------------------------------------------------
// Studies
// ---------------------------------------------------------------------------

const NewStudy = z.object({
  title: z.string().trim().min(1).max(200),
  start: z.enum(["blank", "questionnaire", "media", "experiment"]),
  languages: z.enum(["en", "ar", "both-en", "both-ar"]),
});

export async function createStudy(projectId: string, form: FormData): Promise<ActionResult> {
  const parsed = NewStudy.safeParse({ title: form.get("title"), start: form.get("start"), languages: form.get("languages") });
  if (!parsed.success || !uuid.safeParse(projectId).success) return { ok: false, error: "invalidInput" };
  const langs =
    parsed.data.languages === "both-en"
      ? (["en", "ar"] as const)
      : parsed.data.languages === "both-ar"
        ? (["ar", "en"] as const)
        : ([parsed.data.languages] as const);
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("studies")
    .insert({
      project_id: projectId,
      title: parsed.data.title,
      draft_config: startingConfig(parsed.data.start, [...langs]),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "saveFailed" };
  redirect(`/studio/studies/${data.id}`);
}

/**
 * Create a study from a template. The template's brands, stores, products, offers
 * and ads are inserted into the researcher's library like any other objects,
 * then a normal study draft is created that references them.
 */
export async function createFromTemplate(projectId: string, template: TemplateKind): Promise<ActionResult> {
  if (!uuid.safeParse(projectId).success || !["foodcourt", "deepfake"].includes(template)) return { ok: false, error: "invalidInput" };
  const { supabase, user } = await requireUser();
  const { data: project } = await supabase.from("projects").select("workspace_id").eq("id", projectId).single();
  if (!project) return { ok: false, error: "notFound" };
  const ws = project.workspace_id as string;

  const taken = new Set<string>();
  for (const kind of LIBRARY_KINDS) {
    const { data } = await supabase.from(TABLES[kind]).select("code").eq("workspace_id", ws);
    (data ?? []).forEach((r) => taken.add(`${kind}:${String(r.code).toLowerCase()}`));
  }
  // Codes are unique per library table; add a suffix when the wanted code is taken.
  const code = (kind: LibraryKind, wanted: string) => {
    let c = wanted;
    for (let i = 2; taken.has(`${kind}:${c.toLowerCase()}`); i++) c = `${wanted}_${i}`.slice(0, 20);
    taken.add(`${kind}:${c.toLowerCase()}`);
    return c;
  };
  const result = buildTemplate(template, { newId: () => crypto.randomUUID(), code });

  const insert = async (kind: LibraryKind, items: { id: string }[]) => {
    if (!items.length) return null;
    const rows = items.map((o) => ({ ...toRow(kind, o as unknown as Record<string, unknown>), id: o.id, workspace_id: ws, folder: result.title.slice(0, 120), tags: ["template"] }));
    const { error } = await supabase.from(TABLES[kind]).insert(rows);
    return error;
  };
  for (const [kind, items] of [
    ["brand", result.library.brands],
    ["product", result.library.products],
    ["offer", result.library.offers],
    ["ad", result.library.ads],
    ["store", result.library.stores],
  ] as const) {
    const error = await insert(kind, items);
    if (error) return { ok: false, error: "saveFailed" };
  }

  const { data, error } = await supabase
    .from("studies")
    .insert({ project_id: projectId, title: result.title, draft_config: result.config, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "saveFailed" };
  await audit(supabase, user.id, ws, "study.created_from_template", "study", data.id, { template });
  redirect(`/studio/studies/${data.id}`);
}

export async function renameStudy(studyId: string, title: string): Promise<ActionResult> {
  const t = z.string().trim().min(1).max(200).safeParse(title);
  if (!t.success || !uuid.safeParse(studyId).success) return { ok: false, error: "invalidInput" };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("studies").update({ title: t.data }).eq("id", studyId);
  if (error) return { ok: false, error: "saveFailed" };
  revalidatePath(`/studio/studies/${studyId}`);
  return { ok: true };
}

/**
 * Drafts may be incomplete, so saving checks structure only; the full schema
 * is enforced when publishing. Returned issues are shown in the builder.
 */
const DraftShape = z.object({
  schemaVersion: z.literal(1),
  settings: z.object({ languages: z.array(z.enum(["en", "ar"])).min(1).max(2) }).passthrough(),
  blocks: z.array(z.object({ id: z.string().min(1).max(40), type: z.string().min(1).max(40) }).passthrough()).max(300),
});

export async function saveDraft(studyId: string, config: unknown): Promise<ActionResult> {
  if (!uuid.safeParse(studyId).success) return { ok: false, error: "invalidInput" };
  if (JSON.stringify(config ?? null).length > 1_000_000) return { ok: false, error: "tooLarge" };
  const shape = DraftShape.safeParse(config);
  if (!shape.success) return { ok: false, error: "invalidConfig" };
  const { supabase } = await requireUser();
  const { error, count } = await supabase
    .from("studies")
    .update({ draft_config: config as object }, { count: "exact" })
    .eq("id", studyId);
  if (error || !count) return { ok: false, error: "saveFailed" };
  return { ok: true };
}

export async function publishStudy(studyId: string): Promise<ActionResult & { version?: number; created?: boolean }> {
  if (!uuid.safeParse(studyId).success) return { ok: false, error: "invalidInput" };
  const { supabase } = await requireUser();
  const { data: study } = await supabase.from("studies").select("draft_config").eq("id", studyId).single();
  if (!study) return { ok: false, error: "notFound" };
  const parsed = StudyConfig.safeParse(study.draft_config);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalidConfig",
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }
  // Copy the library objects this study uses into the version, so later library edits never change it.
  const ws = await studyWorkspace(supabase, studyId);
  if (!ws) return { ok: false, error: "notFound" };
  const { lib } = await loadLibrary(supabase, ws);
  const { snapshot, missing } = buildSnapshot(parsed.data, lib);
  const issues = [
    ...missing.map((id) => ({ path: "library", message: `A referenced library item no longer exists (${id})` })),
    ...mediaIssues(parsed.data, snapshot),
  ];
  if (issues.length) return { ok: false, error: "invalidConfig", issues };
  const finalConfig = { ...parsed.data, library: snapshot };
  // Store the normalised config (defaults filled) so the published version is self-describing.
  await supabase.from("studies").update({ draft_config: finalConfig }).eq("id", studyId);
  const { data, error } = await supabase.rpc("publish_study", { p_study_id: studyId });
  if (error) return { ok: false, error: "publishFailed" };
  revalidatePath(`/studio/studies/${studyId}`);
  const r = data as { version_number: number; created: boolean };
  return { ok: true, version: r.version_number, created: r.created };
}

export async function setStudyStatus(studyId: string, status: "active" | "paused" | "closed"): Promise<ActionResult> {
  if (!uuid.safeParse(studyId).success || !["active", "paused", "closed"].includes(status)) {
    return { ok: false, error: "invalidInput" };
  }
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("studies").update({ status }).eq("id", studyId);
  if (error) return { ok: false, error: "saveFailed" };
  const ws = await studyWorkspace(supabase, studyId);
  if (ws) await audit(supabase, user.id, ws, "study.status_changed", "study", studyId, { status });
  revalidatePath(`/studio/studies/${studyId}`);
  return { ok: true };
}

export async function lockVersion(studyId: string, versionId: string): Promise<ActionResult> {
  if (!uuid.safeParse(versionId).success) return { ok: false, error: "invalidInput" };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("lock_study_version", { p_version_id: versionId });
  if (error) return { ok: false, error: "saveFailed" };
  revalidatePath(`/studio/studies/${studyId}`);
  return { ok: true };
}

export async function duplicateStudy(studyId: string, title: string): Promise<ActionResult> {
  if (!uuid.safeParse(studyId).success) return { ok: false, error: "invalidInput" };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("duplicate_study", { p_study_id: studyId, p_title: title.slice(0, 200) });
  if (error || !data) return { ok: false, error: "saveFailed" };
  redirect(`/studio/studies/${data}`);
}

export async function deleteStudy(studyId: string, confirmTitle: string): Promise<ActionResult> {
  if (!uuid.safeParse(studyId).success) return { ok: false, error: "invalidInput" };
  const { supabase, user } = await requireUser();
  const { data: s } = await supabase.from("studies").select("title, project_id").eq("id", studyId).single();
  if (!s) return { ok: false, error: "notFound" };
  if (s.title !== confirmTitle.trim()) return { ok: false, error: "confirmMismatch" };
  const ws = await studyWorkspace(supabase, studyId);
  const { error } = await supabase.from("studies").delete().eq("id", studyId);
  if (error) return { ok: false, error: "deleteFailed" };
  if (ws) await audit(supabase, user.id, ws, "study.deleted", "study", studyId, { title: s.title });
  redirect(`/studio/projects/${s.project_id}`);
}

/** Methodological warnings stay non-blocking; dismissals are recorded for transparency. */
export async function logWarningDismissal(studyId: string, warningId: string, restored = false): Promise<ActionResult> {
  if (!uuid.safeParse(studyId).success || !/^[a-z_:A-Za-z0-9-]{1,120}$/.test(warningId)) return { ok: false, error: "invalidInput" };
  const { supabase, user } = await requireUser();
  const ws = await studyWorkspace(supabase, studyId);
  if (!ws) return { ok: false, error: "notFound" };
  await audit(supabase, user.id, ws, restored ? "warning.restored" : "warning.dismissed", "study", studyId, { warning: warningId });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Participant data management
// ---------------------------------------------------------------------------

export async function setSessionExcluded(
  studyId: string,
  sessionId: string,
  excluded: boolean,
  reason: string,
): Promise<ActionResult> {
  if (!uuid.safeParse(sessionId).success) return { ok: false, error: "invalidInput" };
  const { supabase } = await requireUser();
  const { error, count } = await supabase
    .from("participant_sessions")
    .update({ excluded, exclusion_reason: excluded ? reason.trim().slice(0, 500) || null : null }, { count: "exact" })
    .eq("id", sessionId);
  if (error || !count) return { ok: false, error: "saveFailed" };
  revalidatePath(`/studio/studies/${studyId}/data`);
  return { ok: true };
}

export async function deleteTestSessions(studyId: string): Promise<ActionResult> {
  if (!uuid.safeParse(studyId).success) return { ok: false, error: "invalidInput" };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("participant_sessions").delete().eq("study_id", studyId).eq("is_test", true);
  if (error) return { ok: false, error: "deleteFailed" };
  const ws = await studyWorkspace(supabase, studyId);
  if (ws) await audit(supabase, user.id, ws, "sessions.test_deleted", "study", studyId);
  revalidatePath(`/studio/studies/${studyId}/data`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function updateProfile(form: FormData): Promise<ActionResult> {
  const parsed = z.object({ display_name: z.string().trim().max(120) }).safeParse({ display_name: form.get("display_name") ?? "" });
  if (!parsed.success) return { ok: false, error: "invalidInput" };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return { ok: false, error: "saveFailed" };
  revalidatePath("/studio/settings");
  return { ok: true };
}
