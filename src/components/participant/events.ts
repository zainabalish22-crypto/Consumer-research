/**
 * Batched, offline-tolerant behavioural event logging.
 * - Every event gets a UUID, so resending after a network failure never duplicates it.
 * - Pending events are kept in localStorage until the server confirms them.
 * - Only coarse, non-invasive events are recorded (no keystrokes, no mouse paths).
 */
export type EventType =
  | "block_enter"
  | "block_leave"
  | "image_view"
  | "media_visible"
  | "video_play"
  | "video_pause"
  | "video_seek"
  | "video_progress"
  | "video_complete"
  | "audio_play"
  | "audio_pause"
  | "audio_progress"
  | "audio_complete"
  | "page_hidden"
  | "page_visible"
  | "ad_impression"
  | "env_enter"
  | "store_approach"
  | "store_pass"
  | "store_enter"
  | "store_leave"
  | "product_view"
  | "product_detail"
  | "bag_add"
  | "bag_remove"
  | "checkout"
  | "consideration"
  | "choice_select"
  | "shop_page"
  | "shop_search"
  | "shop_filter"
  | "shop_sort"
  | "checkout_start"
  | "scroll_depth"
  | "popup_close"
  | "ad_click";

const ENVIRONMENT_TYPES = new Set<EventType>([
  "env_enter",
  "store_approach",
  "store_pass",
  "store_enter",
  "store_leave",
  "product_view",
  "product_detail",
  "bag_add",
  "bag_remove",
  "checkout",
  "consideration",
  "choice_select",
  "shop_page",
  "shop_search",
  "shop_filter",
  "shop_sort",
  "checkout_start",
  "scroll_depth",
  "popup_close",
  "ad_click",
]);

export type EventData = Record<string, string | number | boolean | null>;
interface PendingEvent {
  id: string;
  type: EventType;
  block?: string;
  at: string;
  data?: EventData;
}

const MEDIA_TYPES = new Set<EventType>([
  "image_view",
  "media_visible",
  "video_play",
  "video_pause",
  "video_seek",
  "video_progress",
  "video_complete",
  "audio_play",
  "audio_pause",
  "audio_progress",
  "audio_complete",
  "ad_impression",
]);

export class EventLogger {
  private queue: PendingEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private sending = false;
  private readonly storageKey: string;

  constructor(
    private session: { id: string; token: string },
    private enabled: { navigation: boolean; media: boolean; environment: boolean },
  ) {
    this.storageKey = `rp:events:${session.id}`;
    try {
      this.queue = JSON.parse(localStorage.getItem(this.storageKey) ?? "[]");
    } catch {
      this.queue = [];
    }
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), 5000);
    window.addEventListener("pagehide", this.onHide);
    document.addEventListener("visibilitychange", this.onVisibility);
    void this.flush();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    window.removeEventListener("pagehide", this.onHide);
    document.removeEventListener("visibilitychange", this.onVisibility);
    void this.flush(true);
  }

  log(type: EventType, block?: string, data?: EventData) {
    const on = MEDIA_TYPES.has(type) ? this.enabled.media : ENVIRONMENT_TYPES.has(type) ? this.enabled.environment : this.enabled.navigation;
    if (!on) return;
    this.queue.push({ id: crypto.randomUUID(), type, block, at: new Date().toISOString(), data });
    this.persist();
    if (this.queue.length >= 20) void this.flush();
  }

  private persist() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue.slice(-500)));
    } catch {
      // Storage unavailable: events are still sent while the page is open.
    }
  }

  private onHide = () => void this.flush(true);
  private onVisibility = () => {
    this.log(document.visibilityState === "hidden" ? "page_hidden" : "page_visible");
    if (document.visibilityState === "hidden") void this.flush(true);
  };

  async flush(keepalive = false) {
    if (this.sending || this.queue.length === 0) return;
    this.sending = true;
    const batch = this.queue.slice(0, 100);
    try {
      const res = await fetch("/api/p/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: this.session.id, token: this.session.token, events: batch }),
        keepalive,
      });
      // 401/409: the session ended or is invalid; drop events rather than retry forever.
      if (res.ok || res.status === 401 || res.status === 409 || res.status === 400) {
        const sent = new Set(batch.map((e) => e.id));
        this.queue = this.queue.filter((e) => !sent.has(e.id));
        this.persist();
      }
    } catch {
      // Offline: keep the events and retry on the next tick.
    } finally {
      this.sending = false;
    }
  }
}
