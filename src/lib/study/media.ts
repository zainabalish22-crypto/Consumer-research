import type { SupabaseClient } from "@supabase/supabase-js";

/** Collect every storage path referenced in a study config. */
export function collectStoragePaths(config: unknown): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.assetId === "string" && typeof o.storagePath === "string") out.add(o.storagePath);
      Object.values(o).forEach(walk);
    }
  };
  walk(config);
  return [...out];
}

/** Signed URLs (1 hour by default) for private media used by a study. */
export async function signMedia(
  supabase: SupabaseClient,
  config: unknown,
  expiresIn = 60 * 60,
): Promise<Record<string, string>> {
  const paths = collectStoragePaths(config);
  if (!paths.length) return {};
  const { data } = await supabase.storage.from("media").createSignedUrls(paths, expiresIn);
  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}
