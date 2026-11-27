import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { assign, betweenFactors, usageOf } from "@/lib/study/engine";
import { DEFAULT_SETTINGS, type Assignment, type Design, type Session, type Study } from "@/lib/study/types";

/**
 * Studies, published versions and participant sessions, stored in the database. Researcher
 * functions always take the owner's id and touch only that owner's rows.
 */

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : undefined);
const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const json = (v: unknown) => JSON.stringify(v);

/** Largest study (text only; media are links) and session accepted, in characters of JSON. */
export const MAX_STUDY_CHARS = 2_000_000;
export const MAX_SESSION_CHARS = 1_000_000;

export type StudyMeta = { publishedVersion: number | null; publishedAt?: string; changedSincePublish: boolean };
export type StudyRow = { study: Study; meta: StudyMeta };

type Row = { id: string; owner_id: string; data: Study; published_version: number | null; published_at: unknown; updated_at: unknown; content_updated_at: unknown; created_at: unknown };

function toStudy(r: Row): StudyRow {
  const updated = iso(r.updated_at)!;
  const published = iso(r.published_at);
  // Content saved more than a second after publishing means the draft differs from the live
  // version. Run settings (repeats, return links, closing) apply at once and do not count.
  const changed = r.published_version ? Date.parse(iso(r.content_updated_at)!) - Date.parse(published!) > 1000 : true;
  return {
    study: { ...r.data, settings: { ...DEFAULT_SETTINGS, ...r.data.settings }, updatedAt: updated, createdAt: iso(r.created_at)! },
    meta: { publishedVersion: r.published_version, publishedAt: published, changedSincePublish: changed },
  };
}

/* ----------------------------------------------------------------------------- researcher */

export async function listStudies(ownerId: string) {
  const rows = await sql<Row & { completed: number; unfinished: number }>`
    select s.*,
      (select count(*)::int from sessions_run r where r.study_id = s.id and not r.test and r.status = 'completed') as completed,
      (select count(*)::int from sessions_run r where r.study_id = s.id and not r.test and r.status = 'active') as unfinished
    from studies s where s.owner_id = ${ownerId} order by s.updated_at desc`;
  return rows.map((r) => ({ ...toStudy(r), completed: r.completed, unfinished: r.unfinished }));
}

export async function getStudy(ownerId: string, id: string): Promise<StudyRow | null> {
  const rows = await sql<Row>`select * from studies where id = ${id} and owner_id = ${ownerId}`;
  return rows[0] ? toStudy(rows[0]) : null;
}

/** Creates or updates a draft. Returns false when the id belongs to someone else. */
export async function saveStudy(ownerId: string, study: Study): Promise<boolean> {
  const rows = await sql<{ id: string }>`
    insert into studies (id, owner_id, data) values (${study.id}, ${ownerId}, ${json(study)}::jsonb)
    on conflict (id) do update set data = excluded.data, updated_at = now(),
      content_updated_at = case when (studies.data - 'settings' - 'updatedAt' - 'status' - 'version') is distinct from (excluded.data - 'settings' - 'updatedAt' - 'status' - 'version')
        then now() else studies.content_updated_at end
    where studies.owner_id = ${ownerId}
    returning id`;
  return rows.length > 0;
}

export async function deleteStudy(ownerId: string, id: string) {
  await sql`delete from studies where id = ${id} and owner_id = ${ownerId}`;
}

/** Freezes the current draft as the next version; participants receive the newest version. */
export async function publishStudy(ownerId: string, id: string): Promise<StudyRow | null> {
  const current = await getStudy(ownerId, id);
  if (!current) return null;
  const version = (current.meta.publishedVersion ?? 0) + 1;
  const snapshot: Study = { ...current.study, status: "published", version };
  await sql`insert into study_versions (study_id, version, data) values (${id}, ${version}, ${json(snapshot)}::jsonb)`;
  await sql`update studies set data = ${json(snapshot)}::jsonb, published_version = ${version}, published_at = now(), updated_at = now(), content_updated_at = now() where id = ${id} and owner_id = ${ownerId}`;
  return getStudy(ownerId, id);
}

export async function listSessions(ownerId: string, studyId: string): Promise<Session[] | null> {
  const owned = await sql`select 1 from studies where id = ${studyId} and owner_id = ${ownerId}`;
  if (!owned.length) return null;
  const rows = await sql<{ data: Session }>`select data from sessions_run where study_id = ${studyId} order by started_at`;
  return rows.map((r) => r.data);
}

export async function deleteSession(ownerId: string, sessionId: string) {
  await sql`delete from sessions_run r using studies s where r.id = ${sessionId} and s.id = r.study_id and s.owner_id = ${ownerId}`;
}

/** Deletes every response of a study (test responses too when asked). */
export async function deleteSessions(ownerId: string, studyId: string, includeTest: boolean) {
  await sql`delete from sessions_run r using studies s where r.study_id = ${studyId} and s.id = r.study_id and s.owner_id = ${ownerId} and (${includeTest} or not r.test)`;
}

/* ----------------------------------------------------------------------------- participants */

export type RunState = "open" | "closed" | "notPublished";

/** The newest published version, and whether it is accepting participants. */
export async function publishedStudy(id: string): Promise<{ study: Study; state: RunState } | null> {
  const rows = await sql<{ data: Study; published_version: number | null }>`select data, published_version from studies where id = ${id}`;
  const row = rows[0];
  if (!row) return null;
  if (!row.published_version) return { study: row.data, state: "notPublished" };
  const v = await sql<{ data: Study }>`select data from study_versions where study_id = ${id} and version = ${row.published_version}`;
  // Run settings are live: read from the draft, so they apply without republishing.
  const live = { ...DEFAULT_SETTINGS, ...row.data.settings };
  const study: Study = { ...v[0].data, settings: live };
  const closed = !!live.closed || (!!live.closesAt && Date.parse(live.closesAt) < Date.now());
  return { study, state: closed ? "closed" : "open" };
}

