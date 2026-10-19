import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMPTY_LIBRARY, LIBRARY_KINDS, type LibrarySnapshot } from "@/lib/study/library";
import { SNAPSHOT_KEY, TABLES, fromRow } from "./rows";

export interface LibraryMeta {
  folder: string | null;
  tags: string[];
  updatedAt: string;
}

/** The whole library of a workspace (small enough to load at once), plus folder/tag metadata. */
export async function loadLibrary(supabase: SupabaseClient, workspaceId: string) {
  const lib: LibrarySnapshot = structuredClone(EMPTY_LIBRARY);
  const meta: Record<string, LibraryMeta> = {};
  const invalid: string[] = [];
  await Promise.all(
    LIBRARY_KINDS.map(async (kind) => {
      const { data } = await supabase.from(TABLES[kind]).select("*").eq("workspace_id", workspaceId).order("code").limit(2000);
      for (const row of data ?? []) {
        try {
          const obj = fromRow(kind, row);
          (lib[SNAPSHOT_KEY[kind]] as Record<string, unknown>)[obj.id] = obj;
          meta[obj.id] = { folder: row.folder ?? null, tags: row.tags ?? [], updatedAt: row.updated_at };
        } catch {
          invalid.push(String(row.id));
        }
      }
    }),
  );
  return { lib, meta, invalid };
}
