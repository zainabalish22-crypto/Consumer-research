"use client";

import { useLocale, useTranslations } from "next-intl";
import { AccountLink } from "@/components/auth/AccountLink";
import { Wordmark } from "@/components/site/Logo";
import { Link, usePathname } from "@/i18n/navigation";
import { STEPS, stepPath, type AnalysisTool, type Step } from "@/lib/tools/registry";

/** Shared frame for the tools: brand, a link to all tools, and the full language switch. */
export function ToolShell({ children }: { children: React.ReactNode }) {
  const nav = useTranslations("nav");
  const locale = useLocale();
  const path = usePathname();
  const other = locale === "ar" ? "en" : "ar";
  return (
    <div className="flex min-h-dvh flex-col bg-void text-photon">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line px-4 py-4 sm:px-8">
        <Link href="/" aria-label={nav("home")}>
          <Wordmark />
        </Link>
        <Link href="/tools" className="tracked font-mono text-xs uppercase tracking-[0.16em] text-signal hover:text-signal-soft">
          {nav("tools")}
        </Link>
        <Link href="/studio" className="tracked font-mono text-xs uppercase tracking-[0.16em] text-mist hover:text-photon">
          {nav("studio")}
        </Link>
        <div className="ms-auto flex items-center gap-1">
          <AccountLink />
          <Link href={path} locale={other} lang={other} aria-label={nav("otherLanguageLabel")} className="px-3 py-3 text-sm hover:text-signal">
            {nav("otherLanguage")}
          </Link>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}

/**
 * The four steps of an analysis tool. Steps are links, so a researcher can go back; the
 * current step is marked for screen readers as well as by colour.
 */
export function Stepper({ tool, current }: { tool: AnalysisTool; current: Step }) {
  const t = useTranslations("tools");
  const at = STEPS.indexOf(current);
  return (
    <nav aria-label={t("stepsLabel")}>
      <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line-2 bg-line-2 sm:grid-cols-4">
        {STEPS.map((s, i) => {
          const on = i === at;
          return (
            <li key={s}>
              <Link href={stepPath(tool, s)} aria-current={on ? "step" : undefined} className={`flex min-h-12 items-center gap-3 px-4 py-2 text-sm ${on ? "bg-steel text-photon" : "bg-carbon text-dim hover:text-photon"}`}>
                <span dir="ltr" className={`font-mono text-xs ${on ? "text-signal" : i < at ? "text-ice" : "text-faint"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {t(`steps.${s}`)}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** The page frame every analysis-tool step uses: back link, title, stepper, then the step. */
export function ToolPage({ tool, step, children }: { tool: AnalysisTool; step: Step; children: React.ReactNode }) {
  const t = useTranslations("tools");
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-2">
        <Link href="/tools" className="self-start text-sm text-faint hover:text-photon">
          <span aria-hidden="true" className="inline-block rtl:rotate-180">
            ←
          </span>{" "}
          {t("back")}
        </Link>
        <h1 className="font-display text-3xl font-light sm:text-4xl">{t(`${tool}.name`)}</h1>
      </div>
      <Stepper tool={tool} current={step} />
      {children}
    </main>
  );
}

/** The on-device privacy statement shown on every analysis-tool page. */
export function PrivacyNote() {
  const t = useTranslations("tools");
  return (
    <p className="flex flex-col gap-2 rounded-lg border border-line-2 bg-carbon p-4 text-sm leading-relaxed text-dim sm:flex-row sm:items-center sm:gap-4">
      <span className="flex-1">{t("onDevice")}</span>
      <Link href="/tools/privacy" className="shrink-0 text-ice underline underline-offset-4 hover:text-photon">
        {t("privacyLink")}
      </Link>
    </p>
  );
}
