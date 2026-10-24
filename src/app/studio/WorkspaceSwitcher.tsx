"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { switchWorkspace } from "@/lib/actions/teams";
import type { WorkspaceInfo } from "@/lib/data";

/** Shown only when the researcher belongs to more than one workspace. */
export function WorkspaceSwitcher({ workspaces, currentId }: { workspaces: WorkspaceInfo[]; currentId: string }) {
  const t = useTranslations("teams");
  const router = useRouter();
  const [pending, start] = useTransition();
  const current = workspaces.find((w) => w.id === currentId);
  if (workspaces.length < 2) return null;
  return (
    <label className="flex items-center gap-1.5 text-sm">
      <span className="sr-only">{t("switchLabel")}</span>
      <select
        className="max-w-48 rounded-lg border border-line bg-surface px-2 py-1.5"
        value={currentId}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            const r = await switchWorkspace(e.target.value);
            if (r.ok) router.push("/studio");
          })
        }
        aria-label={t("switchLabel")}
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.isPersonal ? t("personal") : w.name}
          </option>
        ))}
      </select>
      {current?.role === "viewer" && <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{t("viewOnly")}</span>}
    </label>
  );
}
