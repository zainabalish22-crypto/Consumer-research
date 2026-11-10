"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { codebookCsv, download, eventsCsv, participantsCsv } from "@/lib/study/export";
import { onDataChange, repo } from "@/lib/study/repo";
import type { Session, Study } from "@/lib/study/types";
import { Button, Icon, IconButton } from "./ui";

/** Responses saved in this browser, and the CSV exports. */
export function DataPanel({ study }: { study: Study }) {
  const t = useTranslations("studio.data");
  const format = useFormatter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const load = useCallback(() => repo.listSessions(study.id).then(setSessions), [study.id]);
  useEffect(() => {
    load();
    return onDataChange(load);
  }, [load]);
  const slug = study.name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "study";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button kind="primary" onClick={() => download(`${slug}-participants.csv`, participantsCsv(study, sessions))} disabled={!sessions.length}>
          {t("participants")}
        </Button>
        <Button onClick={() => download(`${slug}-events.csv`, eventsCsv(sessions))} disabled={!sessions.length}>
          {t("events")}
        </Button>
        <Button onClick={() => download(`${slug}-codebook.csv`, codebookCsv(study))}>{t("codebook")}</Button>
      </div>
      <p className="-mt-3 text-xs text-faint">{t("exportNote")}</p>

      <h2 className="font-display text-xl">{t("title")}</h2>
      {sessions.length === 0 ? (
        <p className="text-dim">{t("none")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line-2">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-carbon text-start font-mono text-xs text-faint">
              <tr>
                <th scope="col" className="p-3 text-start font-normal">ID</th>
                <th scope="col" className="p-3 text-start font-normal">{t("type")}</th>
                <th scope="col" className="p-3 text-start font-normal">{t("status")}</th>
                <th scope="col" className="p-3 text-start font-normal">{t("started")}</th>
                <th scope="col" className="p-3 text-start font-normal">{t("duration")}</th>
                <th scope="col" className="p-3"><span className="sr-only">{t("deleteSession")}</span></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const dur = s.finishedAt ? Math.round((Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 1000) : null;
                return (
                  <tr key={s.id} className="border-t border-line-2">
                    <td className="p-3 font-mono text-xs" dir="ltr">{s.id.slice(0, 8)}</td>
                    <td className="p-3">{s.test ? <span className="text-faint">{t("test")}</span> : t("real")}</td>
                    <td className="p-3">
                      {t(s.status)}
                      {s.flags.length > 0 && <span className="ms-2 text-warn">· {t("flagged")}</span>}
                    </td>
                    <td className="p-3">{format.dateTime(new Date(s.startedAt), { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className="p-3 font-mono" dir="ltr">{dur === null ? "—" : `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, "0")}`}</td>
                    <td className="p-1 text-end">
                      <IconButton label={t("deleteSession")} onClick={() => repo.deleteSession(s.id)}>
                        {Icon.x}
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
