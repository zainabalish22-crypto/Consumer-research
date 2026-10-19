"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { signIn, signUp, type AuthState } from "@/lib/actions/auth";
import { Alert, Button, Card, Field, Input, cx } from "@/components/ui";

export function AuthForms({ next, initialMode }: { next: string; initialMode: "signin" | "signup" }) {
  const t = useTranslations("auth");
  const [mode, setMode] = useState(initialMode);
  const [inState, inAction, inPending] = useActionState<AuthState, FormData>(signIn, undefined);
  const [upState, upAction, upPending] = useActionState<AuthState, FormData>(signUp, undefined);
  const state = mode === "signin" ? inState : upState;
  const pending = mode === "signin" ? inPending : upPending;

  return (
    <Card className="flex flex-col gap-5">
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg bg-paper p-1">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cx(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              mode === m ? "bg-surface shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {t(m === "signin" ? "signIn" : "createAccount")}
          </button>
        ))}
      </div>

      {state?.error && <Alert tone="danger">{t(`errors.${state.error}`)}</Alert>}
      {state?.notice && <Alert tone="ok">{t(`notices.${state.notice}`)}</Alert>}

      <form action={mode === "signin" ? inAction : upAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        {mode === "signup" && (
          <Field label={t("displayName")} htmlFor="displayName" hint={t("displayNameHint")}>
            <Input id="displayName" name="displayName" autoComplete="name" maxLength={120} />
          </Field>
        )}
        <Field label={t("email")} htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" dir="ltr" />
        </Field>
        <Field label={t("password")} htmlFor="password" hint={mode === "signup" ? t("passwordHint") : undefined}>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            dir="ltr"
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? t("working") : t(mode === "signin" ? "signIn" : "createAccount")}
        </Button>
      </form>
    </Card>
  );
}
