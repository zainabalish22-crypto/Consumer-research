"use client";

/** Studio controls in the Tessellum dark style: labelled, keyboard-friendly, 44 px targets. */
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { repo } from "@/lib/study/repo";
import type { L10n, Lang, MediaRef } from "@/lib/study/types";
import { useMediaUrl } from "@/lib/study/useMedia";

export const inputCls =
  "w-full min-h-11 rounded-md border border-line-2 bg-void px-3 py-2 text-[15px] text-photon placeholder:text-faint focus:border-ice focus:outline-none";

export function Field({ label, hint, children, id }: { label: string; hint?: string; children: React.ReactNode; id?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-mist">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}

export function TextInput({ label, value, onChange, hint, type = "text", dir, placeholder }: { label: string; value: string | number | undefined; onChange: (v: string) => void; hint?: string; type?: string; dir?: "ltr" | "rtl"; placeholder?: string }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} id={id}>
      <input id={id} type={type} dir={dir} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </Field>
  );
}

export function NumberInput({ label, value, onChange, step = "any", hint }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; step?: string; hint?: string }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} id={id}>
      <input id={id} type="number" inputMode="decimal" step={step} dir="ltr" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} className={inputCls} />
    </Field>
  );
}

export function Select<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  const id = useId();
  return (
    <Field label={label} id={id}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className={inputCls}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] text-mist">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[#FF6A2B]" />
      {label}
    </label>
  );
}

/** One input per study language, each in its own direction. */
export function L10nInput({ label, value, onChange, langs, multiline = false, hint }: { label: string; value: L10n; onChange: (v: L10n) => void; langs: Lang[]; multiline?: boolean; hint?: string }) {
  const t = useTranslations("studio.fields");
  const base = useId();
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-[13px] font-medium text-mist">{label}</legend>
      <div className={`grid gap-2 ${langs.length > 1 ? "md:grid-cols-2" : ""}`}>
        {langs.map((l) => {
          const id = `${base}-${l}`;
          const common = {
            id,
            lang: l,
            dir: l === "ar" ? ("rtl" as const) : ("ltr" as const),
            value: value[l] ?? "",
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [l]: e.target.value }),
            className: `${inputCls} ${l === "ar" ? "font-[family-name:var(--font-plex-ar)]" : ""}`,
          };
          return (
            <div key={l} className="flex flex-col gap-1">
              {langs.length > 1 && (
                <label htmlFor={id} className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
                  {t(l)}
                </label>
              )}
              {multiline ? <textarea rows={3} {...common} /> : <input {...common} aria-label={langs.length > 1 ? undefined : label} />}
            </div>
          );
        })}
      </div>
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </fieldset>
  );
}

export function Button({ children, onClick, kind = "ghost", type = "button", label, disabled }: { children: React.ReactNode; onClick?: () => void; kind?: "primary" | "ghost" | "danger" | "quiet"; type?: "button" | "submit"; label?: string; disabled?: boolean }) {
  const cls = {
    primary: "bg-photon text-void hover:bg-white",
    ghost: "border border-line-3 text-photon hover:border-photon",
    danger: "border border-line-3 text-danger hover:border-danger",
    quiet: "text-mist hover:text-photon",
  }[kind];
  return (
    <button type={type} onClick={onClick} aria-label={label} disabled={disabled} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold disabled:opacity-40 ${cls}`}>
      {children}
    </button>
  );
}

/** Square icon button with an accessible name. */
export function IconButton({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="inline-flex h-11 w-11 items-center justify-center rounded-md text-mist hover:bg-steel hover:text-photon disabled:opacity-30">
      {children}
    </button>
  );
}

export const Icon = {
  up: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 15l6-6 6 6" />
    </svg>
  ),
  down: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  x: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  copy: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </svg>
  ),
  grip: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  ),
  plus: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
};

/** A picked image (upload or address) with a preview. */
export function MediaInput({ label, value, onChange, accept = "image/*" }: { label: string; value: MediaRef | undefined; onChange: (v: MediaRef | undefined) => void; accept?: string }) {
  const t = useTranslations("studio.media");
  const { url, isVideo } = useMediaUrl(value);
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-mist">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line-2 bg-carbon text-xs text-faint">
          {url ? isVideo ? <video src={url} className="h-full w-full object-cover" muted /> : <img src={url} alt="" className="h-full w-full object-cover" /> : t("none")}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={file}
              id={id}
              type="file"
              accept={accept}
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                if (f.size > 8 * 1024 * 1024) return setError(t("tooBig"));
                setError("");
                onChange(await repo.putMedia(f, f.name));
              }}
            />
            <Button onClick={() => file.current?.click()}>{t("upload")}</Button>
            {value && (
              <Button kind="quiet" onClick={() => onChange(undefined)}>
                {t("remove")}
              </Button>
            )}
          </div>
          <input aria-label={t("url")} placeholder={t("url")} dir="ltr" value={value && !value.startsWith("media:") ? value : ""} onChange={(e) => onChange(e.target.value || undefined)} className={inputCls} />
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}

/** A bordered editing panel. */
export function Panel({ title, children, actions }: { title?: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line-2 bg-carbon p-5">
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title && <h3 className="font-display text-lg">{title}</h3>}
          {actions && <div className="flex flex-wrap gap-1">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
