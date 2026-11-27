"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { newStudy } from "@/lib/study/defaults";
import { localRepo } from "@/lib/study/localRepo";
import { onDataChange, repo, type StudyListRow } from "@/lib/study/repo";
import type { Study } from "@/lib/study/types";
import { uid } from "@/lib/study/util";
import { Button } from "./ui";

const DISMISS_KEY = "asdaa-import-dismissed";

/** Replaces every "media:<id>" reference with the uploaded file's address. */
function rewriteMedia<T>(value: T, map: Map<string, string>): T {
  return JSON.parse(JSON.stringify(value), (_k, v) => (typeof v === "string" && map.has(v) ? map.get(v) : v));
}

function mediaRefs(value: unknown): string[] {
  const found = new Set<string>();
  JSON.stringify(value, (_k, v) => {
    if (typeof v === "string" && v.startsWith("media:")) found.add(v);
    return v;
  });
  return [...found];
}

/**
 * Studies made in this browser before accounts existed, offered once for import. Their images
 * and videos are uploaded on the way; they arrive as drafts, to be published again.
 */
function ImportBanner({ existing }: { existing: string }) {
  const t = useTranslations("studio.import");
  const [local, setLocal] = useState<Study[]>([]);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ ok: number; failed: number } | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (dismissed) return;
    localRepo
      .listStudies()
      .then((list) => {
        const have = new Set(existing.split(" "));
        const waiting = list.filter((s) => !have.has(s.id));
        setLocal(waiting);
        setHidden(waiting.length === 0);
      })
      .catch(() => {});
  }, [existing]);

  async function importAll() {
    let ok = 0;
    let failed = 0;
    setBusy({ done: 0, total: local.length });
    for (const [i, s] of local.entries()) {
      try {
        const map = new Map<string, string>();
        for (const ref of mediaRefs(s)) {
          const m = await localRepo.getMedia(ref);
          if (m) map.set(ref, await repo.putMedia(m.blob, m.name || "file"));
        }
        await repo.saveStudy({ ...rewriteMedia(s, map), status: "draft", version: 1 });
        ok++;
      } catch {
        failed++;
      }
      setBusy({ done: i + 1, total: local.length });
    }
    setBusy(null);
    setResult({ ok, failed });
    if (!failed) {
      try {
        localStorage.setItem(DISMISS_KEY, "1");
      } catch {}
    }
  }

  if (result)
    return (
      <p role="status" className="rounded-lg border border-line-2 bg-carbon p-4 text-sm text-mist">
        {t("done", { n: result.ok })} {result.failed > 0 && <span className="text-warn">{t("failed", { n: result.failed })}</span>}
      </p>
    );
  if (hidden) return null;
  return (
    <section aria-labelledby="import-h" className="flex flex-col gap-3 rounded-lg border border-signal/60 bg-carbon p-5">
      <h2 id="import-h" className="font-display text-lg">
        {t("title", { n: local.length })}
      </h2>
      <p className="text-sm leading-relaxed text-dim">{t("body")}</p>
      <ul className="flex flex-wrap gap-2 text-sm text-mist">
        {local.map((s) => (
          <li key={s.id} className="rounded-md border border-line-2 px-2 py-1">
            {s.name}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Button kind="primary" disabled={!!busy} onClick={importAll}>
          {busy ? t("importing", { done: busy.done, total: busy.total }) : t("import")}
        </Button>
        <Button
          kind="quiet"
          disabled={!!busy}
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, "1");
            } catch {}
            setHidden(true);
          }}
        >
          {t("dismiss")}
        </Button>
      </div>
    </section>
  );
}

/** The researcher's studies (saved to their account) and the two ways to start. */
export function StudioHome() {
  const t = useTranslations("studio");
  const format = useFormatter();
  const locale = useLocale() as "en" | "ar";
  const router = useRouter();
  const [rows, setRows] = useState<StudyListRow[] | null>(null);
  const [error, setError] = useState(false);
  // From a homepage module card (?module=form or ?module=shop): highlight that module's "New" button.
  const [focus, setFocus] = useState<"form" | "shop" | undefined>();
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("module");
    if (m === "form" || m === "shop") setFocus(m);
  }, []);

  const load = useCallback(async () => {
    try {
      setRows(await repo.listStudies());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => {
    load();
    return onDataChange(load);
  }, [load]);

  const create = useCallback(
    async (kind: "form" | "shop") => {
      const s = newStudy(kind, kind === "form" ? t("untitledForm") : t("untitledShop"), locale);
      await repo.saveStudy(s);
      router.push(`/studio/${s.id}`);
    },
    [router, t, locale],
  );

  async function duplicate(s: Study) {
    const now = new Date().toISOString();
    await repo.saveStudy({ ...structuredClone(s), id: uid("s"), name: `${s.name} (2)`, status: "draft", version: 1, createdAt: now, updatedAt: now });
  }
  async function remove(s: Study) {
    if (window.confirm(t("confirmDelete", { name: s.name }))) await repo.deleteStudy(s.id);
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 sm:px-8">
      {rows && <ImportBanner existing={rows.map((r) => r.study.id).join(" ")} />}

      <div className="grid gap-px overflow-hidden rounded-lg border border-line-2 bg-line-2 md:grid-cols-2">
        {(["form", "shop"] as const).map((k) => (
          <button key={k} type="button" onClick={() => create(k)} className={`group flex flex-col gap-2 p-6 text-start hover:bg-steel ${focus === k ? "bg-steel shadow-[inset_0_0_0_2px_#FF6A2B]" : "bg-carbon"}`}>
            <span className="tracked font-mono text-xs uppercase tracking-[0.14em] text-signal">+ {k === "form" ? t("newForm") : t("newShop")}</span>
            <span className="font-display text-xl">{t(`kind.${k}`)}</span>
            <span className="text-sm text-dim">{k === "form" ? t("newFormHint") : t("newShopHint")}</span>
          </button>
        ))}
      </div>

      <section className="flex flex-col gap-4">
        <h1 className="font-display text-3xl font-light">{t("studies")}</h1>
        {error ? (
          <p role="alert" className="text-warn">
            {t("loadFailed")}
          </p>
        ) : rows === null ? (
          <p className="text-dim">{t("loading")}</p>
        ) : rows.length === 0 ? (
          <p className="text-dim">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-2 border-y border-line-2">
            {rows.map(({ study: s, meta, completed, unfinished }) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link href={`/studio/${s.id}`} className="truncate text-lg hover:text-signal">
                    {s.name}
                  </Link>
                  <span className="font-mono text-xs text-faint">
                    {t(`kind.${s.kind}`)} · {meta.publishedVersion ? t("published", { v: meta.publishedVersion }) : t("status.draft")}
                    {s.settings?.closed ? ` · ${t("closedBadge")}` : ""} · {t("responses", { n: completed })}
                    {unfinished > 0 ? ` · ${t("unfinished", { n: unfinished })}` : ""} · {t("updated", { date: format.dateTime(new Date(s.updatedAt), { dateStyle: "medium", timeStyle: "short" }) })}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/studio/${s.id}`} className="inline-flex min-h-11 items-center rounded-md bg-photon px-4 text-sm font-semibold text-void hover:bg-white">
                    {t("open")}
                  </Link>
                  <Button onClick={() => duplicate(s)}>{t("duplicate")}</Button>
                  <Button kind="danger" onClick={() => remove(s)}>
                    {t("delete")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
