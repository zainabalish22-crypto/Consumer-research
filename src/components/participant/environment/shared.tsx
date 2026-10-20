"use client";
/** Small pieces shared by the ad, choice and village views. */
import { useEffect, useRef } from "react";
import type { Language } from "@/lib/study/schema";
import type { LibAd, LibBrand, LibOffer, LibProduct } from "@/lib/study/library";
import { effectiveUnitPrice, formatPrice } from "@/lib/study/library";
import type { ShownAd } from "@/lib/study/environment";
import { lt } from "@/lib/study/text";
import { cx } from "@/components/ui";
import type { EventData, EventType } from "../events";

export type Log = (type: EventType, data?: EventData) => void;

/** Disclosure label over an ad, positioned and styled as configured in the library. */
export function DisclosureLabel({ ad, lang, fallback, compact }: { ad: LibAd; lang: Language; fallback: Language; compact?: boolean }) {
  const d = ad.disclosure;
  const pos = {
    "top-start": "top-2 start-2",
    "top-end": "top-2 end-2",
    "bottom-start": "bottom-2 start-2",
    "bottom-end": "bottom-2 end-2",
  }[d.position];
  const style = compact
    ? {
        // Small posters (shop fronts): keep the label legible without covering the creative.
        badge: "rounded-full bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold leading-tight text-white",
        banner: "inset-x-0 rounded-none bg-black/75 px-1 py-0.5 text-center text-[9px] font-semibold leading-tight text-white",
        subtle: "rounded bg-white/80 px-1 text-[8px] leading-tight text-ink",
      }[d.style]
    : {
        badge: "rounded-full bg-black/75 px-2.5 py-1 text-xs font-semibold text-white",
        banner: "inset-x-0 rounded-none bg-black/75 px-3 py-1.5 text-center text-sm font-semibold text-white",
        subtle: "rounded bg-white/80 px-1.5 py-0.5 text-[11px] text-ink",
      }[d.style];
  const inset = compact ? pos.replace(/-2/g, "-1") : pos;
  return (
    <span className={cx("pointer-events-none absolute z-10", d.style === "banner" ? (d.position.startsWith("top") ? "top-0" : "bottom-0") : inset, style)} role="note">
      {lt(d.text, lang, fallback)}
    </span>
  );
}

/**
 * An ad creative with exposure tracking: ad_impression when at least half is
 * visible, and media_visible with the visible time when it leaves the screen.
 */
export function AdCreative({
  shown,
  url,
  lang,
  fallback,
  log,
  context,
  className,
  autoplay,
  controls,
  onEnded,
  compact,
}: {
  shown: ShownAd;
  url?: string;
  lang: Language;
  fallback: Language;
  log: Log;
  context?: EventData;
  className?: string;
  autoplay?: boolean;
  controls?: boolean;
  onEnded?: () => void;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const media = shown.media;
  const base: EventData = { ad: shown.ad.id, adCode: shown.ad.code, version: shown.versionKey, disclosed: shown.disclosed, asset: media?.assetId ?? null, ...context };
  const quart = useRef(new Set<number>());

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let since: number | null = null;
    let total = 0;
    let impressed = false;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.5) {
          since = performance.now();
          if (!impressed) {
            impressed = true;
            log("ad_impression", base);
          }
        } else if (since !== null) {
          total += performance.now() - since;
          since = null;
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (since !== null) total += performance.now() - since;
      if (total > 0) log("media_visible", { ...base, kind: media?.kind ?? "image", ms: Math.round(total) });
    };
    // Tracking is per mounted creative.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown.ad.id, shown.versionKey]);

  const alt = media ? lt(media.alt, lang, fallback) || lt(shown.ad.name, lang, fallback) : lt(shown.ad.name, lang, fallback);
  return (
    <div ref={ref} className={cx("relative overflow-hidden rounded-lg bg-black/5", className)}>
      {shown.disclosed && <DisclosureLabel ad={shown.ad} lang={lang} fallback={fallback} compact={compact} />}
      {!media || !url ? (
        <div className="flex aspect-video items-center justify-center p-3 text-center text-sm text-muted">{alt}</div>
      ) : media.kind === "video" ? (
        <video
          src={url}
          className="w-full"
          playsInline
          preload="metadata"
          controls={controls ?? !compact}
          autoPlay={autoplay ?? compact}
          muted={autoplay ?? compact}
          loop={compact}
          aria-label={alt}
          onPlay={(e) => log("video_play", { ...base, t: Math.round(e.currentTarget.currentTime * 10) / 10 })}
          onPause={(e) => !e.currentTarget.ended && log("video_pause", { ...base, t: Math.round(e.currentTarget.currentTime * 10) / 10 })}
          onTimeUpdate={(e) => {
            const m = e.currentTarget;
            if (!m.duration || !Number.isFinite(m.duration)) return;
            const pct = (m.currentTime / m.duration) * 100;
            for (const q of [25, 50, 75]) {
              if (pct >= q && !quart.current.has(q)) {
                quart.current.add(q);
                log("video_progress", { ...base, pct: q });
              }
            }
          }}
          onEnded={(e) => {
            log("video_complete", { ...base, duration: Math.round(e.currentTarget.duration * 10) / 10 });
            onEnded?.();
          }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="w-full object-cover" loading="lazy" />
      )}
    </div>
  );
}

export function OfferBadge({ offer, lang, fallback, className }: { offer: LibOffer | null; lang: Language; fallback: Language; className?: string }) {
  if (!offer || offer.kind === "none") return null;
  const text = lt(offer.displayText, lang, fallback) || lt(offer.name, lang, fallback);
  if (!text) return null;
  return <span className={cx("inline-flex rounded-full bg-[#c2410c] px-2.5 py-0.5 text-xs font-bold text-white shadow", className)}>{text}</span>;
}

export function Price({
  product,
  offer,
  currency,
  lang,
  each,
}: {
  product: LibProduct;
  offer: LibOffer | null;
  currency: string;
  lang: Language;
  /** Formats the effective unit price, e.g. "BHD 1.000 each with the offer". */
  each: (price: string) => string;
}) {
  const eff = effectiveUnitPrice(product.basePrice, offer);
  const cur = product.currency || currency;
  if (offer && offer.kind !== "none" && eff < product.basePrice) {
    return (
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold">{formatPrice(product.basePrice, cur, lang)}</span>
        <span className="text-xs text-muted">{each(formatPrice(eff, cur, lang))}</span>
      </span>
    );
  }
  return <span className="font-semibold">{formatPrice(product.basePrice, cur, lang)}</span>;
}

/** Neutral illustration used when a product has no photo. */
export function ProductIcon({ color = "#0f6e6e" }: { color?: string }) {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
      <rect width="64" height="64" fill="#f3f4f6" />
      <path d="M22 18h20l-3 34a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3z" fill={color} opacity="0.85" />
      <rect x="20" y="14" width="24" height="5" rx="1.5" fill={color} />
      <path d="M33 14l4-7" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function brandColor(brand: LibBrand | undefined, fallback = "#0f6e6e") {
  return brand?.colors.primary ?? fallback;
}
