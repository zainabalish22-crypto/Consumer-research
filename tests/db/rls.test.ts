import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, createUser, as } from "./harness";
import { startingConfig } from "@/lib/study/factories";
import type { StudyConfig } from "@/lib/study/schema";

let db: PGlite;
let alice: string;
let bob: string;
let aliceWs: string;
let bobWs: string;
let studyId: string;
let slug: string;
let config: StudyConfig;

const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
const rows = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;

beforeAll(async () => {
  db = await freshDb();
  alice = await createUser(db, "alice@example.test");
  bob = await createUser(db, "bob@example.test");
  aliceWs = (await one<{ workspace_id: string }>("select workspace_id from workspace_members where user_id = $1", [alice])).workspace_id;
  bobWs = (await one<{ workspace_id: string }>("select workspace_id from workspace_members where user_id = $1", [bob])).workspace_id;
  config = startingConfig("questionnaire");

  await as(db, alice, async () => {
    const p = await one<{ id: string }>(
      "insert into projects (workspace_id, name, created_by) values ($1, 'Alice project', $2) returning id",
      [aliceWs, alice],
    );
    const s = await one<{ id: string; slug: string }>(
      "insert into studies (project_id, title, draft_config, created_by) values ($1, 'Study', $2, $3) returning id, slug",
      [p.id, JSON.stringify(config), alice],
    );
    studyId = s.id;
    slug = s.slug;
  });
});

describe("sign-up bootstrap", () => {
  it("creates a profile and a personal workspace owned by the user", async () => {
    const profile = await one<{ id: string }>("select id from profiles where id = $1", [alice]);
    expect(profile.id).toBe(alice);
    const m = await one<{ role: string }>("select role from workspace_members where user_id = $1", [alice]);
    expect(m.role).toBe("owner");
  });
});

describe("workspace isolation (RLS)", () => {
  it("a researcher sees only their own projects and studies", async () => {
    await as(db, bob, async () => {
      expect(await rows("select * from projects")).toHaveLength(0);
      expect(await rows("select * from studies")).toHaveLength(0);
      expect(await rows("select * from workspaces where id = $1", [aliceWs])).toHaveLength(0);
    });
    await as(db, alice, async () => {
      expect(await rows("select * from projects")).toHaveLength(1);
    });
  });

  it("rejects writes into another researcher's workspace", async () => {
    await as(db, bob, async () => {
      await expect(
        db.query("insert into projects (workspace_id, name, created_by) values ($1, 'x', $2)", [aliceWs, bob]),
      ).rejects.toThrow();
      const r = await db.query("update studies set title = 'hacked' where id = $1", [studyId]);
      expect(r.affectedRows ?? 0).toBe(0);
      await expect(db.query("select publish_study($1)", [studyId])).rejects.toThrow(/forbidden/);
    });
  });

  it("does not let researchers set protected study columns directly", async () => {
    await as(db, alice, async () => {
      await expect(db.query("update studies set slug = 'abcdefgh1234' where id = $1", [studyId])).rejects.toThrow();
    });
  });

  it("gives anonymous visitors no direct table access", async () => {
    await as(db, null, async () => {
      await expect(db.query("select * from studies")).rejects.toThrow();
      await expect(db.query("select * from participant_sessions")).rejects.toThrow();
      await expect(db.query("select * from responses")).rejects.toThrow();
    });
  });

  it("does not let anyone else create workspaces for themselves via insert", async () => {
    await as(db, bob, async () => {
      await expect(
        db.query("insert into workspaces (name, created_by) values ('x', $1)", [bob]),
      ).rejects.toThrow();
    });
    expect(bobWs).toBeTruthy();
  });
});

