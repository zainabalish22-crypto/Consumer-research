"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { MediaRef } from "@/lib/study/schema";
import { Button } from "@/components/ui";

interface Asset {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  kind: "image" | "video" | "audio";
}

export function MediaPicker({
  kinds,
  onPick,
  onClose,
}: {
  kinds: ("image" | "video" | "audio")[];
  onPick: (ref: MediaRef) => void;
  onClose: () => void;
}) {
  const t = useTranslations("builder.media");
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const kindsKey = kinds.join(",");
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("media_assets")
        .select("id, storage_path, file_name, mime_type, kind")
        .in("kind", kindsKey.split(","))
        .order("created_at", { ascending: false })
        .limit(200);
      const list = (data ?? []) as Asset[];
      setAssets(list);
      const images = list.filter((a) => a.kind === "image").map((a) => a.storage_path);
      if (images.length) {
        const { data: signed } = await supabase.storage.from("media").createSignedUrls(images, 600);
        setThumbs(Object.fromEntries((signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : []))));
      }
    })();
  }, [kindsKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={t("pick")} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 overflow-hidden rounded-xl bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("pick")}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("close")}
          </Button>
        </div>
        <div className="overflow-y-auto">
          {assets === null ? (
            <p className="text-sm text-muted">{t("loading")}</p>
          ) : assets.length === 0 ? (
            <p className="text-sm text-muted">
              {t("empty")}{" "}
              <Link href="/studio/media" className="text-accent underline" target="_blank">
                {t("openLibrary")}
              </Link>
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {assets.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() =>
                      onPick({ assetId: a.id, storagePath: a.storage_path, kind: a.kind, mimeType: a.mime_type, alt: {} })
                    }
                    className="flex w-full flex-col gap-1 rounded-lg border border-line p-2 text-start hover:border-accent"
                  >
                    <span className="flex aspect-square items-center justify-center overflow-hidden rounded bg-paper text-xs uppercase text-muted">
                      {a.kind === "image" && thumbs[a.storage_path] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbs[a.storage_path]} alt="" className="size-full object-cover" />
                      ) : (
                        a.kind
                      )}
                    </span>
                    <span className="truncate text-xs" dir="auto">
                      {a.file_name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
