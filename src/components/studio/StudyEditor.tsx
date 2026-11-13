"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { repo } from "@/lib/study/repo";
import type { Study } from "@/lib/study/types";
import { ResponsesPanel } from "./ResponsesPanel";
import { FormEditor } from "./FormEditor";
import { ShopEditor } from "./ShopEditor";
import { Button, Icon, MediaInput, Select, TextInput, inputCls } from "./ui";

type Tab = "flow" | "shop" | "settings" | "data";

/** Loads one study and saves every change shortly after it is made. */
function useStudy(id: string) {
  const [study, setStudy] = useState<Study | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef<Study | null>(null);
  useEffect(() => {
    repo.getStudy(id).then((s) => {
      latest.current = s ?? null;
      setStudy(s ?? null);
    });
  }, [id]);
  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (latest.current) await repo.saveStudy(latest.current);
    setSaving(false);
  }, []);
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
      if (latest.current) repo.saveStudy(latest.current);
    };
    window.addEventListener("pagehide", out);
    return () => {
      window.removeEventListener("pagehide", out);
      window.clearTimeout(timer.current);
    };
  }, []);
  return { study, update, saving, flush };
}

export function StudyEditor({ id }: { id: string }) {
  const t = useTranslations("studio");
  const locale = useLocale();
  const { study, update, saving, flush } = useStudy(id);
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
  const tabs: Tab[] = hasShop ? ["flow", "shop", "data", "settings"] : ["flow", "data", "settings"];
  const link = typeof window !== "undefined" ? `${window.location.origin}/${study.languages[0] ?? locale}/s/${study.id}` : "";

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link href="/studio" className="text-sm text-faint hover:text-photon">
            ← {t("back")}
          </Link>
          <h1 className="truncate font-display text-3xl font-light">{study.name}</h1>
          <span className="font-mono text-xs text-faint">
            {t(`kind.${study.kind}`)} · {study.status === "published" ? t("published", { v: study.version }) : t("status.draft")} · <span aria-live="polite">{saving ? t("saving") : t("saved")}</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              await flush();
              window.open(`/${study.languages[0] ?? locale}/s/${study.id}?test=1`, "_blank", "noopener");
            }}
          >
            {t("preview")}
          </Button>
          {study.status === "draft" ? (
            <Button kind="primary" onClick={() => update((s) => ({ ...s, status: "published" }))}>
              {t("publish")}
            </Button>
          ) : (
            <Button onClick={() => update((s) => ({ ...s, status: "draft", version: s.version + 1 }))}>{t("unpublish")}</Button>
          )}
        </div>
      </div>

      {study.status === "published" && (
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
          <p className="text-xs text-faint">{t("localLinkNote")}</p>
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
    </div>
  );
}
