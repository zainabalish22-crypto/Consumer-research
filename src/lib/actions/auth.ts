"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/i18n/request";

export type AuthState = { error?: string; notice?: string } | undefined;

const safeNext = (next: unknown) =>
  typeof next === "string" && next.startsWith("/studio") && !next.startsWith("//") ? next : "/studio";

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const Credentials = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(200),
});

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = Credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "invalidInput" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: error.message.toLowerCase().includes("confirm") ? "emailNotConfirmed" : "invalidCredentials" };
  }
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = Credentials.extend({ displayName: z.string().trim().max(120).optional() }).safeParse({
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
    return { error: error.status === 429 ? "rateLimited" : "signUpFailed" };
  }
  if (data.session) redirect("/studio");
  return { notice: "checkEmail" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
