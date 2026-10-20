import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/data";
import { normalizeDraft } from "@/lib/study/factories";
import { TemplateGallery, type SavedTemplate } from "./TemplateGallery";

export async function generateMetadata() {
  const t = await getTranslations("templates");
  return { title: t("title") };
}

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const t = await getTranslations("templates");
  const { supabase, workspaceId } = await getSession();
  const [{ data: rows }, { data: projects }] = await Promise.all([
    supabase.from("study_templates").select("id, title, description, config, created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("projects").select("id, name").eq("workspace_id", workspaceId).is("archived_at", null).order("created_at", { ascending: false }),
  ]);
  const saved: SavedTemplate[] = (rows ?? []).map((r) => {
    const cfg = normalizeDraft(r.config);
    const types = new Set(cfg.blocks.map((b) => b.type));
    return {
      id: r.id as string,
      title: r.title as string,
      description: (r.description as string) ?? "",
      createdAt: r.created_at as string,
      blocks: cfg.blocks.length,
      conditions: cfg.design.conditions.length,
      factors: cfg.design.factors.length,
      tools: (["village", "online_shop", "store_choice", "ad_exposure", "media", "questionnaire"] as const).filter((x) => types.has(x)),
      languages: cfg.settings.languages,
    };
  });
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="max-w-3xl text-sm text-muted">{t("subtitle")}</p>
      </div>
      <TemplateGallery saved={saved} projects={(projects ?? []).map((p) => ({ id: p.id as string, name: p.name as string }))} initialProject={project} />
    </div>
  );
}
