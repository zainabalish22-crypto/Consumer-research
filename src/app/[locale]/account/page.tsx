import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { DeleteAccount } from "@/components/auth/DeleteAccount";
import { ToolShell } from "@/components/tools/ToolShell";
import { brandName } from "@/config/brand";
import { currentUser } from "@/lib/auth";

// Depends on who is signed in, so it is never prebuilt.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return { title: `${t("title")} · ${brandName(locale)}` };
}

/** The researcher's account: who is signed in, and deleting the account with all its data. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await currentUser();
  if (!user) redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/account`)}`);
  const t = await getTranslations("account");
  return (
    <ToolShell>
      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12 sm:px-8">
        <h1 className="font-display text-4xl font-light">{t("title")}</h1>
        <dl className="grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-[auto_1fr]">
          {user.name && (
            <>
              <dt className="text-faint">{t("name")}</dt>
              <dd>{user.name}</dd>
            </>
          )}
          <dt className="text-faint">{t("email")}</dt>
          <dd dir="ltr" className="text-start">
            {user.email}
          </dd>
        </dl>
        <p className="text-sm leading-relaxed text-faint">{t("passwordNote")}</p>
        <DeleteAccount email={user.email} home={`/${locale}`} />
      </main>
    </ToolShell>
  );
}
