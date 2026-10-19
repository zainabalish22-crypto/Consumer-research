"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateProfile } from "@/lib/actions/studio";
import { createClient } from "@/lib/supabase/client";
import { Alert, Button, Field, Input } from "@/components/ui";

export function ProfileForm({ displayName }: { displayName: string }) {
  const t = useTranslations("settings");
  const te = useTranslations("errors");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      action={(form) =>
        start(async () => {
          const r = await updateProfile(form);
          setMsg(r.ok ? { ok: true, text: t("saved") } : { ok: false, text: te(r.error) });
        })
      }
    >
      {msg && <Alert tone={msg.ok ? "ok" : "danger"}>{msg.text}</Alert>}
      <Field label={t("displayName")} htmlFor="display_name">
        <Input id="display_name" name="display_name" defaultValue={displayName} maxLength={120} dir="auto" />
      </Field>
      <Button type="submit" disabled={pending} className="self-start">
        {t("save")}
      </Button>
    </form>
  );
}

export function DeleteAccount({ workspaceId, email }: { workspaceId: string; email: string }) {
  const t = useTranslations("settings");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      setError(null);
      const supabase = createClient();
      // Remove media files first; Storage is not cascaded by the database.
      for (;;) {
        const { data } = await supabase.storage.from("media").list(workspaceId, { limit: 100 });
        if (!data?.length) break;
        const { error: rmErr } = await supabase.storage.from("media").remove(data.map((f) => `${workspaceId}/${f.name}`));
        if (rmErr) return setError(t("deleteFailed"));
      }
      const { error: delErr } = await supabase.rpc("delete_my_account");
      if (delErr) return setError(t("deleteFailed"));
      await supabase.auth.signOut();
      window.location.assign("/");
    });
  return (
    <div className="flex flex-col gap-2">
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label={t("typeEmail", { email })} htmlFor="del-account">
        <Input id="del-account" value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="ltr" />
      </Field>
      <Button variant="danger" className="self-start" disabled={pending || confirm.trim() !== email} onClick={run}>
        {t("deleteButton")}
      </Button>
    </div>
  );
}
