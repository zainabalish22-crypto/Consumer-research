"use client";
import type { MediaRef, Language, LocalizedText } from "@/lib/study/schema";
import { lt } from "@/lib/study/text";

export function MediaView({
  item,
  url,
  lang,
  fallback,
  autoplay,
  controls,
  onEnded,
}: {
  item: MediaRef & { caption?: LocalizedText };
  url?: string;
  lang: Language;
  fallback: Language;
  autoplay?: boolean;
  controls?: boolean;
  onEnded?: () => void;
}) {
  const alt = lt(item.alt, lang, fallback);
  const caption = lt(item.caption, lang, fallback);
  if (!url) {
    return <div className="flex aspect-video items-center justify-center rounded-lg bg-paper text-sm text-muted">…</div>;
  }
  return (
    <figure className="flex flex-col gap-2">
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
          onEnded={onEnded}
          aria-label={alt || undefined}
          className="w-full rounded-lg bg-black"
        />
      )}
      {item.kind === "audio" && (
        <audio src={url} controls={controls ?? true} autoPlay={autoplay} preload="metadata" onEnded={onEnded} className="w-full" aria-label={alt || undefined} />
      )}
      {caption && <figcaption className="text-center text-sm text-muted">{caption}</figcaption>}
    </figure>
  );
}
