"use client";

import { upload } from "@vercel/blob/client";
import type { Session, Study } from "./types";

/**
 * The researcher's studies, saved to their account on the server. The screens call these few
 * functions only, so storage stays in one place.
 */
export type StudyMeta = { publishedVersion: number | null; publishedAt?: string; changedSincePublish: boolean };
export type StudyRow = { study: Study; meta: StudyMeta };
export type StudyListRow = StudyRow & { completed: number; unfinished: number };

/** A failed request, with the server's error code (e.g. "signIn", "notFound"). */
export class RepoError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new RepoError(body.error ?? "failed");
  return body as T;
}

/* Tell open screens (this tab and others) that saved data changed. */
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("asdaa-lab-data") : null;
const listeners = new Set<() => void>();
channel?.addEventListener("message", () => listeners.forEach((l) => l()));
function changed() {
  listeners.forEach((l) => l());
  channel?.postMessage("changed");
}
export function onDataChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Image and video limits shown to the researcher before uploading. */
export const MEDIA_LIMITS = { image: 5 * 1024 * 1024, video: 50 * 1024 * 1024 };

let uploadMode: Promise<"blob" | "local"> | null = null;

export const repo = {
  listStudies: async () => (await call<{ studies: StudyListRow[] }>("/api/studies")).studies,

  getStudy: async (id: string): Promise<StudyRow | null> => {
    try {
      return await call<StudyRow>(`/api/studies/${encodeURIComponent(id)}`);
    } catch (e) {
      if (e instanceof RepoError && e.code === "notFound") return null;
      throw e;
    }
  },

  /** Saves (or creates) a draft. Returns the publish state after saving. */
  saveStudy: async (study: Study) => {
    const r = await call<{ meta: StudyMeta }>(`/api/studies/${encodeURIComponent(study.id)}`, { method: "PUT", body: JSON.stringify(study) });
    changed();
    return r.meta;
  },

  deleteStudy: async (id: string) => {
    await call(`/api/studies/${encodeURIComponent(id)}`, { method: "DELETE" });
    changed();
  },

  /** Locks the current draft as the next published version. */
  publish: async (id: string) => {
    const r = await call<StudyRow>(`/api/studies/${encodeURIComponent(id)}/publish`, { method: "POST" });
    changed();
    return r;
  },

  listSessions: async (studyId: string) => (await call<{ sessions: Session[] }>(`/api/studies/${encodeURIComponent(studyId)}/sessions`)).sessions,

  deleteSession: async (id: string) => {
    await call(`/api/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
    changed();
  },

  deleteAllSessions: async (studyId: string, includeTest: boolean) => {
    await call(`/api/studies/${encodeURIComponent(studyId)}/sessions${includeTest ? "?test=1" : ""}`, { method: "DELETE" });
    changed();
  },

  /**
   * Uploads an image or video and returns its address. Throws RepoError("tooLarge" or
   * "badType") before uploading when the file is not accepted.
   */
  putMedia: async (file: Blob, name: string): Promise<string> => {
    const isVideo = file.type.startsWith("video/");
    if (!isVideo && !file.type.startsWith("image/")) throw new RepoError("badType");
    if (file.size > (isVideo ? MEDIA_LIMITS.video : MEDIA_LIMITS.image)) throw new RepoError("tooLarge");
    uploadMode ??= call<{ mode: "blob" | "local" }>("/api/media/upload").then((r) => r.mode);
    if ((await uploadMode) === "local") {
      const form = new FormData();
      form.append("file", file, name);
      const res = await fetch("/api/media/local", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new RepoError(body.error ?? "failed");
      return body.url as string;
    }
    const safe = name.replace(/[^\w.-]+/g, "-").slice(-80) || "file";
    const blob = await upload(`media/${safe}`, file, { access: "public", handleUploadUrl: "/api/media/upload", contentType: file.type, multipart: file.size > 8 * 1024 * 1024 });
    await call("/api/media", { method: "POST", body: JSON.stringify({ url: blob.url, pathname: blob.pathname, size: file.size, contentType: file.type }) });
    return blob.url;
  },
};
