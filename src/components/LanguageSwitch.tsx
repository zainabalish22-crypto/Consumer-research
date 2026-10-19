"use client";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/lib/actions/locale";

export function LanguageSwitch() {
  const locale = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  const other = locale === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setLocale(other);
          router.refresh();
        })
      }
      className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-paper"
      lang={other}
      aria-label={t("switchLanguage")}
    >
      {other === "ar" ? "العربية" : "English"}
    </button>
  );
}
