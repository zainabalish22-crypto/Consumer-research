import { getTranslations } from "next-intl/server";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { signOut } from "@/lib/actions/auth";
import { getSession } from "@/lib/data";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { StudioNav } from "./StudioNav";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("studio.nav");
  const { profile, user, workspaces, workspaceId } = await getSession();
  return (
    <div className="min-h-screen lg:flex">
      <StudioNav
        label={t("label")}
        menuLabel={t("menu")}
        items={[
          { href: "/studio", label: t("dashboard"), icon: "dashboard", exact: true },
          { href: "/studio/library", label: t("library"), icon: "library" },
          { href: "/studio/templates", label: t("templates"), icon: "templates" },
          { href: "/studio/assistant", label: t("assistant"), icon: "assistant" },
          { href: "/studio/media", label: t("media"), icon: "media" },
          { href: "/studio/settings", label: t("settings"), icon: "settings" },
        ]}
        workspace={<WorkspaceSwitcher workspaces={workspaces} currentId={workspaceId} />}
        footer={
          <>
            <span className="truncate text-muted" dir="auto">
              {profile?.display_name || user.email}
            </span>
            <div className="flex items-center gap-2">
              <LanguageSwitch />
              <form action={signOut}>
                <button type="submit" className="rounded-lg px-3 py-1.5 hover:bg-paper">
                  {t("signOut")}
                </button>
              </form>
            </div>
          </>
        }
      />
      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
