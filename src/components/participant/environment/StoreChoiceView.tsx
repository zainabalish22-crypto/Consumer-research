"use client";
import { useMemo, useState } from "react";
import type { Language, StoreChoiceBlock, StudyConfig } from "@/lib/study/schema";
import type { Assignment } from "@/lib/study/flow";
import { libraryOf, offerForStore, orderItems } from "@/lib/study/environment";
import { lt } from "@/lib/study/text";
import { Alert, Button, cx } from "@/components/ui";
import type { Tr } from "../i18n";
import { OfferBadge, Price, ProductIcon, brandColor, type Log } from "./shared";

/** Choice task: the same stores and offers as the village, shown as cards. */
export function StoreChoiceView({
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
  error,
  onSubmit,
  heading,
}: {
  block: StoreChoiceBlock;
  config: StudyConfig;
  assignment: Assignment;
  seed: string;
  lang: Language;
  fallback: Language;
  mediaUrls: Record<string, string>;
  tr: Tr;
  t: (x: Parameters<typeof lt>[0]) => string;
  log: Log;
  busy: boolean;
  error?: string;
  onSubmit: (value: { store: string | null }) => void;
  heading: (text: string) => React.ReactNode;
}) {
  const lib = libraryOf(config);
  const storeIds = useMemo(
    () => orderItems(block.stores, block.storeOrder, config, assignment, `${seed}:${block.id}`),
    [block, config, assignment, seed],
  );
  const [choice, setChoice] = useState<string | null | undefined>(undefined);
  const name = `choice_${block.id}`;

  return (
    <section className="flex flex-col gap-4">
      {block.heading && t(block.heading) ? heading(t(block.heading)) : heading(t(block.prompt))}
      {block.heading && t(block.heading) && <p className="prose-study text-lg">{t(block.prompt)}</p>}
      {error && <Alert tone="danger">{tr(`err_${error}`)}</Alert>}
      <fieldset>
        <legend className="sr-only">{t(block.prompt)}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {storeIds.map((sid, pos) => {
            const s = lib.stores[sid];
            if (!s) return null;
            const brand = s.brandId ? lib.brands[s.brandId] : undefined;
            const offer = offerForStore(block.offers, sid, config, assignment);
            const product = s.productIds.map((p) => lib.products[p]).find(Boolean);
            const facadeUrl = s.facade.image ? mediaUrls[s.facade.image.storagePath] : undefined;
            const color = s.facade.color ?? brandColor(brand);
            return (
              <label
                key={sid}
                className={cx(
                  "flex cursor-pointer flex-col overflow-hidden rounded-xl border-2 bg-surface transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
                  choice === sid ? "border-accent" : "border-line hover:border-accent/50",
                )}
              >
                <input
                  type="radio"
                  name={name}
                  className="sr-only"
                  checked={choice === sid}
                  onChange={() => {
                    setChoice(sid);
                    log("choice_select", { store: sid, storeCode: s.code, pos: pos + 1, offer: offer?.code ?? null });
                  }}
                />
                <div className="relative h-28" style={{ background: color }}>
                  {facadeUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={facadeUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-3 text-center text-xl font-bold text-white drop-shadow">
                      {lt(s.facade.signText, lang, fallback) || lt(s.name, lang, fallback)}
                    </div>
                  )}
                  <OfferBadge offer={offer} lang={lang} fallback={fallback} className="absolute end-2 top-2" />
                </div>
                <div className="flex items-center gap-3 p-3">
                  {block.showProducts && product && (
                    <span className="h-14 w-14 shrink-0 overflow-hidden rounded-md">
                      {product.images[0] && mediaUrls[product.images[0].storagePath] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrls[product.images[0].storagePath]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ProductIcon color={color} />
                      )}
                    </span>
                  )}
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold">{lt(s.name, lang, fallback)}</span>
                    {block.showProducts && product && (
                      <span className="text-sm text-muted">
                        {lt(product.name, lang, fallback)} · <Price product={product} offer={offer} currency={block.currency} lang={lang} />
                      </span>
                    )}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
        {block.allowNone && (
          <label className={cx("mt-3 flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3", choice === null ? "border-accent bg-accent-soft" : "border-line bg-surface")}>
            <input type="radio" name={name} checked={choice === null} onChange={() => setChoice(null)} className="size-5 accent-[var(--color-accent)]" />
            {t(block.noneLabel)}
          </label>
        )}
      </fieldset>
      <div className="flex justify-end">
        <Button className="min-w-32 py-3 text-base" disabled={busy || choice === undefined} onClick={() => onSubmit({ store: choice ?? null })}>
          {busy ? tr("saving") : tr("next")}
        </Button>
      </div>
    </section>
  );
}
