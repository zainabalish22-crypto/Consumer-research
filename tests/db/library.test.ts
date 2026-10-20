import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, createUser, as } from "./harness";

let db: PGlite;
let alice: string;
let bob: string;
let wsA: string;
let wsB: string;
const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

beforeAll(async () => {
  db = await freshDb();
  alice = await createUser(db, "alice@example.test");
  bob = await createUser(db, "bob@example.test");
  wsA = (await one<{ workspace_id: string }>("select workspace_id from workspace_members where user_id = $1", [alice])).workspace_id;
  wsB = (await one<{ workspace_id: string }>("select workspace_id from workspace_members where user_id = $1", [bob])).workspace_id;
});

describe("content library", () => {
  it("is private to the workspace and validates codes", async () => {
    await as(db, alice, async () => {
      await db.query("insert into brands (workspace_id, code, name) values ($1, 'B1', '{\"en\":\"Brew\"}')", [wsA]);
      await expect(db.query("insert into brands (workspace_id, code, name) values ($1, 'B1', '{}')", [wsA])).rejects.toThrow(); // unique per workspace
      await expect(db.query("insert into brands (workspace_id, code, name) values ($1, 'bad code', '{}')", [wsA])).rejects.toThrow();
      await expect(db.query("insert into brands (workspace_id, code, name) values ($1, 'B9', '{}')", [wsB])).rejects.toThrow(); // other workspace
    });
    await as(db, bob, async () => {
      expect((await db.query("select * from brands")).rows).toHaveLength(0);
      const r = await db.query("update brands set code = 'X' where workspace_id = $1", [wsA]);
      expect(r.affectedRows ?? 0).toBe(0);
      // Same code in a different workspace is fine.
      await db.query("insert into brands (workspace_id, code, name) values ($1, 'B1', '{}')", [wsB]);
    });
    await as(db, null, async () => {
      await expect(db.query("select * from stores")).rejects.toThrow();
    });
  });
});

describe("village answers and events", () => {
  it("accepts the block's variable prefix and the shopping event types", async () => {
    const storeId = crypto.randomUUID();
    const config = {
      schemaVersion: 1,
      settings: { languages: ["en"], defaultLanguage: "en" },
      design: { conditions: [], factors: [], orderGroups: [] },
      blocks: [
        { id: "v", name: "", type: "village", variable: "fc", stores: [storeId] },
        { id: "e", name: "", type: "end", heading: {}, body: {} },
      ],
    };
    const slug = await as(db, alice, async () => {
      const p = await one<{ id: string }>("insert into projects (workspace_id, name, created_by) values ($1, 'P', $2) returning id", [wsA, alice]);
      const s = await one<{ id: string; slug: string }>(
        "insert into studies (project_id, title, draft_config, created_by) values ($1, 'S', $2, $3) returning id, slug",
        [p.id, JSON.stringify(config), alice],
      );
      await db.query("select publish_study($1)", [s.id]);
      return s.slug;
    });
    await as(db, null, async () => {
      const s = (await one<{ s: { session_id: string; resume_token: string } }>("select start_session($1, 'en') as s", [slug])).s;
      const answer = { fc: { basket: [{ store: storeId, product: crypto.randomUUID(), qty: 1 }], consideration: {}, timedOut: false } };
      await db.query("select submit_block($1, $2, 'v', $3, now(), 1)", [s.session_id, s.resume_token, JSON.stringify(answer)]);
      await expect(
        db.query("select submit_block($1, $2, 'v', $3, now(), 1)", [s.session_id, s.resume_token, JSON.stringify({ other: 1 })]),
      ).rejects.toThrow(/unknown variable/);
      const events = JSON.stringify(
        ["env_enter", "store_approach", "store_enter", "product_view", "bag_add", "store_leave", "checkout", "ad_impression", "choice_select"].map((type) => ({
          id: crypto.randomUUID(),
          type,
          block: "v",
          at: "2026-10-21T10:00:00Z",
          data: { store: storeId },
        })),
      );
      expect((await one<{ n: number }>("select log_events($1, $2, $3) as n", [s.session_id, s.resume_token, events])).n).toBe(9);
    });
  });
});

describe("online shop", () => {
  it("stores product ratings and reviews, and accepts the shop's answer and event types", async () => {
    await as(db, alice, async () => {
      const p = await one<{ id: string }>(
        "insert into products (workspace_id, code, name, base_price, original_price, rating, rating_count, reviews) values ($1, 'P1', '{}', 2, 3, 4.5, 120, $2) returning id",
        [wsA, JSON.stringify([{ author: { en: "Sara" }, rating: 5, text: { en: "Great" } }])],
      );
      expect(p.id).toBeTruthy();
      await expect(db.query("insert into products (workspace_id, code, name, base_price, rating) values ($1, 'P2', '{}', 2, 6)", [wsA])).rejects.toThrow();
      await expect(db.query("insert into products (workspace_id, code, name, base_price, reviews) values ($1, 'P3', '{}', 2, '{}')", [wsA])).rejects.toThrow();
    });
    const productId = crypto.randomUUID();
    const config = {
      schemaVersion: 1,
      settings: { languages: ["en"], defaultLanguage: "en" },
      design: { conditions: [], factors: [], orderGroups: [] },
      blocks: [
        { id: "sh", name: "", type: "online_shop", variable: "shop", products: [productId] },
        { id: "e", name: "", type: "end", heading: {}, body: {} },
      ],
    };
    const slug = await as(db, alice, async () => {
      const p = await one<{ id: string }>("insert into projects (workspace_id, name, created_by) values ($1, 'Shop', $2) returning id", [wsA, alice]);
      const s = await one<{ id: string; slug: string }>(
        "insert into studies (project_id, title, draft_config, created_by) values ($1, 'S', $2, $3) returning id, slug",
        [p.id, JSON.stringify(config), alice],
      );
      await db.query("select publish_study($1)", [s.id]);
      return s.slug;
    });
    await as(db, null, async () => {
      const s = (await one<{ s: { session_id: string; resume_token: string } }>("select start_session($1, 'en') as s", [slug])).s;
      const answer = { shop: { cart: [{ product: productId, qty: 1 }], checkedOut: true, timedOut: false } };
      await db.query("select submit_block($1, $2, 'sh', $3, now(), 1)", [s.session_id, s.resume_token, JSON.stringify(answer)]);
      const types = ["shop_page", "shop_search", "shop_filter", "shop_sort", "product_view", "product_detail", "bag_add", "checkout_start", "checkout", "scroll_depth", "popup_close", "ad_click", "not_allowed"];
      const events = JSON.stringify(types.map((type) => ({ id: crypto.randomUUID(), type, block: "sh", at: "2026-10-22T10:00:00Z", data: { product: productId } })));
      expect((await one<{ n: number }>("select log_events($1, $2, $3) as n", [s.session_id, s.resume_token, events])).n).toBe(types.length - 1);
    });
  });
});
