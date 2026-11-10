import { setRequestLocale } from "next-intl/server";
import { StudioShell } from "@/components/studio/StudioShell";
import { StudyEditor } from "@/components/studio/StudyEditor";

export const metadata = { title: "Study · Tessellum Studio" };

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return (
    <StudioShell>
      <StudyEditor id={id} />
    </StudioShell>
  );
}
