import { setRequestLocale } from "next-intl/server";
import { StudioHome } from "@/components/studio/StudioHome";
import { StudioShell } from "@/components/studio/StudioShell";
import { brandName } from "@/config/brand";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: `Studio · ${brandName((await params).locale)}` };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <StudioShell>
      <StudioHome />
    </StudioShell>
  );
}
