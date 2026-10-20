"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { requestPasswordReset, resendConfirmation, signIn, signUp, type AuthState } from "@/lib/actions/auth";
import { Alert, Button, Card, Field, Input, cx } from "@/components/ui";

type Mode = "signin" | "signup" | "forgot";

export function AuthForms({ next, initialMode }: { next: string; initialMode: Mode }) {
  const t = useTranslations("auth");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [inState, inAction, inPending] = useActionState<AuthState, FormData>(signIn, undefined);
  const [upState, upAction, upPending] = useActionState<AuthState, FormData>(signUp, undefined);
  const [fgState, fgAction, fgPending] = useActionState<AuthState, FormData>(requestPasswordReset, undefined);
  const [rsState, rsAction, rsPending] = useActionState<AuthState, FormData>(resendConfirmation, undefined);
  const state = mode === "signin" ? inState : mode === "signup" ? upState : fgState;
  const pending = mode === "signin" ? inPending : mode === "signup" ? upPending : fgPending;
  const action = mode === "signin" ? inAction : mode === "signup" ? upAction : fgAction;
  const knownEmail = state?.email ?? email;

  return (
    <Card className="flex flex-col gap-5">
      {mode !== "forgot" ? (
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg bg-paper p-1">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cx("rounded-md px-3 py-1.5 text-sm font-medium", mode === m ? "bg-surface shadow-sm" : "text-muted hover:text-ink")}
            >
              {t(m === "signin" ? "signIn" : "createAccount")}
            </button>
          ))}
        </div>
      ) : (
        <div>
          <h1 className="text-lg font-semibold">{t("forgotTitle")}</h1>
          <p className="text-sm text-muted">{t("forgotHint")}</p>
        </div>
      )}

      {state?.error && <Alert tone="danger">{t(`errors.${state.error}`)}</Alert>}
      {state?.notice && <Alert tone="ok">{t(`notices.${state.notice}`)}</Alert>}

      {/* Recovery shortcuts after a failed sign-in or sign-up */}
      {(state?.error === "emailNotConfirmed" || state?.notice === "checkEmail") && (
        <form action={rsAction} className="flex flex-col gap-2 rounded-lg bg-paper p-3 text-sm">
          <input type="hidden" name="email" value={knownEmail} />
          {rsState?.error && <Alert tone="danger">{t(`errors.${rsState.error}`)}</Alert>}
          {rsState?.notice && <Alert tone="ok">{t(`notices.${rsState.notice}`)}</Alert>}
          <Button type="submit" variant="secondary" size="sm" className="self-start" disabled={rsPending}>
            {t("resendConfirmation")}
          </Button>
        </form>
      )}
      {(state?.error === "invalidCredentials" || state?.error === "alreadyRegistered") && (
        <div className="flex flex-wrap gap-2 text-sm">
          {state.error === "alreadyRegistered" && (
            <Button variant="secondary" size="sm" onClick={() => setMode("signin")}>
              {t("signIn")}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => setMode("forgot")}>
            {t("forgotPassword")}
          </Button>
        </div>
      )}

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        {mode === "signup" && (
          <Field label={t("displayName")} htmlFor="displayName" hint={t("displayNameHint")}>
            <Input id="displayName" name="displayName" autoComplete="name" maxLength={120} />
          </Field>
        )}
        <Field label={t("email")} htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {mode !== "forgot" && (
          <Field label={t("password")} htmlFor="password" hint={mode === "signup" ? t("passwordHint") : undefined}>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={mode === "signup" ? 8 : 1}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              dir="ltr"
            />
          </Field>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? t("working") : t(mode === "signin" ? "signIn" : mode === "signup" ? "createAccount" : "sendResetLink")}
        </Button>
      </form>

      <div className="flex justify-between text-sm">
        {mode === "signin" && (
          <button type="button" className="text-accent hover:underline" onClick={() => setMode("forgot")}>
            {t("forgotPassword")}
          </button>
        )}
        {mode === "forgot" && (
          <button type="button" className="text-accent hover:underline" onClick={() => setMode("signin")}>
            {t("backToSignIn")}
          </button>
        )}
      </div>
    </Card>
  );
}
