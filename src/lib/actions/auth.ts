"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/i18n/request";
import { RESET_COOKIE } from "@/lib/auth-constants";

export type AuthState = { error?: string; notice?: string; email?: string } | undefined;

const safeNext = (next: unknown) =>
  typeof next === "string" && next.startsWith("/studio") && !next.startsWith("//") ? next : "/studio";

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const Email = z.string().trim().toLowerCase().email().max(254);
const Credentials = z.object({ email: Email, password: z.string().min(1).max(200) });

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = Credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "invalidInput" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const code = (error as { code?: string }).code ?? "";
    if (code === "email_not_confirmed" || /confirm/i.test(error.message)) return { error: "emailNotConfirmed", email: parsed.data.email };
    if (error.status === 429) return { error: "rateLimited" };
    return { error: "invalidCredentials", email: parsed.data.email };
  }
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z
    .object({ email: Email, password: z.string().min(8).max(200), displayName: z.string().trim().max(120).optional() })
    .safeParse({
      email: form.get("email"),
      password: form.get("password"),
      displayName: form.get("displayName") || undefined,
    });
  if (!parsed.success) {
    const pw = parsed.error.issues.some((i) => i.path[0] === "password");
    return { error: pw ? "passwordTooShort" : "invalidInput" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${await origin()}/auth/callback`,
      data: { display_name: parsed.data.displayName ?? "", ui_locale: await resolveLocale() },
    },
  });
  if (error) {
    if ((error as { code?: string }).code === "user_already_exists") return { error: "alreadyRegistered", email: parsed.data.email };
    return { error: error.status === 429 ? "rateLimited" : "signUpFailed" };
  }
  // Supabase does not reveal existing accounts: it returns a user with no identities instead.
  if (data.user && (data.user.identities?.length ?? 0) === 0) return { error: "alreadyRegistered", email: parsed.data.email };
  if (data.session) redirect("/studio");
  return { notice: "checkEmail", email: parsed.data.email };
}

/** Send the sign-up confirmation email again. */
export async function resendConfirmation(_: AuthState, form: FormData): Promise<AuthState> {
  const email = Email.safeParse(form.get("email"));
  if (!email.success) return { error: "invalidInput" };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.data,
    options: { emailRedirectTo: `${await origin()}/auth/callback` },
  });
  if (error) return { error: error.status === 429 ? "rateLimited" : "sendFailed", email: email.data };
  return { notice: "confirmationResent", email: email.data };
}

/** Email a password-reset link. The answer is the same whether or not the account exists. */
export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const email = Email.safeParse(form.get("email"));
  if (!email.success) return { error: "invalidInput" };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${await origin()}/auth/callback` });
  if (error?.status === 429) return { error: "rateLimited", email: email.data };
  (await cookies()).set(RESET_COOKIE, "1", { path: "/", maxAge: 60 * 60, httpOnly: true, sameSite: "lax" });
  return { notice: "resetSent", email: email.data };
}

/** Set a new password (the reset link has already signed the user in). */
export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z
    .object({ password: z.string().min(8).max(200), confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ["confirm"] })
    .safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!parsed.success) {
    return { error: parsed.error.issues.some((i) => i.path[0] === "confirm") ? "passwordMismatch" : "passwordTooShort" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "resetExpired" };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: (error as { code?: string }).code === "same_password" ? "samePassword" : "resetFailed" };
  redirect("/studio");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
