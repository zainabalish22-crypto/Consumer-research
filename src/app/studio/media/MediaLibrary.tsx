"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { ACCEPTED_MEDIA, LIMITS } from "@/config/platform";
import { Alert, Button, EmptyState, Input, Select } from "@/components/ui";
import { Checkbox } from "@/components/builder/controls";

export interface AssetRow {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  kind: "image" | "video" | "audio";
  size_bytes: number;
  width: number | null;
  height: number | null;
  folder: string | null;
  tags: string[];
  created_at: string;
}

interface Upload {
  key: string;
  name: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

const fmtSize = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`);

function safeName(name: string) {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
  const stem = (dot > 0 ? name.slice(0, dot) : name).normalize("NFKD").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${stem || "file"}${ext}`;
}

/** Downscale large images to WebP in the browser to save storage and bandwidth. */
async function compressImage(file: File): Promise<{ blob: Blob; type: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 2000;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
  if (!blob || blob.size >= file.size) return { blob: file, type: file.type, width: bitmap.width, height: bitmap.height };
  return { blob, type: "image/webp", width: w, height: h };
}

async function imageSize(file: Blob): Promise<{ width: number; height: number } | null> {
  try {
    const b = await createImageBitmap(file);
    return { width: b.width, height: b.height };
  } catch {
    return null;
  }
}

function uploadWithProgress(url: string, token: string, apikey: string, blob: Blob, type: string, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", apikey);
    xhr.setRequestHeader("content-type", type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(blob);
  });
}

