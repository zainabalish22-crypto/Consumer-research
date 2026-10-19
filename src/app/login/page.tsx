import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { AuthForms } from "./AuthForms";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { Alert } from "@/components/ui";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("title") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
}) {
  const { next, error, mode } = await searchParams;
  const t = await getTranslations("auth");
  const tc = await getTranslations("common");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="font-semibold">
          {tc("platformName")}
        </Link>
        <LanguageSwitch />
      </div>
      {error === "link" && <Alert tone="danger">{t("errors.badLink")}</Alert>}
      <AuthForms next={next ?? "/studio"} initialMode={mode === "signup" ? "signup" : "signin"} />
      <p className="text-center text-xs text-muted">{t("freeNote")}</p>
    </main>
  );
}
