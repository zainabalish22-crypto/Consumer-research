import { getTranslations, setRequestLocale } from "next-intl/server";
import { ToolShell } from "@/components/tools/ToolShell";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "tools.privacy" });
  return { title: `${t("title")} · Tessellum` };
}

/** Short guidance on anonymising accounts before uploading a file. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tools");
  return (
    <ToolShell>
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 sm:px-8">
        <div className="flex flex-col gap-3">
          <Link href="/tools" className="self-start text-sm text-faint hover:text-photon">
            <span aria-hidden="true" className="inline-block rtl:rotate-180">
              ←
            </span>{" "}
            {t("back")}
          </Link>
          <h1 className="font-display text-3xl font-light sm:text-4xl">{t("privacy.title")}</h1>
          <p className="text-lg leading-relaxed text-dim">{t("privacy.intro")}</p>
        </div>
        <ol className="flex flex-col gap-px overflow-hidden rounded-lg border border-line-2 bg-line-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <li key={n} className="flex gap-5 bg-carbon p-6">
              <span dir="ltr" className="font-mono text-sm text-signal">
                {String(n).padStart(2, "0")}
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="font-display text-xl">{t(`privacy.p${n}Title`)}</h2>
                <p className="leading-relaxed text-mist">{t(`privacy.p${n}`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </main>
    </ToolShell>
  );
}
