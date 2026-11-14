"use server";

import { redirect } from "next/navigation";
import { checkCredentials, clearFailures, createUser, endSession, normalizeEmail, recordFailure, safeNext, startSession, tooManyAttempts } from "./index";

/** Error codes; the pages show the matching message in the reader's language. */
export type AuthError = "email" | "password" | "exists" | "wrong" | "locked" | "failed";
export type AuthState = { error?: AuthError; email?: string; name?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const locale = (form: FormData) => (form.get("locale") === "ar" ? "ar" : "en");

export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const password = String(form.get("password") ?? "");
  const keep = { email, name };
  if (!EMAIL.test(email) || email.length > 254) return { ...keep, error: "email" };
  if (password.length < 10 || password.length > 200) return { ...keep, error: "password" };
  try {
    const user = await createUser(email, name, password);
    if (!user) return { ...keep, error: "exists" };
    await startSession(user.id);
  } catch (e) {
    console.error("sign-up failed", e instanceof Error ? e.message : e);
    return { ...keep, error: "failed" };
  }
  redirect(safeNext(String(form.get("next") ?? ""), `/${locale(form)}/tools`));
}

export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  if (!EMAIL.test(email) || !password) return { email, error: "wrong" };
  try {
    if (await tooManyAttempts(email)) return { email, error: "locked" };
    const user = await checkCredentials(email, password);
    if (!user) {
      await recordFailure(email);
      return { email, error: "wrong" };
    }
    await clearFailures(email);
    await startSession(user.id);
  } catch (e) {
    console.error("sign-in failed", e instanceof Error ? e.message : e);
    return { email, error: "failed" };
  }
  redirect(safeNext(String(form.get("next") ?? ""), `/${locale(form)}/tools`));
}

export async function signOut(form: FormData) {
  await endSession();
  redirect(`/${locale(form)}/tools`);
}
