"use client";
import { useEffect, useMemo, useState } from "react";
import type { AdExposureBlock, Language, StudyConfig } from "@/lib/study/schema";
import type { Assignment } from "@/lib/study/flow";
import { libraryOf, orderItems, resolveAd } from "@/lib/study/environment";
import { Button } from "@/components/ui";
import type { Tr } from "../i18n";
import { AdCreative, type Log } from "./shared";

/** Shows a sequence of ads (one per screen) in the participant's order, with version and disclosure rules applied. */
export function AdExposureView({
  block,
  config,
  assignment,
  seed,
  lang,
  fallback,
  mediaUrls,
  tr,
  t,
  log,
  busy,
  onDone,
  heading,
}: {
  block: AdExposureBlock;
  config: StudyConfig;
  assignment: Assignment;
  seed: string;
  lang: Language;
  fallback: Language;
  mediaUrls: Record<string, string>;
  tr: Tr;
  t: (x: Parameters<typeof import("@/lib/study/text").lt>[0]) => string;
  log: Log;
  busy: boolean;
  onDone: () => void;
  heading: (text: string) => React.ReactNode;
}) {
  const lib = libraryOf(config);
  const shown = useMemo(
    () =>
      orderItems(block.ads, block.order, config, assignment, `${seed}:${block.id}`)
        .map((id) => lib.ads[id])
        .filter(Boolean)
        .map((ad) => resolveAd(ad, block.rules, config, assignment)),
    [block, config, assignment, seed, lib],
  );
  const [i, setI] = useState(0);
  const [remaining, setRemaining] = useState(block.minViewSeconds);
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    setRemaining(block.minViewSeconds);
    setEnded(false);
  }, [i, block.minViewSeconds]);
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const current = shown[i];
  const mustWatch = block.requireEnd && current?.media?.kind === "video" && !ended;
  const last = i >= shown.length - 1;
  return (
    <section className="flex flex-col gap-4">
      {block.heading && t(block.heading) ? heading(t(block.heading)) : heading(tr("adOf", { n: i + 1, total: shown.length }))}
      {block.intro && t(block.intro) && i === 0 && <p className="prose-study text-muted">{t(block.intro)}</p>}
      {current && (
        <AdCreative
          key={`${current.ad.id}:${current.versionKey}`}
          shown={current}
          url={current.media ? mediaUrls[current.media.storagePath] : undefined}
          lang={lang}
          fallback={fallback}
          log={log}
          context={{ position: i + 1 }}
          autoplay={block.autoplay}
          controls={block.showControls}
          onEnded={() => setEnded(true)}
        />
      )}
      <p className="text-center text-xs text-muted">{tr("adOf", { n: i + 1, total: shown.length })}</p>
      {remaining > 0 && <p className="text-center text-sm text-muted" aria-live="polite">{tr("waitSeconds", { n: remaining })}</p>}
      {remaining <= 0 && mustWatch && <p className="text-center text-sm text-muted">{tr("watchToEnd")}</p>}
      <div className="flex justify-end">
        <Button className="min-w-32 py-3 text-base" disabled={busy || remaining > 0 || mustWatch} onClick={() => (last ? onDone() : setI(i + 1))}>
          {busy ? tr("saving") : last ? tr("next") : tr("nextAd")}
        </Button>
      </div>
    </section>
  );
}
