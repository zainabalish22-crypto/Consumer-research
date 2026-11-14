import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { ToolShell } from "@/components/tools/ToolShell";
import { currentUser, safeNext } from "@/lib/auth";

// Depends on who is signed in and where to return to, so it is never prebuilt.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "auth" });
  return { title: `${t("signUp")} · Tessellum` };
}

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const next = safeNext((await searchParams).next, "");
  // Already signed in: go straight on.
  if (await currentUser()) redirect(next || `/${locale}/tools`);
  return (
    <ToolShell>
      <AuthForm mode="up" next={next || undefined} />
    </ToolShell>
  );
}
