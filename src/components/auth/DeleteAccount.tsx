"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * Permanently deletes the researcher's account, studies, responses and uploaded files. The
 * researcher types their email to confirm, so it cannot happen by a stray click.
 */
export function DeleteAccount({ email, home }: { email: string; home: string }) {
  const t = useTranslations("account");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const match = typed.trim().toLowerCase() === email.toLowerCase();
  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-danger/60 bg-carbon p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!match || busy) return;
        setBusy(true);
        setError(false);
        const res = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: typed }) }).catch(() => null);
        if (res?.ok) window.location.href = home;
        else {
          setBusy(false);
          setError(true);
        }
      }}
    >
      <h2 className="font-display text-xl">{t("deleteTitle")}</h2>
      <p className="text-sm leading-relaxed text-dim">{t("deleteBody")}</p>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-mist">
        {t("deleteConfirm", { email })}
        <input value={typed} onChange={(e) => setTyped(e.target.value)} type="email" dir="ltr" autoComplete="off" className="min-h-11 rounded-md border border-line-2 bg-void px-3 text-[15px] text-photon focus:border-ice focus:outline-none" />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {t("deleteFailed")}
        </p>
      )}
      <button type="submit" disabled={!match || busy} className="min-h-11 self-start rounded-md bg-danger px-5 font-semibold text-white disabled:opacity-40">
        {busy ? t("deleting") : t("deleteButton")}
      </button>
    </form>
  );
}
