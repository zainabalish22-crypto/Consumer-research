"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { LIBRARY_KINDS, LIBRARY_SCHEMAS, type LibraryKind } from "@/lib/study/library";
import { TABLES, toRow } from "@/lib/library/rows";

export type LibraryResult = { ok: true; id: string } | { ok: false; error: string; issues?: { path: string; message: string }[] };

const kindSchema = z.enum(LIBRARY_KINDS as [LibraryKind, ...LibraryKind[]]);
const meta = z.object({
  folder: z.string().trim().max(120).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

/** Create or update a library object. Validated with the same schema the study engine uses. */
export async function saveLibraryItem(
  workspaceId: string,
  kind: LibraryKind,
  payload: Record<string, unknown>,
  extra: { folder?: string | null; tags?: string[] } = {},
): Promise<LibraryResult> {
  if (!kindSchema.safeParse(kind).success || !z.string().uuid().safeParse(workspaceId).success) return { ok: false, error: "invalidInput" };
  const isNew = !payload.id;
  const parsed = LIBRARY_SCHEMAS[kind].safeParse({ ...payload, id: payload.id ?? crypto.randomUUID() });
  const m = meta.safeParse(extra);
  if (!parsed.success || !m.success) {
    return {
      ok: false,
      error: "invalidInput",
      issues: parsed.success ? [] : parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }
  const { supabase } = await requireUser();
  const row = { ...toRow(kind, parsed.data as Record<string, unknown>), folder: m.data.folder ?? null, tags: m.data.tags ?? [] };
  const res = isNew
    ? await supabase.from(TABLES[kind]).insert({ ...row, id: parsed.data.id, workspace_id: workspaceId }).select("id").single()
    : await supabase.from(TABLES[kind]).update(row).eq("id", parsed.data.id).select("id").single();
  if (res.error || !res.data) {
    return { ok: false, error: res.error?.code === "23505" ? "codeTaken" : "saveFailed" };
  }
  revalidatePath("/studio/library");
  return { ok: true, id: res.data.id as string };
}

export async function deleteLibraryItem(kind: LibraryKind, id: string): Promise<LibraryResult> {
  if (!kindSchema.safeParse(kind).success || !z.string().uuid().safeParse(id).success) return { ok: false, error: "invalidInput" };
  const { supabase } = await requireUser();
  const { error, count } = await supabase.from(TABLES[kind]).delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { ok: false, error: "deleteFailed" };
  revalidatePath("/studio/library");
  return { ok: true, id };
}
