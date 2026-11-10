"use client";

import { useEffect, useState } from "react";
import { repo } from "./repo";

/** Resolves a media reference to something an <img> or <video> can show. */
export function useMediaUrl(ref: string | undefined) {
  const [url, setUrl] = useState<string | undefined>(ref && !ref.startsWith("media:") ? ref : undefined);
  const [type, setType] = useState<string>("");
  useEffect(() => {
    if (!ref) {
      setUrl(undefined);
      return;
    }
    if (!ref.startsWith("media:")) {
      setUrl(ref);
      setType(/\.(mp4|webm)(\?|$)/i.test(ref) ? "video/mp4" : "image");
      return;
    }
    let made: string | undefined;
    let live = true;
    repo.getMedia(ref).then((m) => {
      if (!live || !m) return;
      made = URL.createObjectURL(m.blob);
      setUrl(made);
      setType(m.type);
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [ref]);
  return { url, isVideo: type.startsWith("video") };
}
