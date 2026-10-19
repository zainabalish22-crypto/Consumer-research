"use server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/i18n/request";
import { createClient } from "@/lib/supabase/server";

export async function setLocale(locale: "en" | "ar") {
  const value = locale === "ar" ? "ar" : "en";
  (await cookies()).set(LOCALE_COOKIE, value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await supabase.from("profiles").update({ ui_locale: value }).eq("id", user.id);
  } catch {
    // Not configured or not signed in: the cookie alone is enough.
  }
}
