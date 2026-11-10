import { setRequestLocale } from "next-intl/server";
import { Runner } from "@/components/run/Runner";

export const metadata = { title: "Study", robots: { index: false, follow: false } };

/** The participant link: /en/s/<id> or /ar/s/<id>. Preview sessions add ?test=1. */
export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <Runner id={id} />;
}
