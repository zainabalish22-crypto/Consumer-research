"use client";
import { useEffect, useRef } from "react";
import type { MediaRef, Language, LocalizedText } from "@/lib/study/schema";
import { lt } from "@/lib/study/text";
import type { EventData, EventType } from "./events";

type OnEvent = (type: EventType, data: EventData) => void;

/**
 * Renders one media item and reports exposure:
 * - images: image_view when at least half is visible, media_visible with the visible time on leave;
 * - video/audio: play, pause, seek, progress quartiles (25/50/75) and complete.
 */
export function MediaView({
  item,
  url,
  lang,
  fallback,
  autoplay,
  controls,
  onEnded,
  onEvent,
}: {
  item: MediaRef & { caption?: LocalizedText };
  url?: string;
  lang: Language;
  fallback: Language;
  autoplay?: boolean;
  controls?: boolean;
  onEnded?: () => void;
  onEvent?: OnEvent;
}) {
  const alt = lt(item.alt, lang, fallback);
  const caption = lt(item.caption, lang, fallback);
  const ref = useRef<HTMLElement>(null);
  const quartiles = useRef(new Set<number>());
  const asset = item.assetId;

  // Visible-time tracking (images and players alike).
  useEffect(() => {
    const el = ref.current;
    if (!el || !onEvent || typeof IntersectionObserver === "undefined") return;
    let since: number | null = null;
    let total = 0;
    let reported = false;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          since = performance.now();
          if (!reported && item.kind === "image") {
            reported = true;
            onEvent("image_view", { asset });
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
      if (total > 0) onEvent("media_visible", { asset, kind: item.kind, ms: Math.round(total) });
    };
    // onEvent is stable for the lifetime of a block.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, item.kind]);

  if (!url) {
    return <div className="flex aspect-video items-center justify-center rounded-lg bg-paper text-sm text-muted">…</div>;
  }

  const prefix = item.kind === "audio" ? "audio" : "video";
  const playerEvents = onEvent
    ? {
        onPlay: (e: React.SyntheticEvent<HTMLMediaElement>) => onEvent(`${prefix}_play` as EventType, { asset, t: round(e.currentTarget.currentTime) }),
        onPause: (e: React.SyntheticEvent<HTMLMediaElement>) => {
          const m = e.currentTarget;
          if (!m.ended) onEvent(`${prefix}_pause` as EventType, { asset, t: round(m.currentTime) });
        },
        onSeeked: (e: React.SyntheticEvent<HTMLMediaElement>) => item.kind === "video" && onEvent("video_seek", { asset, t: round(e.currentTarget.currentTime) }),
        onTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) => {
          const m = e.currentTarget;
          if (!m.duration || !Number.isFinite(m.duration)) return;
          const pct = (m.currentTime / m.duration) * 100;
          for (const q of [25, 50, 75]) {
            if (pct >= q && !quartiles.current.has(q)) {
              quartiles.current.add(q);
              onEvent(`${prefix}_progress` as EventType, { asset, pct: q });
            }
          }
        },
      }
    : {};
  const ended = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    onEvent?.(`${prefix}_complete` as EventType, { asset, duration: round(e.currentTarget.duration) });
    onEnded?.();
  };

  return (
    <figure ref={ref as React.RefObject<HTMLElement & HTMLDivElement>} className="flex flex-col gap-2">
      {item.kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} loading="lazy" className="mx-auto max-h-[70vh] w-auto max-w-full rounded-lg" />
      )}
      {item.kind === "video" && (
        <video
          src={url}
          controls={controls ?? true}
          autoPlay={autoplay}
          muted={autoplay}
          playsInline
          preload="metadata"
          onEnded={ended}
          {...playerEvents}
          aria-label={alt || undefined}
          className="w-full rounded-lg bg-black"
        />
      )}
      {item.kind === "audio" && (
        <audio src={url} controls={controls ?? true} autoPlay={autoplay} preload="metadata" onEnded={ended} {...playerEvents} className="w-full" aria-label={alt || undefined} />
      )}
      {caption && <figcaption className="text-center text-sm text-muted">{caption}</figcaption>}
    </figure>
  );
}

const round = (n: number) => Math.round(n * 10) / 10;
