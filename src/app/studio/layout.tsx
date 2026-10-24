import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { signOut } from "@/lib/actions/auth";
import { getSession } from "@/lib/data";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("studio.nav");
  const tc = await getTranslations("common");
  const { profile, user, workspaces, workspaceId } = await getSession();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/studio" className="font-semibold">
            {tc("platformName")}
          </Link>
          <nav aria-label={t("label")} className="flex flex-1 flex-wrap gap-1 text-sm">
            <Link href="/studio" className="rounded-md px-2.5 py-1.5 hover:bg-paper">
              {t("dashboard")}
            </Link>
            <Link href="/studio/library" className="rounded-md px-2.5 py-1.5 hover:bg-paper">
              {t("library")}
            </Link>
            <Link href="/studio/templates" className="rounded-md px-2.5 py-1.5 hover:bg-paper">
              {t("templates")}
            </Link>
            <Link href="/studio/assistant" className="rounded-md px-2.5 py-1.5 hover:bg-paper">
              {t("assistant")}
            </Link>
            <Link href="/studio/media" className="rounded-md px-2.5 py-1.5 hover:bg-paper">
              {t("media")}
            </Link>
            <Link href="/studio/settings" className="rounded-md px-2.5 py-1.5 hover:bg-paper">
              {t("settings")}
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <WorkspaceSwitcher workspaces={workspaces} currentId={workspaceId} />
            <span className="hidden text-sm text-muted sm:inline" dir="auto">
              {profile?.display_name || user.email}
            </span>
            <LanguageSwitch />
            <form action={signOut}>
              <button type="submit" className="rounded-lg px-3 py-1.5 text-sm hover:bg-paper">
                {t("signOut")}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
