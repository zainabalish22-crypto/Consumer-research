import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { StudioHome } from "@/components/studio/StudioHome";
import { StudioShell } from "@/components/studio/StudioShell";
import { brandName } from "@/config/brand";

// Depends on who is signed in, so it is never prebuilt.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: `Studio · ${brandName((await params).locale)}` };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await currentUser())) redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/studio`)}`);
  return (
    <StudioShell>
      <StudioHome />
    </StudioShell>
  );
}
