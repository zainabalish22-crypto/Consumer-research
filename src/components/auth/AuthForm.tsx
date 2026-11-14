"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { Link } from "@/i18n/navigation";
import { signIn, signUp, type AuthState } from "@/lib/auth/actions";

const input = "w-full min-h-12 rounded-md border border-line-2 bg-void px-3 text-[16px] text-photon placeholder:text-faint focus:border-ice focus:outline-none";

/** Sign-in or sign-up form. Works without JavaScript; errors are announced to screen readers. */
export function AuthForm({ mode, next }: { mode: "in" | "up"; next?: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "in" ? signIn : signUp, {});
  const id = useId();
  const errId = `${id}-err`;
  const query = next ? { next } : undefined;
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-light">{t(mode === "in" ? "signIn" : "signUp")}</h1>
        <p className="text-dim">{t(mode === "in" ? "signInIntro" : "signUpIntro")}</p>
      </div>
      <form action={action} className="flex flex-col gap-4 rounded-lg border border-line-2 bg-carbon p-6" aria-describedby={state.error ? errId : undefined}>
        <input type="hidden" name="locale" value={locale} />
        {next && <input type="hidden" name="next" value={next} />}
        {mode === "up" && (
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-mist">
            {t("name")}
            <input name="name" autoComplete="name" defaultValue={state.name} maxLength={120} className={input} />
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-mist">
          {t("email")}
          <input name="email" type="email" required dir="ltr" autoComplete="email" defaultValue={state.email} className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-mist">
          {t("password")}
          <input name="password" type="password" required dir="ltr" minLength={mode === "up" ? 10 : undefined} autoComplete={mode === "in" ? "current-password" : "new-password"} className={input} />
          {mode === "up" && <span className="font-normal text-faint">{t("passwordHint")}</span>}
        </label>
        {state.error && (
          <p id={errId} role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
            {t(`errors.${state.error}`)}
          </p>
        )}
        <button type="submit" disabled={pending} className="tracked min-h-12 bg-photon px-6 font-semibold uppercase tracking-[0.05em] text-void hover:bg-white disabled:opacity-50">
          {pending ? t("wait") : t(mode === "in" ? "signIn" : "signUp")}
        </button>
      </form>
      <p className="text-sm text-dim">
        {t(mode === "in" ? "noAccount" : "haveAccount")}{" "}
        <Link href={{ pathname: mode === "in" ? "/sign-up" : "/sign-in", query }} className="text-ice underline underline-offset-4 hover:text-photon">
          {t(mode === "in" ? "signUp" : "signIn")}
        </Link>
      </p>
      {mode === "up" && <p className="text-xs leading-relaxed text-faint">{t("noReset")}</p>}
    </main>
  );
}
