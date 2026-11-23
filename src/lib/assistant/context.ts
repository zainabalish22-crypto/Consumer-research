"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * What the assistant can see on the current page. A page offers it explicitly (for example the
 * study editor offers the study's text); nothing else on screen is sent. Participant answers
 * and uploaded analysis files are never offered.
 */
export type PageContext = { title?: string; detail?: string };

let current: PageContext = {};
const subscribers = new Set<() => void>();

function set(next: PageContext) {
  current = next;
  subscribers.forEach((f) => f());
}

export const getPageContext = () => current;

export function usePageContext(): PageContext {
  return useSyncExternalStore(
    (f) => {
      subscribers.add(f);
      return () => subscribers.delete(f);
    },
    () => current,
    () => current,
  );
}

/** Called by a page to offer its content to the assistant while it is open. */
export function useOfferToAssistant(context: PageContext | null) {
  const key = context ? JSON.stringify(context) : "";
  useEffect(() => {
    if (!key) return;
    set(JSON.parse(key) as PageContext);
    return () => set({});
  }, [key]);
}