describe("publishing and versioning", () => {
  it("draft studies are not available to participants", async () => {
    await as(db, null, async () => {
      const r = await one<{ s: { available: boolean } }>("select get_public_study($1) as s", [slug]);
      expect(r.s.available).toBe(false);
      await expect(db.query("select start_session($1, 'en')", [slug])).rejects.toThrow(/not available/);
    });
  });

  it("publishing creates version 1 and activates the study", async () => {
    await as(db, alice, async () => {
      const r = await one<{ v: { version_number: number; created: boolean } }>("select publish_study($1) as v", [studyId]);
      expect(r.v).toMatchObject({ version_number: 1, created: true });
      const again = await one<{ v: { version_number: number; created: boolean } }>("select publish_study($1) as v", [studyId]);
      expect(again.v).toMatchObject({ version_number: 1, created: false });
      const s = await one<{ status: string }>("select status from studies where id = $1", [studyId]);
      expect(s.status).toBe("active");
    });
  });

  it("published versions are immutable", async () => {
    await expect(db.query("update study_versions set config = '{}'::jsonb where study_id = $1", [studyId])).rejects.toThrow(
      /immutable/,
    );
  });

  it("a changed draft becomes version 2; version 1 is unchanged", async () => {
    await as(db, alice, async () => {
      const changed = { ...config, settings: { ...config.settings, showProgress: false } };
      await db.query("update studies set draft_config = $1 where id = $2", [JSON.stringify(changed), studyId]);
      const r = await one<{ v: { version_number: number } }>("select publish_study($1) as v", [studyId]);
      expect(r.v.version_number).toBe(2);
      const v1 = await one<{ config: StudyConfig }>(
        "select config from study_versions where study_id = $1 and version_number = 1",
        [studyId],
      );
      expect(v1.config.settings.showProgress).toBe(true);
    });
  });

  it("locked versions cannot be unlocked", async () => {
    const v = await one<{ id: string }>("select id from study_versions where study_id = $1 and version_number = 1", [studyId]);
    await as(db, alice, () => db.query("select lock_study_version($1)", [v.id]));
    await expect(db.query("update study_versions set locked = false where id = $1", [v.id])).rejects.toThrow(/unlocked/);
  });
});

