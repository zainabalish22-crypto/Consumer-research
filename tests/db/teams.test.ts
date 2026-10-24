import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, createUser, as } from "./harness";

let db: PGlite;
let owner: string;
let colleague: string;
let outsider: string;
let team: string;
const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

beforeAll(async () => {
  db = await freshDb();
  owner = await createUser(db, "owner@example.test");
  colleague = await createUser(db, "colleague@example.test");
  outsider = await createUser(db, "outsider@example.test");
});

describe("team workspaces", () => {
  it("lets a user create a team workspace and invite a colleague by email", async () => {
    team = await as(db, owner, async () => (await one<{ id: string }>("select public.create_team_workspace('Consumer lab') as id")).id);
    await as(db, owner, async () => {
      await db.query("select public.invite_to_workspace($1, 'Colleague@Example.test', 'editor')", [team]);
      await expect(db.query("select public.invite_to_workspace($1, 'not-an-email', 'editor')", [team])).rejects.toThrow();
      await expect(db.query("select public.invite_to_workspace($1, 'x@example.test', 'owner')", [team])).rejects.toThrow();
      expect((await db.query("select email, role from workspace_invitations")).rows).toEqual([{ email: "colleague@example.test", role: "editor" }]);
    });
  });

  it("does not let personal workspaces be shared, or non-owners invite", async () => {
    const personal = (await one<{ workspace_id: string }>("select workspace_id from workspace_members m join workspaces w on w.id = m.workspace_id where user_id = $1 and w.is_personal", [owner])).workspace_id;
    await as(db, owner, async () => {
      await expect(db.query("select public.invite_to_workspace($1, 'a@example.test', 'viewer')", [personal])).rejects.toThrow(/personal/);
    });
    await as(db, outsider, async () => {
      await expect(db.query("select public.invite_to_workspace($1, 'a@example.test', 'viewer')", [team])).rejects.toThrow(/not allowed/);
      expect((await db.query("select * from workspace_invitations")).rows).toHaveLength(0);
    });
  });

  it("only the invited address can accept, and accepting grants the role", async () => {
    const inv = (await one<{ id: string }>("select id from workspace_invitations")).id;
    await as(db, outsider, async () => {
      await expect(db.query("select public.respond_to_invitation($1, true)", [inv])).rejects.toThrow(/not found/);
    });
    await as(db, colleague, async () => {
      expect((await db.query("select * from workspace_invitations")).rows).toHaveLength(1);
      await db.query("select public.respond_to_invitation($1, true)", [inv]);
      expect((await db.query("select * from workspace_invitations")).rows).toHaveLength(0);
      // As an editor the colleague can create projects in the team workspace.
      await db.query("insert into projects (workspace_id, name, created_by) values ($1, 'Shared project', $2)", [team, colleague]);
      const members = (await db.query<{ email: string; role: string }>("select email, role from public.workspace_member_list($1)", [team])).rows;
      expect(members).toEqual([
        { email: "owner@example.test", role: "owner" },
        { email: "colleague@example.test", role: "editor" },
      ]);
    });
    await as(db, outsider, async () => {
      expect((await db.query("select * from public.workspace_member_list($1)", [team])).rows).toHaveLength(0);
      expect((await db.query("select * from projects where workspace_id = $1", [team])).rows).toHaveLength(0);
    });
  });

  it("viewers can read but not write; a workspace always keeps an owner", async () => {
    await as(db, owner, async () => {
      await db.query("select public.set_member_role($1, $2, 'viewer')", [team, colleague]);
      await expect(db.query("select public.set_member_role($1, $2, 'editor')", [team, owner])).rejects.toThrow(/needs an owner/);
      await expect(db.query("select public.remove_member($1, $2)", [team, owner])).rejects.toThrow(/needs an owner/);
    });
    await as(db, colleague, async () => {
      expect((await db.query("select * from projects where workspace_id = $1", [team])).rows).toHaveLength(1);
      await expect(db.query("insert into projects (workspace_id, name, created_by) values ($1, 'X', $2)", [team, colleague])).rejects.toThrow();
      await expect(db.query("select public.set_member_role($1, $2, 'owner')", [team, colleague])).rejects.toThrow(/not allowed/);
    });
  });

  it("deleting an account keeps team workspaces and hands them to the next member", async () => {
    await as(db, owner, async () => {
      await db.query("select public.delete_my_account()");
    });
    const ws = await one<{ name: string }>("select name from workspaces where id = $1", [team]);
    expect(ws?.name).toBe("Consumer lab");
    expect((await db.query("select name from projects where workspace_id = $1", [team])).rows).toHaveLength(1);
    expect((await one<{ role: string }>("select role from workspace_members where workspace_id = $1 and user_id = $2", [team, colleague])).role).toBe("owner");
    expect((await db.query("select * from workspaces w where w.is_personal and w.created_by = $1", [owner])).rows).toHaveLength(0);
  });
});

describe("AI request log", () => {
  it("stores only counts, per user, and cannot be deleted to dodge the daily limit", async () => {
    await as(db, colleague, async () => {
      await db.query("insert into ai_requests (user_id, kind, input_tokens, output_tokens) values ($1, 'outline', 100, 400)", [colleague]);
      await expect(db.query("insert into ai_requests (user_id, kind) values ($1, 'outline')", [outsider])).rejects.toThrow();
      const r = await db.query("delete from ai_requests");
      expect(r.affectedRows ?? 0).toBe(0);
      expect((await db.query("select * from ai_requests")).rows).toHaveLength(1);
    });
    await as(db, outsider, async () => {
      expect((await db.query("select * from ai_requests")).rows).toHaveLength(0);
    });
  });
});
