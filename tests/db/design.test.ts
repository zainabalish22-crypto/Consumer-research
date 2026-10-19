import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, createUser, as } from "./harness";

let db: PGlite;
let alice: string;
let ws: string;
let projectId: string;

const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

type Session = { session_id: string; resume_token: string; assignment: { condition: string | null; factors: Record<string, unknown>; groups: Record<string, string[]> } };

const T = (en: string) => ({ en });
const baseBlocks = [
  { id: "w", name: "", type: "welcome", heading: T("Hi"), body: T("") },
  { id: "e", name: "", type: "end", heading: T("Bye"), body: T(""), uniqueCode: true },
];
const cfg = (design: object, blocks: object[] = baseBlocks) => ({
  schemaVersion: 1,
  settings: { languages: ["en"], defaultLanguage: "en" },
  design: { conditions: [], assignment: "balanced", factors: [], orderGroups: [], ...design },
  blocks,
});
const levels = (...vals: string[]) => vals.map((v) => ({ id: v, value: v, label: T(v) }));

async function publish(config: object): Promise<string> {
  return as(db, alice, async () => {
    const s = await one<{ id: string; slug: string }>(
      "insert into studies (project_id, title, draft_config, created_by) values ($1, 'S', $2, $3) returning id, slug",
      [projectId, JSON.stringify(config), alice],
    );
    await db.query("select publish_study($1)", [s.id]);
    return s.slug;
  });
}

async function start(slug: string, test = false, overrides: object = {}): Promise<Session> {
  const runAs = test ? alice : null;
  return as(db, runAs, async () => (await one<{ s: Session }>("select start_session($1, 'en', $2, '{}'::jsonb, null, $3) as s", [slug, test, JSON.stringify(overrides)])).s);
}

const tally = (xs: string[]) => xs.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {});

beforeAll(async () => {
  db = await freshDb();
  alice = await createUser(db, "alice@example.test");
  ws = (await one<{ workspace_id: string }>("select workspace_id from workspace_members where user_id = $1", [alice])).workspace_id;
  projectId = (
    await as(db, alice, () =>
      one<{ id: string }>("insert into projects (workspace_id, name, created_by) values ($1, 'P', $2) returning id", [ws, alice]),
    )
  ).id;
});

describe("condition assignment", () => {
  it("balanced assignment gives exactly equal groups in complete blocks", async () => {
    const slug = await publish(cfg({ conditions: [{ id: "village" }, { id: "survey" }] }));
    const conds: string[] = [];
    for (let i = 0; i < 100; i++) conds.push((await start(slug)).assignment.condition!);
    expect(tally(conds)).toEqual({ village: 50, survey: 50 });
    // Permuted blocks: every consecutive pair contains both conditions.
    for (let i = 0; i < 100; i += 2) expect(new Set(conds.slice(i, i + 2)).size).toBe(2);
    // Not simply alternating: the order within blocks varies.
    expect(new Set(conds.filter((_, i) => i % 2 === 0)).size).toBe(2);
  });

  it("respects weights", async () => {
    const slug = await publish(cfg({ conditions: [{ id: "a", weight: 2 }, { id: "b", weight: 1 }] }));
    const conds: string[] = [];
    for (let i = 0; i < 90; i++) conds.push((await start(slug)).assignment.condition!);
    expect(tally(conds)).toEqual({ a: 60, b: 30 });
  });

  it("stops assigning to a condition whose quota of completed sessions is reached", async () => {
    const slug = await publish(cfg({ conditions: [{ id: "a", quota: 2 }, { id: "b" }] }));
    let done = 0;
    while (done < 2) {
      const s = await start(slug);
      if (s.assignment.condition === "a") {
        await as(db, null, () => db.query("select complete_session($1, $2)", [s.session_id, s.resume_token]));
        done++;
      }
    }
    for (let i = 0; i < 10; i++) expect((await start(slug)).assignment.condition).toBe("b");
  });

  it("refuses new participants when every condition is full", async () => {
    const slug = await publish(cfg({ conditions: [{ id: "a", quota: 1 }, { id: "b", quota: 1 }] }));
    for (let i = 0; i < 2; i++) {
      const s = await start(slug);
      await as(db, null, () => db.query("select complete_session($1, $2)", [s.session_id, s.resume_token]));
    }
    await expect(start(slug)).rejects.toThrow(/full/);
  });

  it("test sessions can choose a condition and do not disturb the balance counters", async () => {
    const slug = await publish(cfg({ conditions: [{ id: "a" }, { id: "b" }] }));
    for (let i = 0; i < 5; i++) expect((await start(slug, true, { condition: "b" })).assignment.condition).toBe("b");
    const real: string[] = [];
    for (let i = 0; i < 10; i++) real.push((await start(slug)).assignment.condition!);
    expect(tally(real)).toEqual({ a: 5, b: 5 });
  });

  it("participants cannot pass overrides", async () => {
    const slug = await publish(cfg({ conditions: [{ id: "a" }, { id: "b" }] }));
    const got: string[] = [];
    for (let i = 0; i < 10; i++) {
      const s = await as(db, null, async () =>
        (await one<{ s: Session }>("select start_session($1, 'en', false, '{}'::jsonb, null, $2) as s", [slug, JSON.stringify({ condition: "a" })])).s,
      );
      got.push(s.assignment.condition!);
    }
    expect(tally(got)).toEqual({ a: 5, b: 5 });
  });
});

