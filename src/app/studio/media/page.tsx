import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/data";
import { LIMITS } from "@/config/platform";
import { MediaLibrary, type AssetRow } from "./MediaLibrary";

export async function generateMetadata() {
  const t = await getTranslations("media");
  return { title: t("title") };
}

export default async function MediaPage() {
  const t = await getTranslations("media");
  const { supabase, workspaceId } = await getSession();
  const { data } = await supabase
    .from("media_assets")
    .select("id, storage_path, file_name, mime_type, kind, size_bytes, width, height, folder, tags, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(500);
  const assets = (data ?? []) as AssetRow[];
  const imagePaths = assets.filter((a) => a.kind === "image").map((a) => a.storage_path);
  let thumbs: Record<string, string> = {};
  if (imagePaths.length) {
    const { data: signed } = await supabase.storage.from("media").createSignedUrls(imagePaths, 3600);
    thumbs = Object.fromEntries((signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  }
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted">{t("subtitle", { mb: LIMITS.maxUploadBytes / 1024 / 1024 })}</p>
      </div>
      <MediaLibrary workspaceId={workspaceId} initialAssets={assets} thumbs={thumbs} />
    </div>
  );
}
