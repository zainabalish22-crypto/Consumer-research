"use client";

/**
 * Where studies, sessions and uploaded media are kept. For now: this browser (IndexedDB), so
 * everything works without an account or a server. The API is async and small on purpose, so a
 * database (e.g. Neon Postgres) can replace it later without changing the screens.
 */
import type { Session, Study } from "./types";

const DB = "tessellum";
const VERSION = 1;
type StoreName = "studies" | "sessions" | "media";

let opening: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!opening)
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains("studies")) d.createObjectStore("studies", { keyPath: "id" });
        if (!d.objectStoreNames.contains("sessions")) d.createObjectStore("sessions", { keyPath: "id" }).createIndex("studyId", "studyId");
        if (!d.objectStoreNames.contains("media")) d.createObjectStore("media", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  return opening;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const tx = d.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

/** Notifies open screens (in this tab and others) that saved data changed. */
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("tessellum-data") : null;
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

export const repo = {
  listStudies: async () => (await run<Study[]>("studies", "readonly", (s) => s.getAll())).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  getStudy: (id: string) => run<Study | undefined>("studies", "readonly", (s) => s.get(id)),
  saveStudy: async (study: Study) => {
    await run("studies", "readwrite", (s) => s.put({ ...study, updatedAt: new Date().toISOString() }));
    changed();
  },
  deleteStudy: async (id: string) => {
    await run("studies", "readwrite", (s) => s.delete(id));
    for (const sess of await repo.listSessions(id)) await run("sessions", "readwrite", (s) => s.delete(sess.id));
    changed();
  },

  listSessions: async (studyId: string) =>
    (await run<Session[]>("sessions", "readonly", (s) => s.index("studyId").getAll(studyId))).sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
  getSession: (id: string) => run<Session | undefined>("sessions", "readonly", (s) => s.get(id)),
  saveSession: async (session: Session) => {
    await run("sessions", "readwrite", (s) => s.put(session));
    changed();
  },
  deleteSession: async (id: string) => {
    await run("sessions", "readwrite", (s) => s.delete(id));
    changed();
  },

  /** Stores an uploaded file; returns its reference ("media:<id>"). */
  putMedia: async (file: Blob, name: string) => {
    const id = crypto.randomUUID();
    await run("media", "readwrite", (s) => s.put({ id, name, type: file.type, blob: file }));
    return `media:${id}`;
  },
  getMedia: (ref: string) => run<{ id: string; name: string; type: string; blob: Blob } | undefined>("media", "readonly", (s) => s.get(ref.replace(/^media:/, ""))),
};