describe("participant sessions", () => {
  let sessionId: string;
  let token: string;
  const qBlock = () => config.blocks.find((b) => b.type === "questionnaire")!;
  const consentBlock = () => config.blocks.find((b) => b.type === "consent")!;

  it("anonymous participants can start a session on an active study", async () => {
    await as(db, null, async () => {
      const r = await one<{ s: { session_id: string; resume_token: string; is_test: boolean } }>(
        "select start_session($1, 'ar') as s",
        [slug],
      );
      sessionId = r.s.session_id;
      token = r.s.resume_token;
      expect(r.s.is_test).toBe(false);
      expect(token).toHaveLength(64);
    });
  });

  it("rejects languages the study does not offer", async () => {
    await as(db, null, async () => {
      await expect(db.query("select start_session($1, 'fr')", [slug])).rejects.toThrow(/language/);
    });
  });

  it("only the study's researchers can start test sessions", async () => {
    await as(db, null, async () => {
      await expect(db.query("select start_session($1, 'en', true)", [slug])).rejects.toThrow(/forbidden/);
    });
    await as(db, bob, async () => {
      await expect(db.query("select start_session($1, 'en', true)", [slug])).rejects.toThrow(/forbidden/);
    });
    await as(db, alice, async () => {
      const r = await one<{ s: { is_test: boolean } }>("select start_session($1, 'en', true) as s", [slug]);
      expect(r.s.is_test).toBe(true);
    });
  });

  it("cannot skip past consent", async () => {
    const q = qBlock() as { id: string; questions: { variable: string }[] };
    await as(db, null, async () => {
      const welcome = config.blocks[0];
      const r = await one<{ n: number }>("select submit_block($1, $2, $3, '{}'::jsonb, now(), 1) as n", [sessionId, token, welcome.id]);
      expect(r.n).toBe(1);
      await expect(
        db.query("select submit_block($1, $2, $3, '{}'::jsonb, now(), 3)", [sessionId, token, q.id]),
      ).rejects.toThrow(/consent required/);
      await expect(db.query("select complete_session($1, $2)", [sessionId, token])).rejects.toThrow(/consent required/);
    });
  });

  it("records consent with the text snapshotted from the server config", async () => {
    await as(db, null, () =>
      db.query("select record_consent($1, $2, $3, 'given', 2)", [sessionId, token, consentBlock().id]),
    );
    const c = await one<{ consent_text: unknown; decision: string }>(
      "select consent_text, decision from consent_records where session_id = $1",
      [sessionId],
    );
    expect(c.decision).toBe("given");
    expect(c.consent_text).toEqual((consentBlock() as { body: unknown }).body);
  });

  it("rejects writes with a wrong token, unknown block or unknown variable", async () => {
    const q = qBlock() as { id: string; questions: { variable: string }[] };
    const v = q.questions[0].variable;
    await as(db, null, async () => {
      await expect(
        db.query("select submit_block($1, 'wrong', $2, $3, now(), 3)", [sessionId, q.id, JSON.stringify({ [v]: 3 })]),
      ).rejects.toThrow(/invalid session/);
      await expect(
        db.query("select submit_block($1, $2, 'nope', '{}'::jsonb, now(), 3)", [sessionId, token]),
      ).rejects.toThrow(/unknown block/);
      await expect(
        db.query("select submit_block($1, $2, $3, $4, now(), 3)", [sessionId, token, q.id, JSON.stringify({ evil: 1 })]),
      ).rejects.toThrow(/unknown variable/);
      await db.query("select submit_block($1, $2, $3, $4, now(), 3)", [sessionId, token, q.id, JSON.stringify({ [v]: 4 })]);
    });
    const r = await one<{ answers: Record<string, number> }>(
      "select answers from responses where session_id = $1 and block_key = $2",
      [sessionId, q.id],
    );
    expect(r.answers[v]).toBe(4);
  });

  it("restores progress for resume", async () => {
    await as(db, null, async () => {
      const r = await one<{ s: { current_block_index: number; responses: Record<string, unknown> } }>(
        "select load_session($1, $2) as s",
        [sessionId, token],
      );
      expect(r.s.current_block_index).toBe(3);
      expect(Object.keys(r.s.responses)).toHaveLength(2); // welcome + questionnaire
    });
  });

  it("researchers can read sessions but cannot change their status or answers", async () => {
    await as(db, alice, async () => {
      expect((await rows("select id from participant_sessions where study_id = $1", [studyId])).length).toBeGreaterThan(0);
      await expect(db.query("update participant_sessions set status = 'completed' where id = $1", [sessionId])).rejects.toThrow();
      await db.query("update participant_sessions set excluded = true, exclusion_reason = 'pilot' where id = $1", [sessionId]);
    });
    await as(db, bob, async () => {
      expect(await rows("select id from participant_sessions")).toHaveLength(0);
      expect(await rows("select id from responses")).toHaveLength(0);
    });
  });

  it("completing is final; later writes are rejected", async () => {
    const q = qBlock();
    const demo = config.blocks.find((b) => b.type === "demographics")!;
    await as(db, null, async () => {
      await db.query("select submit_block($1, $2, $3, '{}'::jsonb, now(), 4)", [sessionId, token, demo.id]);
      await db.query("select complete_session($1, $2)", [sessionId, token]);
      await expect(
        db.query("select submit_block($1, $2, $3, '{}'::jsonb, now(), 4)", [sessionId, token, q.id]),
      ).rejects.toThrow(/not in progress/);
    });
  });

  it("declining consent ends the session", async () => {
    await as(db, null, async () => {
      const r = await one<{ s: { session_id: string; resume_token: string } }>("select start_session($1, 'en') as s", [slug]);
      await db.query("select submit_block($1, $2, $3, '{}'::jsonb, now(), 4)", [r.s.session_id, r.s.resume_token, config.blocks[0].id]);
      await db.query("select record_consent($1, $2, $3, 'declined', 2)", [r.s.session_id, r.s.resume_token, consentBlock().id]);
      const s = await one<{ s: { status: string } }>("select load_session($1, $2) as s", [r.s.session_id, r.s.resume_token]);
      expect(s.s.status).toBe("declined");
    });
  });

  it("withdrawal deletes the participant's answers", async () => {
    const q = qBlock() as { id: string; questions: { variable: string }[] };
    let sid = "";
    await as(db, null, async () => {
      const r = await one<{ s: { session_id: string; resume_token: string } }>("select start_session($1, 'en') as s", [slug]);
      sid = r.s.session_id;
      await db.query("select submit_block($1, $2, $3, '{}'::jsonb, now(), 4)", [sid, r.s.resume_token, config.blocks[0].id]);
      await db.query("select record_consent($1, $2, $3, 'given', 2)", [sid, r.s.resume_token, consentBlock().id]);
      await db.query("select submit_block($1, $2, $3, $4, now(), 3)", [
        sid,
        r.s.resume_token,
        q.id,
        JSON.stringify({ [q.questions[0].variable]: 2 }),
      ]);
      await db.query("select withdraw_session($1, $2)", [sid, r.s.resume_token]);
    });
    expect(await rows("select * from responses where session_id = $1", [sid])).toHaveLength(0);
    expect((await one<{ status: string }>("select status from participant_sessions where id = $1", [sid])).status).toBe("withdrawn");
  });
});

