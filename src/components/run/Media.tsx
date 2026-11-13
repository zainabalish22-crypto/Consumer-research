"use client";

import { useEffect, useState } from "react";
import { useMediaUrl } from "@/lib/study/useMedia";

/**
 * A researcher's image or video, shown the same way in the editor and to participants.
 * Images fill the card's width and open full screen when tapped; videos play in place with
 * the browser's own controls, without leaving the page or going full screen on phones.
 */
export function MediaView({ src, alt = "", className = "", onSeen, zoomLabel = "View larger", closeLabel = "Close", plain = false }: { src: string; alt?: string; className?: string; onSeen?: () => void; zoomLabel?: string; closeLabel?: string; /** Picture only, with no zoom or player controls (for previews inside other controls). */ plain?: boolean }) {
  const { url, isVideo } = useMediaUrl(src);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  if (!url) return <div className={`aspect-video w-full animate-pulse rounded-xl bg-black/5 ${className}`} />;
  if (plain) return isVideo ? <video src={url} muted playsInline preload="metadata" className={`max-h-[50vh] w-full rounded-xl bg-black ${className}`} /> : <img src={url} alt={alt} className={`max-h-[50vh] w-full rounded-xl object-contain ${className}`} />;
  if (isVideo) return <video src={url} controls playsInline preload="metadata" onPlay={onSeen} className={`max-h-[70vh] w-full rounded-xl bg-black ${className}`} />;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={zoomLabel} className={`block w-full cursor-zoom-in overflow-hidden rounded-xl ${className}`}>
        <img src={url} alt={alt} onLoad={onSeen} className="max-h-[70vh] w-full object-contain" />
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={alt || zoomLabel} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setOpen(false)}>
          <img src={url} alt={alt} className="max-h-full max-w-full object-contain" />
          <button type="button" autoFocus onClick={() => setOpen(false)} aria-label={closeLabel} className="absolute end-4 top-4 h-11 w-11 rounded-full bg-white/15 text-2xl text-white">
            ×
          </button>
        </div>
      )}
    </>
  );
}
