"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useOfferToAssistant } from "@/lib/assistant/context";
import { studyOutline } from "@/lib/assistant/outline";
import { repo, type StudyMeta } from "@/lib/study/repo";
import { DEFAULT_SETTINGS, type Study, type StudySettings } from "@/lib/study/types";
import { cells } from "@/lib/study/engine";
import { DesignPanel } from "./DesignPanel";
import { ResponsesPanel } from "./ResponsesPanel";
import { FormEditor } from "./FormEditor";
import { ShopEditor } from "./ShopEditor";
import { Button, Icon, MediaInput, Select, TextInput, inputCls } from "./ui";

type Tab = "flow" | "design" | "shop" | "settings" | "data";

/** Loads one study from the account and saves every change shortly after it is made. */
function useStudy(id: string) {
  const [study, setStudy] = useState<Study | null | undefined>(undefined);
  const [meta, setMeta] = useState<StudyMeta | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef<Study | null>(null);
  useEffect(() => {
    repo.getStudy(id).then(
      (row) => {
        latest.current = row?.study ?? null;
        setStudy(row?.study ?? null);
        setMeta(row?.meta ?? null);
      },
      () => setStudy(null),
    );
  }, [id]);
  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (latest.current) {
      try {
        setMeta(await repo.saveStudy(latest.current));
        setSaveFailed(false);
      } catch {
        setSaveFailed(true);
      }
    }
    setSaving(false);
  }, []);
  /** Saves pending edits, then locks the draft as the next published version. */
  const publish = useCallback(async () => {
    await flush();
    const row = await repo.publish(id);
    latest.current = row.study;
    setStudy(row.study);
    setMeta(row.meta);
  }, [flush, id]);
  const update = useCallback(
    (fn: (s: Study) => Study) => {
      setStudy((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        latest.current = next;
        return next;
      });
      setSaving(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 400);
    },
    [flush],
  );
  // Save anything pending when leaving the page.
  useEffect(() => {
    const out = () => {
      if (latest.current) repo.saveStudy(latest.current).catch(() => {});
    };
    window.addEventListener("pagehide", out);
    return () => {
      window.removeEventListener("pagehide", out);
      window.clearTimeout(timer.current);
    };
  }, []);
  return { study, meta, update, saving, saveFailed, flush, publish };
}

