import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StudyConfig } from "@/lib/study/schema";
import { emptyShop, type EnvSummary, type ExportExtras, type MediaSummary, type SessionRecord } from "./columns";

const PAGE = 1000;

async function all<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export interface EventRow {
  id: number;
  session_id: string;
  type: string;
  block_key: string | null;
  client_at: string | null;
  created_at: string;
  data: Record<string, unknown>;
}

export interface ExportData {
  versions: { id: string; version_number: number; config: StudyConfig; published_at: string; locked: boolean }[];
  sessions: SessionRecord[];
  extras: ExportExtras;
}

/** Media referenced anywhere in the configs (stable asset ids). */
function collectAssets(configs: StudyConfig[]): ExportExtras["assets"] {
  const seen = new Map<string, { id: string; kind: string; label: string }>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.assetId === "string" && typeof o.storagePath === "string" && !seen.has(o.assetId)) {
        const file = o.storagePath.split("/").pop() ?? o.assetId;
        seen.set(o.assetId, { id: o.assetId, kind: String(o.kind ?? "image"), label: file.replace(/^[0-9a-f-]{36}-/, "") });
      }
      Object.values(o).forEach(walk);
    }
  };
  configs.forEach(walk);
  return [...seen.values()];
}

/** Load everything needed for exports. RLS limits this to studies the researcher can read. */
export async function loadExportData(supabase: SupabaseClient, studyId: string, includeTest: boolean): Promise<ExportData> {
  const { data: versions, error: vErr } = await supabase
    .from("study_versions")
    .select("id, version_number, config, published_at, locked")
    .eq("study_id", studyId)
    .order("version_number", { ascending: false });
  if (vErr) throw vErr;
  const versionNumber = new Map((versions ?? []).map((v) => [v.id as string, v.version_number as number]));

  const sessions = await all<Record<string, unknown>>((from, to) => {
    let q = supabase
      .from("participant_sessions")
      .select(
        "id, study_version_id, status, is_test, excluded, exclusion_reason, screen_reason, language, device_class, started_at, ended_at, last_activity_at, condition, assigned_variables, block_orders, recruitment_params, completion_code",
      )
      .eq("study_id", studyId)
      .order("started_at")
      .range(from, to);
    if (!includeTest) q = q.eq("is_test", false);
    return q;
  });

  const responses = await all<{ session_id: string; block_key: string; block_type: string; answers: Record<string, unknown>; entered_at: string | null; submitted_at: string }>(
    (from, to) =>
      supabase
        .from("responses")
        .select("session_id, block_key, block_type, answers, entered_at, submitted_at")
        .eq("study_id", studyId)
        .order("submitted_at")
        .range(from, to),
  );
  const consents = await all<{ session_id: string; decision: "given" | "declined" }>((from, to) =>
    supabase.from("consent_records").select("session_id, decision").eq("study_id", studyId).range(from, to),
  );
  const mediaEvents = await all<{ session_id: string; type: string; data: Record<string, unknown> }>((from, to) =>
    supabase
      .from("events")
      .select("session_id, type, data")
      .eq("study_id", studyId)
      .in("type", ["media_visible", "video_play", "audio_play", "video_progress", "audio_progress", "video_complete", "audio_complete"])
      .order("id")
      .range(from, to),
  );

  const envEvents = await all<{ session_id: string; type: string; block_key: string | null; data: Record<string, unknown> }>((from, to) =>
    supabase
      .from("events")
      .select("session_id, type, block_key, data")
      .eq("study_id", studyId)
      .in("type", ["store_approach", "store_enter", "store_leave", "store_pass", "product_view", "product_detail", "shop_search", "shop_filter", "shop_sort", "checkout_start", "scroll_depth", "popup_close", "post_visible"])
      .order("id")
      .range(from, to),
  );
  const villageDone: { session_id: string; block_id: string; shop: boolean }[] = [];

  const bySession = new Map<string, SessionRecord>();
  const paramKeys = new Set<string>();
  for (const s of sessions) {
    const params = (s.recruitment_params ?? {}) as Record<string, string>;
    Object.keys(params).forEach((k) => paramKeys.add(k));
    bySession.set(s.id as string, {
      id: s.id as string,
      version_number: versionNumber.get(s.study_version_id as string) ?? 0,
      status: s.status as string,
      is_test: s.is_test as boolean,
      excluded: s.excluded as boolean,
      exclusion_reason: (s.exclusion_reason as string) ?? null,
      screen_reason: (s.screen_reason as string) ?? null,
      language: s.language as string,
      device_class: (s.device_class as string) ?? null,
      started_at: s.started_at as string,
      ended_at: (s.ended_at as string) ?? null,
      last_activity_at: s.last_activity_at as string,
      consent: null,
      condition: (s.condition as string) ?? null,
      factors: (s.assigned_variables ?? {}) as Record<string, unknown>,
      groups: (s.block_orders ?? {}) as Record<string, string[]>,
      params,
      completion_code: (s.completion_code as string) ?? null,
      answers: {},
      blockSeconds: {},
      blocksDone: [],
      media: {},
      env: {},
    });
  }
  for (const r of responses) {
    const s = bySession.get(r.session_id);
    if (!s) continue;
    if (r.block_type === "village" || r.block_type === "online_shop" || r.block_type === "social_feed") villageDone.push({ session_id: r.session_id, block_id: r.block_key, shop: r.block_type === "online_shop" });
    s.blocksDone!.push(r.block_key);
    const level = r.block_key.includes("#") ? r.block_key.split("#")[1] : null;
    for (const [k, v] of Object.entries(r.answers ?? {})) s.answers[level ? `${k}_${level}` : k] = v;
    if (r.entered_at) {
      s.blockSeconds[r.block_key] = Math.round((Date.parse(r.submitted_at) - Date.parse(r.entered_at)) / 100) / 10;
    }
  }
  for (const c of consents) {
    const s = bySession.get(c.session_id);
    if (s) s.consent = c.decision;
  }
  for (const e of mediaEvents) {
    const s = bySession.get(e.session_id);
    if (!s) continue;
    // Aggregate per asset, and per ad when the event came from an ad creative.
    const keys = [e.data?.asset, typeof e.data?.ad === "string" ? `ad:${e.data.ad}` : null].filter((k): k is string => typeof k === "string");
    for (const key of keys) {
      const m: MediaSummary = (s.media[key] ??= { visibleMs: 0, maxPct: 0, plays: 0, completed: false });
      if (e.type === "media_visible") m.visibleMs += Number(e.data.ms) || 0;
      else if (e.type.endsWith("_play")) m.plays += 1;
      else if (e.type.endsWith("_progress")) m.maxPct = Math.max(m.maxPct, Number(e.data.pct) || 0);
      else if (e.type.endsWith("_complete")) {
        m.maxPct = 100;
        m.completed = true;
      }
    }
  }
  for (const e of envEvents) {
    const s = bySession.get(e.session_id);
    if (!s || !e.block_key) continue;
    const env: EnvSummary = (s.env[e.block_key.split("#")[0]] ??= { stores: {}, productsViewed: 0, details: 0 });
    const store = typeof e.data?.store === "string" ? e.data.store : null;
    const st = store ? (env.stores[store] ??= { approached: false, entered: false, dwellMs: 0, views: 0, passes: 0 }) : null;
    if (e.type === "store_approach" && st) st.approached = true;
    else if (e.type === "store_enter" && st) st.entered = st.approached = true;
    else if (e.type === "store_leave" && st) st.dwellMs += Number(e.data.ms) || 0;
    else if (e.type === "store_pass" && st) st.passes += 1;
    else if (e.type === "product_view") {
      env.productsViewed += 1;
      if (st) st.views += 1;
    } else if (e.type === "product_detail") env.details += 1;
    if (e.type === "post_visible" && typeof e.data?.post === "string") {
      const f = (env.feed ??= { visibleMs: {} });
      f.visibleMs[e.data.post] = (f.visibleMs[e.data.post] ?? 0) + (Number(e.data.ms) || 0);
      continue;
    }
    if (store) continue;
    // Online shop events carry a product instead of a store.
    const product = typeof e.data?.product === "string" ? e.data.product : null;
    const isShop = product !== null || ["shop_search", "shop_filter", "shop_sort", "checkout_start", "scroll_depth", "popup_close"].includes(e.type);
    if (!isShop) continue;
    const sh = (env.shop ??= emptyShop());
    if (e.type === "product_view" && product) (sh.products[product] ??= { views: 0, details: 0 }).views += 1;
    else if (e.type === "product_detail" && product) (sh.products[product] ??= { views: 0, details: 0 }).details += 1;
    else if (e.type === "shop_search") sh.searches += 1;
    else if (e.type === "shop_filter") sh.filters += 1;
    else if (e.type === "shop_sort") sh.sorts += 1;
    else if (e.type === "checkout_start") sh.checkoutStarted = true;
    else if (e.type === "scroll_depth") sh.maxScroll = Math.max(sh.maxScroll, Number(e.data.pct) || 0);
    else if (e.type === "popup_close" && sh.popupCloseMs === null) sh.popupCloseMs = Number(e.data.ms) || 0;
  }
  // A session that finished a village block but logged no environment events gets zeros, not blanks.
  for (const { session_id, block_id, shop } of villageDone) {
    const s = bySession.get(session_id);
    if (s && !s.env[block_id]) s.env[block_id] = { stores: {}, productsViewed: 0, details: 0 };
    if (s && shop) s.env[block_id].shop ??= emptyShop();
  }

  const configs = (versions ?? []).map((v) => v.config as StudyConfig);
  return {
    versions: (versions ?? []) as ExportData["versions"],
    sessions: [...bySession.values()],
    extras: { paramKeys: [...paramKeys].sort(), assets: collectAssets(configs) },
  };
}

/** Long-format event log (one row per event). */
export async function loadEvents(supabase: SupabaseClient, studyId: string, includeTest: boolean): Promise<EventRow[]> {
  const testIds = new Set<string>();
  if (!includeTest) {
    const tests = await all<{ id: string }>((from, to) =>
      supabase.from("participant_sessions").select("id").eq("study_id", studyId).eq("is_test", true).range(from, to),
    );
    tests.forEach((t) => testIds.add(t.id));
  }
  const rows = await all<EventRow>((from, to) =>
    supabase
      .from("events")
      .select("id, session_id, type, block_key, client_at, created_at, data")
      .eq("study_id", studyId)
      .order("id")
      .range(from, to),
  );
  return rows.filter((r) => !testIds.has(r.session_id));
}