/** The draft, for the owner's own preview. */
export async function draftForOwner(ownerId: string, id: string) {
  const r = await getStudy(ownerId, id);
  return r ? r.study : null;
}

/**
 * Whether this device or panel ID has already taken part, under the study's repeat rule.
 * Test sessions never count.
 */
export async function alreadyTookPart(study: Study, deviceKey: string | null, panelId: string | null) {
  const rule = study.settings?.repeat ?? DEFAULT_SETTINGS.repeat;
  if (rule === "allow") return false;
  const byDevice = (rule === "device" || rule === "both") && !!deviceKey;
  const byPanel = (rule === "panel" || rule === "both") && !!panelId;
  if (!byDevice && !byPanel) return false;
  const rows = await sql`select 1 from sessions_run where study_id = ${study.id} and not test
    and ((${byDevice} and device_key = ${deviceKey}) or (${byPanel} and panel_id = ${panelId})) limit 1`;
  return rows.length > 0;
}

export async function createSession(session: Omit<Session, "id">, deviceKey: string | null, panelId: string | null) {
  const id = randomUUID();
  const token = randomBytes(24).toString("base64url");
  const full: Session = { ...session, id };
  await sql`insert into sessions_run (id, study_id, version, test, status, device_key, panel_id, token_hash, data)
    values (${id}, ${session.studyId}, ${session.version}, ${session.test}, ${session.status}, ${deviceKey}, ${panelId}, ${sha(token)}, ${json(full)}::jsonb)`;
  return { session: full, token };
}

export async function sessionByToken(id: string, token: string): Promise<Session | null> {
  const rows = await sql<{ data: Session }>`select data from sessions_run where id = ${id} and token_hash = ${sha(token)}`;
  return rows[0]?.data ?? null;
}

// Balancing and quotas count completed sessions and ones started in the last 30 minutes.

/**
 * The condition for a new participant: the least-used combination of levels, counting
 * completed and recently started sessions. A preview may ask for a particular combination.
 */
export async function assignmentFor(study: Study, preview?: Record<string, string>): Promise<Assignment> {
  const design = study.design;
  if (preview) {
    const a = assign(design, usageOf(design, []));
    for (const f of betweenFactors(design)) if (preview[f.id] && f.levels.some((l) => l.id === preview[f.id])) a.between[f.id] = preview[f.id];
    return a;
  }
  if (!design?.factors.length) return { between: {}, orders: {} };
  const rows = await sql<{ a: Assignment | null }>`select data->'assignment' as a from sessions_run where study_id = ${study.id} and not test and (status = 'completed' or (status = 'active' and started_at > now() - interval '30 minutes'))`;
  return assign(design, usageOf(design, rows.map((r) => r.a).filter((x): x is Assignment => !!x)));
}

/** The design of the version a session answers (the draft's for a preview). */
async function designOf(session: Session): Promise<Design | undefined> {
  const rows = session.test
    ? await sql<{ d: Design | null }>`select data->'design' as d from studies where id = ${session.studyId}`
    : await sql<{ d: Design | null }>`select data->'design' as d from study_versions where study_id = ${session.studyId} and version = ${session.version}`;
  return rows[0]?.d ?? undefined;
}

/** Whether this participant's screening answer falls in a quota that is already full. */
async function quotaFull(session: Session): Promise<boolean> {
  const quotas = (await designOf(session))?.quotas ?? [];
  for (const q of quotas) {
    const answer = session.answers[q.variable];
    const hit = Array.isArray(answer) ? answer.includes(q.value) : answer !== undefined && String(answer) === q.value;
    if (!hit) continue;
    const rows = await sql<{ n: number }>`select count(*)::int as n from sessions_run
      where study_id = ${session.studyId} and not test and id <> ${session.id} and (status = 'completed' or (status = 'active' and started_at > now() - interval '30 minutes'))
      and (data->'answers'->>${q.variable} = ${q.value} or (jsonb_typeof(data->'answers'->${q.variable}) = 'array' and data->'answers'->${q.variable} ? ${q.value}))`;
    if ((rows[0]?.n ?? 0) >= q.target) return true;
  }
  return false;
}

const FINAL = new Set(["completed", "screened", "declined"]);

/**
 * Saves progress. A finished session can no longer be changed. A participant whose screening
 * answer falls in a full quota is screened out ("quotaFull").
 */
export async function saveSession(id: string, token: string, next: Session): Promise<"ok" | "notFound" | "finished" | "quotaFull"> {
  const current = await sessionByToken(id, token);
  if (!current) return "notFound";
  if (FINAL.has(current.status)) return "finished";
  // Identity fields stay as they were created; only progress changes.
  const merged: Session = { ...next, id: current.id, studyId: current.studyId, version: current.version, test: current.test, startedAt: current.startedAt, params: current.params, assignment: current.assignment };
  let status = ["active", ...FINAL].includes(merged.status) ? merged.status : "active";
  let full = false;
  if (status !== "declined" && Object.keys(merged.answers).length && (await quotaFull(merged))) {
    full = true;
    status = "screened";
    merged.flags = [...new Set([...merged.flags, "quota_full"])];
    merged.finishedAt ??= new Date().toISOString();
  }
  await sql`update sessions_run set data = ${json({ ...merged, status })}::jsonb, status = ${status}, updated_at = now() where id = ${id}`;
  return full ? "quotaFull" : "ok";
}
