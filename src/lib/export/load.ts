import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StudyConfig } from "@/lib/study/schema";
import type { SessionRecord } from "./columns";

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

export interface ExportData {
  versions: { id: string; version_number: number; config: StudyConfig; published_at: string; locked: boolean }[];
  sessions: SessionRecord[];
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
      .select("id, study_version_id, status, is_test, excluded, exclusion_reason, language, device_class, started_at, ended_at")
      .eq("study_id", studyId)
      .order("started_at")
      .range(from, to);
    if (!includeTest) q = q.eq("is_test", false);
    return q;
  });

  const responses = await all<{ session_id: string; block_key: string; answers: Record<string, unknown>; entered_at: string | null; submitted_at: string }>(
    (from, to) =>
      supabase
        .from("responses")
        .select("session_id, block_key, answers, entered_at, submitted_at")
        .eq("study_id", studyId)
        .order("submitted_at")
        .range(from, to),
  );
  const consents = await all<{ session_id: string; decision: "given" | "declined" }>((from, to) =>
    supabase.from("consent_records").select("session_id, decision").eq("study_id", studyId).range(from, to),
  );

  const bySession = new Map<string, SessionRecord>();
  for (const s of sessions) {
    bySession.set(s.id as string, {
      id: s.id as string,
      version_number: versionNumber.get(s.study_version_id as string) ?? 0,
      status: s.status as string,
      is_test: s.is_test as boolean,
      excluded: s.excluded as boolean,
      exclusion_reason: (s.exclusion_reason as string) ?? null,
      language: s.language as string,
      device_class: (s.device_class as string) ?? null,
      started_at: s.started_at as string,
      ended_at: (s.ended_at as string) ?? null,
      consent: null,
      answers: {},
      blockSeconds: {},
    });
  }
  for (const r of responses) {
    const s = bySession.get(r.session_id);
    if (!s) continue;
    Object.assign(s.answers, r.answers);
    if (r.entered_at) {
      const blockId = r.block_key.split("#")[0];
      s.blockSeconds[blockId] = Math.round((Date.parse(r.submitted_at) - Date.parse(r.entered_at)) / 100) / 10;
    }
  }
  for (const c of consents) {
    const s = bySession.get(c.session_id);
    if (s) s.consent = c.decision;
  }

  return {
    versions: (versions ?? []) as ExportData["versions"],
    sessions: [...bySession.values()],
  };
}
