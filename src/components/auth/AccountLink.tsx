"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { signOut } from "@/lib/auth/actions";

/** Header account area: "Sign in" for visitors, or the researcher's email and "Sign out". */
export function AccountLink() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [user, setUser] = useState<{ email: string } | null | undefined>(undefined);
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUser(d.user ?? null))
      .catch(() => setUser(null));
  }, []);
  // Reserve the space while loading, so the header does not jump.
  if (user === undefined) return <span className="h-11 w-20" aria-hidden="true" />;
  if (!user)
    return (
      <Link href="/sign-in" className="inline-flex min-h-11 items-center px-3 text-sm hover:text-signal">
        {t("signIn")}
      </Link>
    );
  return (
    <form action={signOut} className="flex items-center gap-2 text-sm">
      <input type="hidden" name="locale" value={locale} />
      <span dir="ltr" className="hidden max-w-[180px] truncate text-dim sm:inline" title={user.email}>
        {user.email}
      </span>
      <button type="submit" className="min-h-11 px-3 hover:text-signal">
        {t("signOut")}
      </button>
    </form>
  );
}
