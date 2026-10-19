import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/data";
import { Card } from "@/components/ui";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ProfileForm, DeleteAccount } from "./SettingsForms";

export async function generateMetadata() {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const { user, profile, workspaceId } = await getSession();
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
        <DeleteAccount workspaceId={workspaceId} email={user.email ?? ""} />
      </Card>
    </div>
  );
}
