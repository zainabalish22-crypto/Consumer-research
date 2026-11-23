import { setRequestLocale } from "next-intl/server";
import { StudioShell } from "@/components/studio/StudioShell";
import { StudyEditor } from "@/components/studio/StudyEditor";
import { brandName } from "@/config/brand";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: `Study · ${brandName((await params).locale)} Studio` };
}

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return (
    <StudioShell>
      <StudyEditor id={id} />
    </StudioShell>
  );
}