describe("factors", () => {
  it("balanced pick factor is balanced within each condition", async () => {
    const slug = await publish(
      cfg({
        conditions: [{ id: "c1" }, { id: "c2" }],
        factors: [{ id: "tb", variable: "target_brand", kind: "pick", method: "balanced", levels: levels("A", "B", "C"), balanceWithinCondition: true }],
      }),
    );
    const byCond: Record<string, string[]> = { c1: [], c2: [] };
    for (let i = 0; i < 120; i++) {
      const s = await start(slug);
      byCond[s.assignment.condition!].push(s.assignment.factors.target_brand as string);
    }
    expect(tally(byCond.c1)).toEqual({ A: 20, B: 20, C: 20 });
    expect(tally(byCond.c2)).toEqual({ A: 20, B: 20, C: 20 });
  });

  it("Latin square orders put every level in every position equally often", async () => {
    const slug = await publish(cfg({ factors: [{ id: "ao", variable: "ad_order", kind: "order", method: "latin", levels: levels("A", "B", "C", "D") }] }));
    const orders: string[][] = [];
    for (let i = 0; i < 8; i++) orders.push((await start(slug)).assignment.factors.ad_order as string[]);
    for (let pos = 0; pos < 4; pos++) expect(tally(orders.map((o) => o[pos]))).toEqual({ A: 2, B: 2, C: 2, D: 2 });
    // Williams design: each level is immediately followed by each other level equally often.
    const pairs = tally(orders.flatMap((o) => o.slice(1).map((x, i) => `${o[i]}${x}`)));
    expect(Object.values(pairs).every((n) => n === 2)).toBe(true);
    expect(Object.keys(pairs)).toHaveLength(12);
  });

  it("Latin squares of odd size use 2n rows and stay position-balanced", async () => {
    const slug = await publish(cfg({ factors: [{ id: "o", variable: "o3", kind: "order", method: "latin", levels: levels("X", "Y", "Z") }] }));
    const orders: string[][] = [];
    for (let i = 0; i < 6; i++) orders.push((await start(slug)).assignment.factors.o3 as string[]);
    for (let pos = 0; pos < 3; pos++) expect(tally(orders.map((o) => o[pos]))).toEqual({ X: 2, Y: 2, Z: 2 });
  });

  it("full permutation cycles through every order", async () => {
    const slug = await publish(cfg({ factors: [{ id: "p", variable: "perm", kind: "order", method: "permutation", levels: levels("A", "B", "C") }] }));
    const orders = new Set<string>();
    for (let i = 0; i < 6; i++) orders.add(((await start(slug)).assignment.factors.perm as string[]).join(""));
    expect(orders.size).toBe(6);
  });

  it("mapping assigns each level to exactly one target (e.g. offers onto outlets)", async () => {
    const slug = await publish(
      cfg({
        factors: [
          {
            id: "of",
            variable: "offer_for_store",
            kind: "mapping",
            method: "latin",
            levels: levels("BOGO", "HALF", "ONEOFF", "NONE"),
            targets: levels("S1", "S2", "S3", "S4"),
          },
        ],
      }),
    );
    const perStoreOffer: Record<string, string[]> = { S1: [], S2: [], S3: [], S4: [] };
    for (let i = 0; i < 8; i++) {
      const m = (await start(slug)).assignment.factors.offer_for_store as Record<string, string>;
      expect(new Set(Object.values(m)).size).toBe(4);
      for (const [store, offer] of Object.entries(m)) perStoreOffer[store].push(offer);
    }
    for (const offers of Object.values(perStoreOffer)) expect(tally(offers)).toEqual({ BOGO: 2, HALF: 2, ONEOFF: 2, NONE: 2 });
  });

  it("assigns block order groups", async () => {
    const blocks = [
      baseBlocks[0],
      { id: "q1", name: "", type: "instructions", heading: T("1"), body: T(""), media: [], orderGroup: "g" },
      { id: "q2", name: "", type: "instructions", heading: T("2"), body: T(""), media: [], orderGroup: "g" },
      baseBlocks[1],
    ];
    const slug = await publish(cfg({ orderGroups: [{ id: "g", method: "latin" }] }, blocks));
    const firsts: string[] = [];
    for (let i = 0; i < 4; i++) firsts.push((await start(slug)).assignment.groups.g[0]);
    expect(tally(firsts)).toEqual({ q1: 2, q2: 2 });
  });

  it("internal assignment functions cannot be called directly", async () => {
    await as(db, null, async () => {
      await expect(db.query("select next_counter(gen_random_uuid(), 'x')")).rejects.toThrow();
    });
    await as(db, alice, async () => {
      await expect(db.query("select next_counter(gen_random_uuid(), 'x')")).rejects.toThrow();
      await expect(db.query("select assign_design(gen_random_uuid(), '{}'::jsonb, false, '{}'::jsonb)")).rejects.toThrow();
    });
  });
});

