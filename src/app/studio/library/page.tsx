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
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="max-w-3xl text-sm text-muted">{t("subtitle")}</p>
      </div>
      <LibraryManager workspaceId={workspaceId} lib={lib} meta={meta} initialTab={tab} />
    </div>
  );
}
