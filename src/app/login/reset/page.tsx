import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card } from "@/components/ui";
import { ResetForm } from "./ResetForm";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("resetTitle") };
}

/** Reached from a password-reset email; the link has already signed the user in. */
export default async function ResetPage() {
  const t = await getTranslations("auth");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <Card className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">{t("resetTitle")}</h1>
        {user ? (
          <>
            <p className="text-sm text-muted" dir="ltr">
              {user.email}
            </p>
            <ResetForm />
          </>
        ) : (
          <>
            <Alert tone="danger">{t("errors.resetExpired")}</Alert>
            <Link href="/login?mode=forgot" className="text-sm text-accent underline">
              {t("forgotPassword")}
            </Link>
          </>
        )}
      </Card>
    </main>
  );
}
