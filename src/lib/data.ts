import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StudyStatus = "draft" | "active" | "paused" | "closed";

export interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  objectives: string | null;
  research_questions: string | null;
  hypotheses: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudyRow {
  id: string;
  project_id: string;
  title: string;
  slug: string;
  status: StudyStatus;
  draft_config: unknown;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Signed-in researcher with their (personal) workspace. Redirects to login if needed. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(id, name, is_personal)")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .single();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return { supabase, user, workspaceId: membership?.workspace_id as string, profile };
});

export async function sessionCounts(studyIds: string[]) {
  if (!studyIds.length) return new Map<string, { started: number; completed: number; test: number }>();
  const { supabase } = await getSession();
  const { data } = await supabase.rpc("study_session_counts", { p_study_ids: studyIds });
  const map = new Map<string, { started: number; completed: number; test: number }>();
  for (const r of (data ?? []) as { study_id: string; started: number; completed: number; test: number }[]) {
    map.set(r.study_id, { started: Number(r.started), completed: Number(r.completed), test: Number(r.test) });
  }
  return map;
}

export async function getStudy(studyId: string) {
  const { supabase } = await getSession();
  const { data: study } = await supabase.from("studies").select("*").eq("id", studyId).maybeSingle();
  if (!study) return null;
  const { data: project } = await supabase.from("projects").select("id, name, workspace_id").eq("id", study.project_id).single();
  const { data: versions } = await supabase
    .from("study_versions")
    .select("id, version_number, locked, published_at")
    .eq("study_id", studyId)
    .order("version_number", { ascending: false });
  return { study: study as StudyRow, project: project as Pick<ProjectRow, "id" | "name" | "workspace_id">, versions: versions ?? [] };
}
