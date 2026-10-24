import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/data";
import { Card } from "@/components/ui";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ProfileForm, DeleteAccount } from "./SettingsForms";
import { TeamSettings, type Invitation, type Member } from "./TeamSettings";

export async function generateMetadata() {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const { supabase, user, profile, workspace, workspaces } = await getSession();
  const { data: memberRows } = workspace.isPersonal ? { data: [] } : await supabase.rpc("workspace_member_list", { p_workspace: workspace.id });
  const { data: inviteRows } = await supabase.from("workspace_invitations").select("id, email, role, workspace_id, workspaces(name)");
  const email = (user.email ?? "").toLowerCase();
  const invites = (inviteRows ?? []).map((i) => ({
    id: i.id as string,
    email: i.email as string,
    role: i.role as string,
    workspace_id: i.workspace_id as string,
    workspace_name: ((Array.isArray(i.workspaces) ? i.workspaces[0] : i.workspaces) as { name?: string } | null)?.name,
  })) as Invitation[];
  // Workspaces deleted with the account: the personal one, and team workspaces with no other members.
  const counts = await Promise.all(
    workspaces.filter((w) => !w.isPersonal).map(async (w) => ({ id: w.id, n: ((await supabase.rpc("workspace_member_list", { p_workspace: w.id })).data ?? []).length })),
  );
  const deletedWithAccount = workspaces.filter((w) => w.isPersonal || counts.find((c) => c.id === w.id)?.n === 1).map((w) => w.id);
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold">{t("profile")}</h2>
        <p className="text-sm text-muted" dir="ltr">
          {user.email}
        </p>
        <ProfileForm displayName={profile?.display_name ?? ""} />
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("teamsTitle")}</h2>
        <p className="text-sm text-muted">{t("teamsBody")}</p>
        <TeamSettings
          userId={user.id}
          workspace={workspace}
          members={(memberRows ?? []) as Member[]}
          invitations={invites.filter((i) => i.workspace_id === workspace.id && i.email !== email)}
          myInvitations={invites.filter((i) => i.email === email)}
        />
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("language")}</h2>
        <p className="text-sm text-muted">{t("languageHint")}</p>
        <div>
          <LanguageSwitch />
        </div>
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("dataTitle")}</h2>
        <p className="text-sm text-muted">{t("dataBody")}</p>
        <p className="text-sm text-muted">{t("retentionNote")}</p>
      </Card>
      <Card className="flex flex-col gap-3 border-danger/30">
        <h2 className="font-semibold text-danger">{t("deleteTitle")}</h2>
        <p className="text-sm">{t("deleteBody")}</p>
        <DeleteAccount workspaceIds={deletedWithAccount} email={user.email ?? ""} />
      </Card>
    </div>
  );
}