describe("unique completion codes", () => {
  it("are generated per session and returned again on repeat calls", async () => {
    const slug = await publish(cfg({}));
    const s = await start(slug);
    const a = await as(db, null, () => one<{ r: { completion_code: string } }>("select complete_session($1, $2) as r", [s.session_id, s.resume_token]));
    expect(a.r.completion_code).toMatch(/^[0-9A-F]{10}$/);
    const b = await as(db, null, () => one<{ r: { completion_code: string } }>("select complete_session($1, $2) as r", [s.session_id, s.resume_token]));
    expect(b.r.completion_code).toBe(a.r.completion_code);
  });
});

describe("events", () => {
  it("are idempotent, validated, and deleted on withdrawal", async () => {
    const slug = await publish(cfg({}));
    const s = await start(slug);
    const id = "11111111-1111-4111-8111-111111111111";
    const batch = JSON.stringify([
      { id, type: "block_enter", block: "w", at: "2026-10-20T10:00:00Z" },
      { id: "22222222-2222-4222-8222-222222222222", type: "keystrokes", block: "w" },
    ]);
    await as(db, null, async () => {
      expect((await one<{ n: number }>("select log_events($1, $2, $3) as n", [s.session_id, s.resume_token, batch])).n).toBe(1);
      expect((await one<{ n: number }>("select log_events($1, $2, $3) as n", [s.session_id, s.resume_token, batch])).n).toBe(0);
      await expect(db.query("select log_events($1, 'bad', $2)", [s.session_id, batch])).rejects.toThrow(/invalid session/);
    });
    const types = (await db.query<{ type: string }>("select type from events where session_id = $1 order by id", [s.session_id])).rows.map((r) => r.type);
    expect(types).toEqual(["session_start", "block_enter"]);
    await as(db, null, () => db.query("select withdraw_session($1, $2)", [s.session_id, s.resume_token]));
    const after = (await db.query<{ type: string }>("select type from events where session_id = $1", [s.session_id])).rows.map((r) => r.type);
    expect(after).toEqual(["session_withdrawn"]);
  });
});

describe("cross-study exclusion", () => {
  const exclusionBlock = (record?: string, exclude: string[] = []) => ({
    id: "x",
    name: "",
    type: "exclusion_check",
    prompt: T("Email"),
    inputKind: "email",
    recordList: record,
    excludeLists: exclude,
    excludedMessage: T("Thanks"),
  });

  it("excludes people already on another study's list without storing the identifier", async () => {
    const first = await publish(cfg({}, [baseBlocks[0], exclusionBlock("foodcourt-2026"), baseBlocks[1]]));
    const second = await publish(cfg({}, [baseBlocks[0], exclusionBlock(undefined, ["foodcourt-2026"]), baseBlocks[1]]));

    const p1 = await start(first);
    const ex1 = await as(db, null, () => one<{ e: boolean }>("select check_exclusion($1, $2, 'x', $3) as e", [p1.session_id, p1.resume_token, "Sara@Example.com "]));
    expect(ex1.e).toBe(false);

    const p2 = await start(second);
    const ex2 = await as(db, null, () => one<{ e: boolean }>("select check_exclusion($1, $2, 'x', $3) as e", [p2.session_id, p2.resume_token, "sara@example.com"]));
    expect(ex2.e).toBe(true);
    const st = await one<{ status: string; screen_reason: string }>("select status, screen_reason from participant_sessions where id = $1", [p2.session_id]);
    expect(st).toEqual({ status: "screened_out", screen_reason: "repeat_participant" });

    const p3 = await start(second);
    const ex3 = await as(db, null, () => one<{ e: boolean }>("select check_exclusion($1, $2, 'x', $3) as e", [p3.session_id, p3.resume_token, "someone.else@example.com"]));
    expect(ex3.e).toBe(false);

    // The raw identifier appears nowhere in the database.
    const dump = await db.query<{ t: string }>(
      "select string_agg(t::text, ' ') as t from (select to_jsonb(x) t from exclusion_hashes x union all select to_jsonb(r) from responses r union all select to_jsonb(e) from events e union all select to_jsonb(s) from participant_sessions s) z",
    );
    expect(dump.rows[0].t.toLowerCase()).not.toContain("sara@example.com");

    // Researchers see list names and sizes, never salts or hashes.
    await as(db, alice, async () => {
      const sizes = (await db.query<{ key: string; entries: number }>("select * from exclusion_list_sizes()")).rows;
      expect(sizes.map((s) => [s.key, Number(s.entries)])).toEqual([["foodcourt-2026", 1]]);
      await expect(db.query("select salt from exclusion_lists")).rejects.toThrow();
      await expect(db.query("select * from exclusion_hashes")).rejects.toThrow();
    });
  });
});
