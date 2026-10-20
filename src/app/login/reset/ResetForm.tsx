"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updatePassword, type AuthState } from "@/lib/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export function ResetForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error && <Alert tone="danger">{t(`errors.${state.error}`)}</Alert>}
      <Field label={t("newPassword")} htmlFor="password" hint={t("passwordHint")}>
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" dir="ltr" />
      </Field>
      <Field label={t("confirmPassword")} htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" dir="ltr" />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? t("working") : t("savePassword")}
      </Button>
    </form>
  );
}
