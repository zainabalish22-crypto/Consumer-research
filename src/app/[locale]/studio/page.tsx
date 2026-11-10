import { setRequestLocale } from "next-intl/server";
import { StudioHome } from "@/components/studio/StudioHome";
import { StudioShell } from "@/components/studio/StudioShell";

export const metadata = { title: "Studio · Tessellum" };

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <StudioShell>
      <StudioHome />
    </StudioShell>
  );
}