describe("account deletion", () => {
  it("deletes only the caller's account and workspace data", async () => {
    const carol = await createUser(db, "carol@example.test");
    const ws = (await one<{ workspace_id: string }>("select workspace_id from workspace_members where user_id = $1", [carol])).workspace_id;
    await as(db, carol, () => db.query("insert into projects (workspace_id, name, created_by) values ($1, 'c', $2)", [ws, carol]));
    await as(db, null, async () => {
      await expect(db.query("select delete_my_account()")).rejects.toThrow();
    });
    await as(db, carol, () => db.query("select delete_my_account()"));
    expect(await rows("select id from auth.users where id = $1", [carol])).toHaveLength(0);
    expect(await rows("select id from workspaces where id = $1", [ws])).toHaveLength(0);
    expect(await rows("select id from projects where workspace_id = $1", [ws])).toHaveLength(0);
    expect(await rows("select id from auth.users where id = $1", [alice])).toHaveLength(1);
  });
});

describe("private media", () => {
  it("participants can read only media used by a live study version", async () => {
    const assetPath = `${aliceWs}/consent-photo.png`;
    const otherPath = `${aliceWs}/unpublished.png`;
    await db.query("insert into storage.objects (bucket_id, name) values ('media', $1), ('media', $2)", [assetPath, otherPath]);
    let assetId = "";
    await as(db, alice, async () => {
      const a = await one<{ id: string }>(
        `insert into media_assets (workspace_id, storage_path, file_name, mime_type, kind, size_bytes, created_by)
         values ($1, $2, 'photo.png', 'image/png', 'image', 1000, $3) returning id`,
        [aliceWs, assetPath, alice],
      );
      assetId = a.id;
      const withMedia = structuredClone(config);
      const instr = withMedia.blocks.find((b) => b.type === "welcome")!;
      withMedia.blocks.splice(1, 0, {
        id: "b_media",
        name: "",
        showTo: [],
        type: "instructions",
        heading: {},
        body: {},
        media: [{ assetId, storagePath: assetPath, kind: "image", mimeType: "image/png", alt: {} }],
      });
      expect(instr).toBeTruthy();
      await db.query("update studies set draft_config = $1 where id = $2", [JSON.stringify(withMedia), studyId]);
      await db.query("select publish_study($1)", [studyId]);
    });
    await as(db, null, async () => {
      const visible = await rows<{ name: string }>("select name from storage.objects where bucket_id = 'media'");
      expect(visible.map((r) => r.name)).toEqual([assetPath]);
    });
    await as(db, bob, async () => {
      // Bob can see the published object like any participant, but not Alice's private one.
      const visible = await rows<{ name: string }>("select name from storage.objects");
      expect(visible.map((r) => r.name)).not.toContain(otherPath);
    });
    await as(db, alice, async () => {
      const visible = await rows<{ name: string }>("select name from storage.objects");
      expect(visible).toHaveLength(2);
    });
  });
});