export function MediaLibrary({ workspaceId, initialAssets, thumbs }: { workspaceId: string; initialAssets: AssetRow[]; thumbs: Record<string, string> }) {
  const t = useTranslations("media");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [compress, setCompress] = useState(true);
  const [folder, setFolder] = useState("");
  const [filterKind, setFilterKind] = useState<"all" | "image" | "video" | "audio">("all");
  const [filterFolder, setFilterFolder] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const folders = [...new Set(initialAssets.map((a) => a.folder).filter(Boolean))] as string[];
  const visible = initialAssets.filter(
    (a) =>
      (filterKind === "all" || a.kind === filterKind) &&
      (!filterFolder || a.folder === filterFolder) &&
      (!search || a.file_name.toLowerCase().includes(search.toLowerCase()) || a.tags.some((tg) => tg.toLowerCase().includes(search.toLowerCase()))),
  );

  const setUpload = (key: string, patch: Partial<Upload>) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return setError(t("errors.signedOut"));
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/media`;
    const apikey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

    for (const file of Array.from(files)) {
      const key = crypto.randomUUID();
      setUploads((u) => [{ key, name: file.name, progress: 0, status: "uploading" }, ...u]);
      const kind = ACCEPTED_MEDIA[file.type];
      if (!kind) {
        setUpload(key, { status: "error", error: t("errors.type") });
        continue;
      }
      try {
        let blob: Blob = file;
        let type = file.type;
        let dims: { width: number; height: number } | null = null;
        if (kind === "image") {
          if (compress && file.type !== "image/webp") {
            const c = await compressImage(file);
            blob = c.blob;
            type = c.type;
            dims = { width: c.width, height: c.height };
          } else dims = await imageSize(file);
        }
        if (blob.size > LIMITS.maxUploadBytes) {
          setUpload(key, { status: "error", error: t("errors.size", { mb: LIMITS.maxUploadBytes / 1024 / 1024 }) });
          continue;
        }
        let name = safeName(file.name);
        if (type === "image/webp" && !name.endsWith(".webp")) name = name.replace(/\.[a-z0-9]+$/, "") + ".webp";
        const path = `${workspaceId}/${crypto.randomUUID()}-${name}`;
        await uploadWithProgress(`${base}/${path}`, session.access_token, apikey, blob, type, (p) => setUpload(key, { progress: p }));
        const { error: insErr } = await supabase.from("media_assets").insert({
          workspace_id: workspaceId,
          storage_path: path,
          file_name: file.name.slice(0, 255),
          mime_type: type,
          kind,
          size_bytes: blob.size,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
          folder: folder.trim() || null,
          created_by: session.user.id,
        });
        if (insErr) {
          await supabase.storage.from("media").remove([path]);
          throw insErr;
        }
        setUpload(key, { status: "done", progress: 100 });
      } catch {
        setUpload(key, { status: "error", error: t("errors.upload") });
      }
    }
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  };

  const remove = async (a: AssetRow) => {
    setError(null);
    const { data: inUse } = await supabase.rpc("is_published_media", { p_path: a.storage_path });
    if (inUse) return setError(t("errors.inUse", { name: a.file_name }));
    const { error: delErr } = await supabase.from("media_assets").delete().eq("id", a.id);
    if (delErr) return setError(t("errors.delete"));
    await supabase.storage.from("media").remove([a.storage_path]);
    router.refresh();
  };

  const saveMeta = async (a: AssetRow, patch: { folder?: string | null; tags?: string[] }) => {
    const { error: upErr } = await supabase.from("media_assets").update(patch).eq("id", a.id);
    if (upErr) setError(t("errors.save"));
    else router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-xl border border-dashed border-line bg-surface p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="upload" className="text-sm font-medium">
              {t("upload")}
            </label>
            <input
              id="upload"
              ref={inputRef}
              type="file"
              multiple
              accept={Object.keys(ACCEPTED_MEDIA).join(",")}
              onChange={(e) => handleFiles(e.target.files)}
              className="text-sm file:me-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="upload-folder" className="text-sm font-medium">
              {t("folder")}
            </label>
            <Input id="upload-folder" list="folders" value={folder} onChange={(e) => setFolder(e.target.value)} className="w-48" dir="auto" />
            <datalist id="folders">
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
        </div>
        <Checkbox label={t("compress")} hint={t("compressHint")} checked={compress} onChange={setCompress} />
        <p className="text-xs text-muted">{t("accepted")}</p>
        {uploads.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {uploads.map((u) => (
              <li key={u.key} className="flex items-center gap-3">
                <span className="w-48 truncate" dir="auto">
                  {u.name}
                </span>
                {u.status === "error" ? (
                  <span className="text-danger">{u.error}</span>
                ) : (
                  <>
                    <progress max={100} value={u.progress} className="h-2 flex-1" aria-label={u.name} />
                    <span className="w-24 text-xs text-muted">{u.status === "done" ? t("done") : `${u.progress}%`}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <Alert tone="danger">{error}</Alert>}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <label htmlFor="m-search" className="sr-only">
            {t("search")}
          </label>
          <Input id="m-search" placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" dir="auto" />
          <label htmlFor="m-kind" className="sr-only">
            {t("kind")}
          </label>
          <Select id="m-kind" value={filterKind} onChange={(e) => setFilterKind(e.target.value as typeof filterKind)} className="w-auto">
            {(["all", "image", "video", "audio"] as const).map((k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ))}
          </Select>
          {folders.length > 0 && (
            <>
              <label htmlFor="m-folder" className="sr-only">
                {t("folder")}
              </label>
              <Select id="m-folder" value={filterFolder} onChange={(e) => setFilterFolder(e.target.value)} className="w-auto">
                <option value="">{t("allFolders")}</option>
                {folders.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </>
          )}
        </div>
        {visible.length === 0 ? (
          <EmptyState title={t("empty")}>{t("emptyHint")}</EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {visible.map((a) => (
              <AssetCard key={a.id} asset={a} thumb={thumbs[a.storage_path]} onDelete={() => remove(a)} onSave={(p) => saveMeta(a, p)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AssetCard({
  asset,
  thumb,
  onDelete,
  onSave,
}: {
  asset: AssetRow;
  thumb?: string;
  onDelete: () => void;
  onSave: (p: { folder?: string | null; tags?: string[] }) => void;
}) {
  const t = useTranslations("media");
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [folder, setFolder] = useState(asset.folder ?? "");
  const [tags, setTags] = useState(asset.tags.join(", "));
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-2">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-paper text-xs uppercase text-muted">
        {asset.kind === "image" && thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={asset.file_name} loading="lazy" className="size-full object-cover" />
        ) : (
          t(`kinds.${asset.kind}`)
        )}
      </div>
      <p className="truncate text-sm" dir="auto" title={asset.file_name}>
        {asset.file_name}
      </p>
      <p className="text-xs text-muted">
        {fmtSize(asset.size_bytes)}
        {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
        {asset.folder ? ` · ${asset.folder}` : ""}
      </p>
      {asset.tags.length > 0 && <p className="truncate text-xs text-muted">#{asset.tags.join(" #")}</p>}
      {editing ? (
        <div className="flex flex-col gap-1">
          <Input aria-label={t("folder")} placeholder={t("folder")} value={folder} onChange={(e) => setFolder(e.target.value)} className="py-1 text-xs" dir="auto" />
          <Input aria-label={t("tags")} placeholder={t("tags")} value={tags} onChange={(e) => setTags(e.target.value)} className="py-1 text-xs" dir="auto" />
          <div className="flex gap-1">
            <Button
              size="sm"
              onClick={() => {
                onSave({
                  folder: folder.trim().slice(0, 120) || null,
                  tags: tags
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean)
                    .slice(0, 20),
                });
                setEditing(false);
              }}
            >
              {t("save")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : confirm ? (
        <div className="flex flex-col gap-1 text-xs">
          <span className="text-danger">{t("confirmDelete")}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="danger" onClick={onDelete}>
              {t("delete")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            {t("edit")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
            {t("delete")}
          </Button>
        </div>
      )}
    </li>
  );
}
