"use client";

import type { Lang, Session, Study } from "./types";

/**
 * What the participant's browser needs from the server: the study, starting an attempt, and
 * saving progress. The attempt's private token stays in this browser so the participant can
 * continue after closing the page, and so nobody else can write to their attempt.
 */
export type RunState = "open" | "closed" | "notPublished";

async function call<T>(url: string, init?: RequestInit): Promise<{ ok: true; body: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
    const body = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, body: body as T } : { ok: false, error: body.error ?? "failed" };
  } catch {
    return { ok: false, error: "offline" };
  }
}

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
  remove: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};

/** A random id for this browser and study, used for the "once per device" rule. */
export function deviceKey(studyId: string) {
  const k = `asdaa-device-${studyId}`;
  let v = store.get(k);
  if (!v) {
    v = crypto.randomUUID();
    store.set(k, v);
  }
  return v;
}

export type SavedAttempt = { sid: string; token: string; step: number };
const attemptKey = (studyId: string, test: boolean) => `asdaa-attempt-${studyId}${test ? "-test" : ""}`;

export const attempts = {
  read(studyId: string, test: boolean): SavedAttempt | null {
    try {
      return JSON.parse(store.get(attemptKey(studyId, test)) ?? "null");
    } catch {
      return null;
    }
  },
  write: (studyId: string, test: boolean, a: SavedAttempt) => store.set(attemptKey(studyId, test), JSON.stringify(a)),
  clear: (studyId: string, test: boolean) => store.remove(attemptKey(studyId, test)),
};

export const runApi = {
  load: (id: string, test: boolean) => call<{ study: Study; state: RunState }>(`/api/run/${encodeURIComponent(id)}${test ? "?test=1" : ""}`),

  start: (id: string, lang: Lang, params: Record<string, string>, test: boolean) =>
    call<{ session: Session; token: string }>(`/api/run/${encodeURIComponent(id)}/start`, {
      method: "POST",
      body: JSON.stringify({ lang, params, test, deviceKey: deviceKey(id) }),
    }),

  resume: (sid: string, token: string) => call<{ session: Session }>(`/api/run/session/${encodeURIComponent(sid)}`, { headers: { "x-session-token": token } }),

  save: (session: Session, token: string, keepalive = false) =>
    call<{ saved: true }>(`/api/run/session/${encodeURIComponent(session.id)}`, {
      method: "PUT",
      body: JSON.stringify(session),
      headers: { "x-session-token": token },
      keepalive,
    }),
};

/** A panel return link with the participant's panel ID filled in for {pid}. */
export function returnUrl(template: string | undefined, panelId: string | undefined) {
  if (!template || !/^https:\/\//.test(template)) return undefined;
  return template.replace(/\{pid\}/g, encodeURIComponent(panelId ?? ""));
}