export function StudyEditor({ id }: { id: string }) {
  const t = useTranslations("studio");
  const locale = useLocale();
  const { study, meta, update, saving, saveFailed, flush, publish } = useStudy(id);
  const [publishing, setPublishing] = useState(false);
  const [previewAs, setPreviewAs] = useState("");
  // The assistant can read the study's wording and structure (never its responses).
  useOfferToAssistant(study ? { title: study.name, detail: studyOutline(study) } : null);
  const [tab, setTab] = useState<Tab>("flow");
  const [copied, setCopied] = useState(false);

  if (study === undefined) return <p className="p-8 text-dim">{t("loading")}</p>;
  if (study === null)
    return (
      <div className="flex flex-col items-start gap-4 p-8">
        <p className="text-dim">{t("notFound")}</p>
        <Link href="/studio" className="text-signal">
          {t("back")}
        </Link>
      </div>
    );

  const hasShop = study.blocks.some((b) => b.type === "shop");
  const tabs: Tab[] = hasShop ? ["flow", "design", "shop", "data", "settings"] : ["flow", "design", "data", "settings"];
  // Preview as a particular condition (one entry per combination of between-subjects levels).
  const combos = cells(study.design).filter((c) => Object.keys(c).length > 0);
  const comboLabel = (c: Record<string, string>) =>
    Object.entries(c)
      .map(([fid, lid]) => {
        const f = study.design?.factors.find((x) => x.id === fid);
        const l = f?.levels.find((x) => x.id === lid);
        return `${f?.name}: ${l?.label[study.languages[0] ?? "en"] || l?.value}`;
      })
      .join(" · ");
  const settings: StudySettings = { ...DEFAULT_SETTINGS, ...study.settings };
  const link = typeof window !== "undefined" ? `${window.location.origin}/${study.languages[0] ?? locale}/s/${study.id}` : "";
  const published = meta?.publishedVersion ?? null;
  const closedNow = !!settings.closed || (!!settings.closesAt && Date.parse(settings.closesAt) < Date.now());
  async function doPublish() {
    setPublishing(true);
    try {
      await publish();
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link href="/studio" className="text-sm text-faint hover:text-photon">
            ← {t("back")}
          </Link>
          <h1 className="truncate font-display text-3xl font-light">{study.name}</h1>
          <span className="font-mono text-xs text-faint">
            {t(`kind.${study.kind}`)} · {published ? t("published", { v: published }) : t("status.draft")}
            {published && meta?.changedSincePublish ? ` · ${t("unpublishedChanges")}` : ""}
            {published && closedNow ? ` · ${t("closedBadge")}` : ""} ·{" "}
            <span aria-live="polite" className={saveFailed ? "text-warn" : undefined}>
              {saveFailed ? t("saveFailed") : saving ? t("saving") : t("saved")}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {combos.length > 0 && (
            <select aria-label={t("previewAs")} value={previewAs} onChange={(e) => setPreviewAs(e.target.value)} className="min-h-11 max-w-[16rem] rounded-md border border-line-3 bg-void px-3 text-sm text-photon">
              <option value="">{t("previewRandom")}</option>
              {combos.map((c) => (
                <option key={JSON.stringify(c)} value={Object.entries(c).map(([fid, lid]) => `${fid}:${lid}`).join(",")}>
                  {comboLabel(c)}
                </option>
              ))}
            </select>
          )}
          <Button
            onClick={async () => {
              await flush();
              const cond = previewAs ? `&cond=${encodeURIComponent(previewAs)}` : "";
              window.open(`/${study.languages[0] ?? locale}/s/${study.id}?test=1${cond}`, "_blank", "noopener");
            }}
          >
            {t("preview")}
          </Button>
          {!published ? (
            <Button kind="primary" disabled={publishing} onClick={doPublish}>
              {t("publish")}
            </Button>
          ) : (
            <>
              {meta?.changedSincePublish && (
                <Button kind="primary" disabled={publishing} onClick={() => window.confirm(t("confirmRepublish", { v: published + 1 })) && doPublish()}>
                  {t("publishChanges", { v: published + 1 })}
                </Button>
              )}
              <Button onClick={() => update((s) => ({ ...s, settings: { ...settings, closed: !settings.closed } }))}>{settings.closed ? t("reopen") : t("close")}</Button>
            </>
          )}
        </div>
      </div>

      {published && (
        <div className="flex flex-col gap-2 rounded-lg border border-line-2 bg-carbon p-4">
          <span className="text-[13px] font-medium text-mist">{t("participantLink")}</span>
          <div className="flex gap-2">
            <input readOnly value={link} dir="ltr" aria-label={t("participantLink")} className={inputCls} onFocus={(e) => e.target.select()} />
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {Icon.copy}
              {copied ? t("copied") : t("copy")}
            </Button>
          </div>
          <p className="text-xs text-faint">{t("panelLinkNote", { param: settings.panelParam })}</p>
        </div>
      )}

      <div role="tablist" aria-label={study.name} className="flex justify-center gap-1 overflow-x-auto border-b border-line-2">
        {tabs.map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`min-h-11 whitespace-nowrap border-b-2 px-4 text-sm font-semibold ${tab === k ? "border-signal text-photon" : "border-transparent text-faint hover:text-photon"}`}
          >
            {t(`tabs.${k}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "flow" && <FormEditor study={study} update={update} openShop={() => setTab("shop")} />}
        {tab === "design" && <DesignPanel study={study} update={update} />}
        {tab === "shop" && hasShop && study.shop && <ShopEditor study={study} update={update} />}
        {tab === "settings" && <Settings study={study} update={update} />}
        {tab === "data" && <ResponsesPanel study={study} />}
      </div>
    </main>
  );
}

const SWATCHES = ["#1F5C4E", "#673AB7", "#3F51B5", "#1A73E8", "#00796B", "#D93025", "#E8710A", "#5F6368"];

function Settings({ study, update }: { study: Study; update: (fn: (s: Study) => Study) => void }) {
  const t = useTranslations("studio.settings");
  const lang = study.languages[0] ?? "en";
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <TextInput label={t("name")} value={study.name} onChange={(v) => update((s) => ({ ...s, name: v }))} />
      <div className="flex flex-col gap-1.5">
        <Select
          label={t("language")}
          value={lang}
          onChange={(v) => update((s) => ({ ...s, languages: [v] }))}
          options={[
            ["en", t("en")],
            ["ar", t("ar")],
          ]}
        />
        <p className="text-xs text-faint">{t("languageHint")}</p>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-display text-lg">{t("theme")}</legend>
        <span className="text-[13px] font-medium text-mist">{t("accent")}</span>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((c) => {
            const on = study.accent.toLowerCase() === c.toLowerCase();
            return <button key={c} type="button" aria-label={c} aria-pressed={on} onClick={() => update((s) => ({ ...s, accent: c }))} className={"h-11 w-11 rounded-full border-2 " + (on ? "border-photon" : "border-transparent")} style={{ background: c }} />;
          })}
          <label className="flex items-center gap-2 text-[13px] text-mist">
            <input type="color" value={study.accent} onChange={(e) => update((s) => ({ ...s, accent: e.target.value }))} className="h-11 w-14 cursor-pointer rounded-md border border-line-2 bg-void" />
            {t("custom")}
          </label>
        </div>
        <MediaInput label={t("header")} value={study.header} onChange={(v) => update((s) => ({ ...s, header: v }))} />
        <p className="-mt-1 text-xs text-faint">{t("headerHint")}</p>
      </fieldset>
      <RunSettings study={study} update={update} />
    </div>
  );
}

/** Who may take part, until when, and where panel participants are sent back to. */
function RunSettings({ study, update }: { study: Study; update: (fn: (s: Study) => Study) => void }) {
  const t = useTranslations("studio.run");
  const st: StudySettings = { ...DEFAULT_SETTINGS, ...study.settings };
  const set = (patch: Partial<StudySettings>) => update((s) => ({ ...s, settings: { ...DEFAULT_SETTINGS, ...s.settings, ...patch } }));
  const setReturn = (k: keyof StudySettings["returns"], v: string) => set({ returns: { ...st.returns, [k]: v.trim() || undefined } });
  const badUrl = (v?: string) => !!v && !/^https:\/\//.test(v);
  // datetime-local works in local time; store the moment as ISO.
  const local = st.closesAt ? new Date(Date.parse(st.closesAt) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
  return (
    <fieldset className="flex flex-col gap-5">
      <legend className="mb-2 font-display text-lg">{t("title")}</legend>
      <div className="flex flex-col gap-1.5">
        <Select
          label={t("repeat")}
          value={st.repeat}
          onChange={(v) => set({ repeat: v as StudySettings["repeat"] })}
          options={[
            ["both", t("repeatBoth")],
            ["device", t("repeatDevice")],
            ["panel", t("repeatPanel")],
            ["allow", t("repeatAllow")],
          ]}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <TextInput label={t("panelParam")} value={st.panelParam} onChange={(v) => set({ panelParam: v.replace(/[^\w-]/g, "").slice(0, 40) || "pid" })} />
        <p className="text-xs text-faint">{t("panelParamHint")}</p>
      </div>
      <div className="flex flex-col gap-3">
        <span className="text-[13px] font-medium text-mist">{t("returns")}</span>
        <p className="-mt-2 text-xs text-faint">{t("returnsHint")}</p>
        {(["completed", "screened", "declined"] as const).map((k) => (
          <div key={k} className="flex flex-col gap-1">
            <TextInput label={t(`return.${k}`)} value={st.returns[k] ?? ""} onChange={(v) => setReturn(k, v)} />
            {badUrl(st.returns[k]) && <p className="text-xs text-warn">{t("httpsOnly")}</p>}
          </div>
        ))}
      </div>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-mist">
        {t("closesAt")}
        <input type="datetime-local" value={local} onChange={(e) => set({ closesAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} className={inputCls} />
        <span className="text-xs font-normal text-faint">{t("closesAtHint")}</span>
      </label>
    </fieldset>
  );
}
