"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { deleteTestSessions, setSessionExcluded } from "@/lib/actions/studio";
import { Button, Input } from "@/components/ui";
import { Checkbox } from "@/components/builder/controls";

export function ExportLinks({ studyId, hasVersions }: { studyId: string; hasVersions: boolean }) {
  const t = useTranslations("data.export");
  const [includeTest, setIncludeTest] = useState(false);
  if (!hasVersions) return <p className="text-sm text-muted">{t("nothing")}</p>;
  const href = (kind: string) => `/api/studies/${studyId}/export?kind=${kind}${includeTest ? "&test=1" : ""}`;
  const link = "rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium hover:bg-paper";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <a className={link} href={href("wide")} download>
          {t("wide")}
        </a>
        <a className={link} href={href("codebook")} download>
          {t("codebook")}
        </a>
        <a className={link} href={href("events")} download>
          {t("events")}
        </a>
        <a className={link} href={`${href("spss")}&lang=en`} download>
          {t("spssEn")}
        </a>
        <a className={link} href={`${href("spss")}&lang=ar`} download>
          {t("spssAr")}
        </a>
        <a className={link} href={href("config")} download>
          {t("config")}
        </a>
      </div>
      <Checkbox label={t("includeTest")} hint={t("includeTestHint")} checked={includeTest} onChange={setIncludeTest} />
      <p className="text-xs text-muted">{t("note")}</p>
    </div>
  );
}

export function ExclusionToggle({ studyId, sessionId, excluded, reason }: { studyId: string; sessionId: string; excluded: boolean; reason: string }) {
  const t = useTranslations("data");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(reason);
  const [pending, start] = useTransition();
  if (excluded && !editing) {
    return (
      <span className="flex items-center gap-2">
        <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs text-warn" title={reason}>
          {t("excludedFlag")}
        </span>
        <button type="button" className="text-xs underline" disabled={pending} onClick={() => start(async () => void (await setSessionExcluded(studyId, sessionId, false, "")))}>
          {t("include")}
        </button>
      </span>
    );
  }
  if (!editing) {
    return (
      <button type="button" className="text-xs text-muted underline" onClick={() => setEditing(true)}>
        {t("exclude")}
      </button>
    );
  }
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await setSessionExcluded(studyId, sessionId, true, text);
          setEditing(false);
        });
      }}
    >
      <label htmlFor={`ex-${sessionId}`} className="sr-only">
        {t("reason")}
      </label>
      <Input id={`ex-${sessionId}`} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("reason")} className="h-8 w-36 py-1 text-xs" dir="auto" />
      <Button type="submit" size="sm" disabled={pending}>
        {t("exclude")}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
        {t("cancel")}
      </Button>
    </form>
  );
}

export function DeleteTestSessions({ studyId }: { studyId: string }) {
  const t = useTranslations("data");
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return confirm ? (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm">
      <span className="text-danger">{t("deleteTestConfirm")}</span>
      <Button variant="danger" size="sm" disabled={pending} onClick={() => start(async () => void (await deleteTestSessions(studyId)))}>
        {t("deleteTestYes")}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
        {t("cancel")}
      </Button>
    </div>
  ) : (
    <Button variant="secondary" size="sm" className="self-start" onClick={() => setConfirm(true)}>
      {t("deleteTest")}
    </Button>
  );
}
