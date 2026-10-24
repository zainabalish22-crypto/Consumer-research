"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cancelInvitation, createTeamWorkspace, inviteMember, removeMember, renameWorkspace, respondToInvitation, setMemberRole } from "@/lib/actions/teams";
import type { WorkspaceInfo } from "@/lib/data";
import { Alert, Badge, Button, Field, Input, Select } from "@/components/ui";

export interface Member {
  user_id: string;
  role: "owner" | "editor" | "viewer";
  display_name: string | null;
  email: string;
}
export interface Invitation {
  id: string;
  email: string;
  role: string;
  workspace_id: string;
  workspace_name?: string;
}

export function TeamSettings({
  userId,
  workspace,
  members,
  invitations,
  myInvitations,
}: {
  userId: string;
  workspace: WorkspaceInfo;
  members: Member[];
  invitations: Invitation[];
  myInvitations: Invitation[];
}) {
  const t = useTranslations("teams");
  const te = useTranslations("errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [newName, setNewName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [rename, setRename] = useState(workspace.name);
  const owner = workspace.role === "owner";
  const team = !workspace.isPersonal;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) =>
    start(async () => {
      setError(null);
      setNotice(null);
      const r = await fn();
      if (!r.ok) return setError(te(r.error ?? "saveFailed"));
      if (done) setNotice(done);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert>{notice}</Alert>}

      {myInvitations.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("yourInvitations")}</h3>
          <ul className="flex flex-col gap-2">
            {myInvitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft p-3 text-sm">
                <span className="flex-1">{t("invitedTo", { workspace: i.workspace_name ?? "", role: t(`roles.${i.role}`) })}</span>
                <Button size="sm" disabled={pending} onClick={() => run(() => respondToInvitation(i.id, true))}>
                  {t("accept")}
                </Button>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => respondToInvitation(i.id, false))}>
                  {t("decline")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t("current", { name: workspace.isPersonal ? t("personal") : workspace.name })}</h3>
        {!team ? (
          <p className="text-sm text-muted">{t("personalHint")}</p>
        ) : (
          <>
            {owner && (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => renameWorkspace(workspace.id, rename), t("renamed"));
                }}
              >
                <Field label={t("name")} htmlFor="ws-name">
                  <Input id="ws-name" value={rename} onChange={(e) => setRename(e.target.value)} maxLength={120} dir="auto" />
                </Field>
                <Button type="submit" variant="secondary" size="sm" disabled={pending || !rename.trim()}>
                  {t("rename")}
                </Button>
              </form>
            )}
            <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
              {members.map((m) => (
                <li key={m.user_id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium" dir="auto">
                      {m.display_name || m.email}
                      {m.user_id === userId && <span className="text-muted"> ({t("you")})</span>}
                    </span>
                    <span className="block truncate text-xs text-muted" dir="ltr">
                      {m.email}
                    </span>
                  </span>
                  {owner && m.user_id !== userId ? (
                    <>
                      <Select aria-label={t("roleFor", { name: m.display_name || m.email })} value={m.role} disabled={pending} onChange={(e) => run(() => setMemberRole(workspace.id, m.user_id, e.target.value))} className="w-auto">
                        {(["owner", "editor", "viewer"] as const).map((r) => (
                          <option key={r} value={r}>
                            {t(`roles.${r}`)}
                          </option>
                        ))}
                      </Select>
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => removeMember(workspace.id, m.user_id))}>
                        {t("remove")}
                      </Button>
                    </>
                  ) : (
                    <Badge>{t(`roles.${m.role}`)}</Badge>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">{t("rolesHint")}</p>

            {owner && (
              <form
                className="flex flex-col gap-2 rounded-lg border border-line p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => inviteMember(workspace.id, email, role), t("invited", { email }));
                  setEmail("");
                }}
              >
                <p className="text-sm font-medium">{t("inviteTitle")}</p>
                <p className="text-xs text-muted">{t("inviteHint")}</p>
                <div className="flex flex-wrap items-end gap-2">
                  <Field label={t("email")} htmlFor="inv-email">
                    <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" className="w-64" />
                  </Field>
                  <Field label={t("role")} htmlFor="inv-role">
                    <Select id="inv-role" value={role} onChange={(e) => setRole(e.target.value as "editor" | "viewer")} className="w-auto">
                      <option value="editor">{t("roles.editor")}</option>
                      <option value="viewer">{t("roles.viewer")}</option>
                    </Select>
                  </Field>
                  <Button type="submit" size="sm" disabled={pending || !email.trim()}>
                    {t("invite")}
                  </Button>
                </div>
              </form>
            )}
            {owner && invitations.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{t("pending")}</p>
                <ul className="flex flex-col gap-1 text-sm">
                  {invitations.map((i) => (
                    <li key={i.id} className="flex items-center gap-2">
                      <span className="flex-1 truncate" dir="ltr">
                        {i.email}
                      </span>
                      <Badge>{t(`roles.${i.role}`)}</Badge>
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => cancelInvitation(i.id))}>
                        {t("cancelInvite")}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!owner && (
              <Button variant="secondary" size="sm" className="self-start" disabled={pending} onClick={() => run(() => removeMember(workspace.id, userId))}>
                {t("leave")}
              </Button>
            )}
          </>
        )}
      </section>

      <form
        className="flex flex-wrap items-end gap-2 border-t border-line pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createTeamWorkspace(newName), t("created"));
          setNewName("");
        }}
      >
        <Field label={t("newTeam")} htmlFor="new-team">
          <Input id="new-team" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={120} placeholder={t("newTeamPlaceholder")} dir="auto" className="w-64" />
        </Field>
        <Button type="submit" variant="secondary" size="sm" disabled={pending || !newName.trim()}>
          {t("create")}
        </Button>
      </form>
    </div>
  );
}
