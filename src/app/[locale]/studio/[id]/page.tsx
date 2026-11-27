import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { StudioShell } from "@/components/studio/StudioShell";
import { StudyEditor } from "@/components/studio/StudyEditor";
import { brandName } from "@/config/brand";

// Depends on who is signed in, so it is never prebuilt.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: `Study · ${brandName((await params).locale)} Studio` };
}

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!(await currentUser())) redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/studio/${id}`)}`);
  return (
    <StudioShell>
      <StudyEditor id={id} />
    </StudioShell>
  );
}
