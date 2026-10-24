"use server";
/**
 * Team workspaces: switching, creating, inviting, roles. Every rule (who may
 * invite, the last owner, personal workspaces) is enforced in the database
 * functions; these actions only validate input and report results.
 */
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { WORKSPACE_COOKIE } from "@/lib/workspace-constants";
import type { ActionResult } from "./studio";

const uuid = z.string().uuid();
const role = z.enum(["owner", "editor", "viewer"]);

/** Map database errors to the interface's error keys. */
function fail(message: string | undefined): ActionResult {
  const m = message ?? "";
  if (/already a member/.test(m)) return { ok: false, error: "alreadyMember" };
  if (/needs an owner/.test(m)) return { ok: false, error: "needsOwner" };
  if (/personal/.test(m)) return { ok: false, error: "personalWorkspace" };
  if (/not allowed/.test(m)) return { ok: false, error: "notAllowed" };
  if (/too many/.test(m)) return { ok: false, error: "tooMany" };
  if (/invalid/.test(m)) return { ok: false, error: "invalidInput" };
  return { ok: false, error: "saveFailed" };
}

export async function switchWorkspace(workspaceId: string): Promise<ActionResult> {
  if (!uuid.safeParse(workspaceId).success) return { ok: false, error: "invalidInput" };
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("workspace_members").select("workspace_id").eq("workspace_id", workspaceId).eq("user_id", user.id).maybeSingle();
  if (!data) return { ok: false, error: "notFound" };
  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/studio", "layout");
  return { ok: true };
}

export async function createTeamWorkspace(name: string): Promise<ActionResult> {
  const n = z.string().trim().min(1).max(120).safeParse(name);
  if (!n.success) return { ok: false, error: "invalidInput" };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_team_workspace", { p_name: n.data });
  if (error || !data) return fail(error?.message);
  return switchWorkspace(data as string);
}

export async function renameWorkspace(workspaceId: string, name: string): Promise<ActionResult> {
  const n = z.string().trim().min(1).max(120).safeParse(name);
  if (!uuid.safeParse(workspaceId).success || !n.success) return { ok: false, error: "invalidInput" };
  const { supabase } = await requireUser();
  const { error, count } = await supabase.from("workspaces").update({ name: n.data }, { count: "exact" }).eq("id", workspaceId);
  if (error || !count) return { ok: false, error: "notAllowed" };
  revalidatePath("/studio", "layout");
  return { ok: true };
}

export async function inviteMember(workspaceId: string, email: string, r: string): Promise<ActionResult> {
  const e = z.string().trim().email().max(320).safeParse(email);
  const ro = z.enum(["editor", "viewer"]).safeParse(r);
  if (!uuid.safeParse(workspaceId).success || !e.success || !ro.success) return { ok: false, error: "invalidInput" };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("invite_to_workspace", { p_workspace: workspaceId, p_email: e.data, p_role: ro.data });
  if (error) return fail(error.message);
  revalidatePath("/studio/settings");
  return { ok: true };
}

export async function cancelInvitation(invitationId: string): Promise<ActionResult> {
  if (!uuid.safeParse(invitationId).success) return { ok: false, error: "invalidInput" };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("cancel_invitation", { p_invitation: invitationId });
  if (error) return fail(error.message);
  revalidatePath("/studio/settings");
  return { ok: true };
}

export async function respondToInvitation(invitationId: string, accept: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(invitationId).success) return { ok: false, error: "invalidInput" };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("respond_to_invitation", { p_invitation: invitationId, p_accept: accept });
  if (error) return fail(error.message);
  if (accept && data) return switchWorkspace(data as string);
  revalidatePath("/studio", "layout");
  return { ok: true };
}

export async function setMemberRole(workspaceId: string, userId: string, r: string): Promise<ActionResult> {
  const ro = role.safeParse(r);
  if (!uuid.safeParse(workspaceId).success || !uuid.safeParse(userId).success || !ro.success) return { ok: false, error: "invalidInput" };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_member_role", { p_workspace: workspaceId, p_user: userId, p_role: ro.data });
  if (error) return fail(error.message);
  revalidatePath("/studio/settings");
  return { ok: true };
}

export async function removeMember(workspaceId: string, userId: string): Promise<ActionResult> {
  if (!uuid.safeParse(workspaceId).success || !uuid.safeParse(userId).success) return { ok: false, error: "invalidInput" };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.rpc("remove_member", { p_workspace: workspaceId, p_user: userId });
  if (error) return fail(error.message);
  if (userId === user.id) (await cookies()).delete(WORKSPACE_COOKIE);
  revalidatePath("/studio", "layout");
  return { ok: true };
}
