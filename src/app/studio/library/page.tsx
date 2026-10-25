import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/data";
import { loadLibrary } from "@/lib/library/load";
import { LibraryManager } from "./LibraryManager";

export async function generateMetadata() {
  const t = await getTranslations("library");
  return { title: t("title") };
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const t = await getTranslations("library");
  const { supabase, workspaceId } = await getSession();
  const { lib, meta } = await loadLibrary(supabase, workspaceId);
  // One picture per card: a product's first image, a brand's logo, a store's facade, an ad's first image.
  const pick: [string, string][] = [];
  for (const b of Object.values(lib.brands)) if (b.logo) pick.push([b.id, b.logo.storagePath]);
  for (const p of Object.values(lib.products)) {
    const img = p.images.find((m) => m.kind === "image");
    if (img) pick.push([p.id, img.storagePath]);
  }
  for (const s of Object.values(lib.stores)) if (s.facade.image) pick.push([s.id, s.facade.image.storagePath]);
  for (const a of Object.values(lib.ads)) {
    const m = a.versions.map((v) => v.media).find((x) => x?.kind === "image");
    if (m) pick.push([a.id, m.storagePath]);
  }
  const thumbs: Record<string, string> = {};
  if (pick.length) {
    const { data } = await supabase.storage.from("media").createSignedUrls([...new Set(pick.map(([, p]) => p))], 3600);
    const byPath = new Map((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])));
    for (const [id, path] of pick) if (byPath.has(path)) thumbs[id] = byPath.get(path)!;
  }
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="max-w-3xl text-sm text-muted">{t("subtitle")}</p>
      </div>
      <LibraryManager workspaceId={workspaceId} lib={lib} meta={meta} initialTab={tab} thumbs={thumbs} />
    </div>
  );
}
