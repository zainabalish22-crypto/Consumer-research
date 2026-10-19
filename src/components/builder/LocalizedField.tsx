"use client";
import { useId } from "react";
import { useTranslations } from "next-intl";
import type { Language, LocalizedText } from "@/lib/study/schema";
import { inputClass, cx } from "@/components/ui";

/** One input per study language, each with the right writing direction. */
export function LocalizedField({
  label,
  value,
  onChange,
  languages,
  multiline = false,
  rows = 3,
  hint,
}: {
  label: string;
  value: LocalizedText | undefined;
  onChange: (v: LocalizedText) => void;
  languages: Language[];
  multiline?: boolean;
  rows?: number;
  hint?: string;
}) {
  const id = useId();
  const t = useTranslations("builder");
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      {languages.map((lang) => {
        const fieldId = `${id}-${lang}`;
        const common = {
          id: fieldId,
          value: value?.[lang] ?? "",
          onChange: (e: { target: { value: string } }) => onChange({ ...(value ?? {}), [lang]: e.target.value }),
          dir: lang === "ar" ? "rtl" : "ltr",
          lang,
          className: cx(inputClass, multiline && "min-h-[4.5rem]"),
        } as const;
        return (
          <div key={lang} className="flex items-start gap-2">
            {languages.length > 1 && (
              <label htmlFor={fieldId} className="mt-2 w-8 shrink-0 text-xs font-semibold uppercase text-muted">
                {lang}
              </label>
            )}
            {languages.length === 1 && (
              <label htmlFor={fieldId} className="sr-only">
                {label}
              </label>
            )}
            {multiline ? <textarea rows={rows} {...common} /> : <input type="text" {...common} />}
          </div>
        );
      })}
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {languages.length > 1 && languages.some((l) => !value?.[l]?.trim()) && languages.some((l) => value?.[l]?.trim()) && (
        <p className="text-xs text-warn">{t("missingTranslation")}</p>
      )}
    </fieldset>
  );
}
