import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/data";
import { AI_DAILY_LIMIT, aiEnabled, usedToday } from "@/lib/ai/assistant";
import { Card } from "@/components/ui";
import { OutlineAssistant } from "./OutlineAssistant";

export async function generateMetadata() {
  const t = await getTranslations("assistant");
  return { title: t("title") };
}

export default async function AssistantPage() {
  const t = await getTranslations("assistant");
  const { supabase, user, workspaceId } = await getSession();
  const enabled = aiEnabled();
  const { data: projects } = await supabase.from("projects").select("id, name").eq("workspace_id", workspaceId).is("archived_at", null).order("created_at", { ascending: false });
  const used = enabled ? await usedToday(supabase, user.id) : 0;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted">{t("subtitle")}</p>
      </div>
      {!enabled ? (
        <Card className="flex flex-col gap-2">
          <p className="text-sm">{t("disabled")}</p>
        </Card>
      ) : (
        <>
          <p className="-mt-3 text-xs text-muted">{t("usage", { used, limit: AI_DAILY_LIMIT })}</p>
          <OutlineAssistant projects={(projects ?? []).map((p) => ({ id: p.id as string, name: p.name as string }))} />
        </>
      )}
    </div>
  );
}
