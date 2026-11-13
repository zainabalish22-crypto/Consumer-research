"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { newStudy } from "@/lib/study/defaults";
import { onDataChange, repo } from "@/lib/study/repo";
import type { Study } from "@/lib/study/types";
import { uid } from "@/lib/study/util";
import { Button } from "./ui";

/** All studies in this browser, and the two ways to start: a form or a shop study. */
export function StudioHome() {
  const t = useTranslations("studio");
  const format = useFormatter();
  const locale = useLocale() as "en" | "ar";
  const router = useRouter();
  const [studies, setStudies] = useState<Study[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  // From a homepage module card (?module=form or ?module=shop): highlight that module's "New" button.
  const [focus, setFocus] = useState<"form" | "shop" | undefined>();
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("module");
    if (m === "form" || m === "shop") setFocus(m);
  }, []);

  const load = useCallback(async () => {
    const list = await repo.listStudies();
    setStudies(list);
    const c: Record<string, number> = {};
    for (const s of list) c[s.id] = (await repo.listSessions(s.id)).filter((x) => !x.test).length;
    setCounts(c);
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
        {studies === null ? (
          <p className="text-dim">{t("loading")}</p>
        ) : studies.length === 0 ? (
          <p className="text-dim">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-2 border-y border-line-2">
            {studies.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link href={`/studio/${s.id}`} className="truncate text-lg hover:text-signal">
                    {s.name}
                  </Link>
                  <span className="font-mono text-xs text-faint">
                    {t(`kind.${s.kind}`)} · {t(`status.${s.status}`)} · {t("responses", { n: counts[s.id] ?? 0 })} · {t("updated", { date: format.dateTime(new Date(s.updatedAt), { dateStyle: "medium", timeStyle: "short" }) })}
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
