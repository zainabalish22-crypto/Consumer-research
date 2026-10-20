import { describe, expect, it } from "vitest";
import { StudyConfig, type OnlineShopBlock } from "@/lib/study/schema";
import type { LibrarySnapshot } from "@/lib/study/library";
import { buildTemplate } from "@/lib/templates";
import { buildSnapshot } from "@/lib/library/rows";
import { mediaIssues } from "@/lib/library/checks";
import { toolsConfig, type Tool } from "@/lib/study/factories";
import { resolveSteps, type Assignment } from "@/lib/study/flow";
import { cartValue, validateShopAnswer } from "@/lib/study/envAnswers";
import { buildColumns, emptyShop, type SessionRecord } from "@/lib/export/columns";

/** The deepfake template's library has brands, stores, products, offers and ads. */
function library() {
  const t = buildTemplate("deepfake", { newId: () => crypto.randomUUID(), code: (_k, w) => w });
  const full: LibrarySnapshot = { brands: {}, stores: {}, products: {}, offers: {}, ads: {} };
  for (const b of t.library.brands) full.brands[b.id] = b;
  for (const s of t.library.stores) full.stores[s.id] = s;
  for (const p of t.library.products) full.products[p.id] = p;
  for (const o of t.library.offers) full.offers[o.id] = o;
  for (const a of t.library.ads) full.ads[a.id] = a;
  return { t, full };
}

/** A tools config with the environment blocks filled in, as a researcher would. */
function filled(tools: Tool[], mode: "sequence" | "between" = "sequence", order: "fixed" | "counterbalanced" = "fixed") {
  const { t, full } = library();
  const cfg = toolsConfig(tools, mode, order);
  for (const b of cfg.blocks) {
    if (b.type === "village") b.stores = t.library.stores.map((s) => s.id);
    if (b.type === "online_shop") b.products = t.library.products.map((p) => p.id);
  }
  return { t, full, cfg };
}

const noAssign: Assignment = { condition: null, factors: {}, groups: {} };

describe("choosing research tools at study creation", () => {
  const sets: Tool[][] = [["questionnaire"], ["village"], ["shop"], ["village", "shop"], ["shop", "questionnaire"], ["village", "shop", "questionnaire"]];
  for (const tools of sets) {
    for (const mode of ["sequence", "between"] as const) {
      it(`${tools.join("+")} (${mode}) is a valid study`, () => {
        const { cfg } = filled(tools, mode);
        const parsed = StudyConfig.safeParse(cfg);
        expect(parsed.success, JSON.stringify(!parsed.success && parsed.error.issues.slice(0, 3))).toBe(true);
        const kinds = cfg.blocks.map((b) => b.type);
        expect(kinds[0]).toBe("welcome");
        expect(kinds.at(-1)).toBe("end");
        expect(kinds.filter((k) => ["village", "online_shop", "questionnaire"].includes(k))).toHaveLength(tools.length);
      });
    }
  }

  it("between-subjects: one condition per tool, each tool shown only to its condition", () => {
    const { cfg } = filled(["village", "shop", "questionnaire"], "between");
    expect(cfg.design.conditions.map((c) => c.id)).toEqual(["village", "shop", "questionnaire"]);
    expect(cfg.design.assignment).toBe("balanced");
    for (const cond of ["village", "shop", "questionnaire"]) {
      const steps = resolveSteps(cfg, { ...noAssign, condition: cond }, "s").map((s) => cfg.blocks.find((b) => b.id === s.blockId)!.type);
      const tools = steps.filter((k) => ["village", "online_shop", "questionnaire"].includes(k));
      expect(tools).toEqual([cond === "shop" ? "online_shop" : cond]);
    }
  });

  it("within-subjects: everyone gets every tool, in a fixed or counterbalanced order", () => {
    const fixed = filled(["village", "shop"], "sequence", "fixed").cfg;
    expect(fixed.design.conditions).toEqual([]);
    expect(fixed.design.orderGroups).toEqual([]);
    const cb = filled(["village", "shop"], "sequence", "counterbalanced").cfg;
    expect(cb.design.orderGroups).toEqual([{ id: "tools", name: "Tool order", method: "latin" }]);
    const env = cb.blocks.filter((b) => b.type === "village" || b.type === "online_shop");
    expect(env.every((b) => b.orderGroup === "tools")).toBe(true);
    const ids = env.map((b) => b.id);
    const order = resolveSteps(cb, { ...noAssign, groups: { tools: [ids[1], ids[0]] } }, "s")
      .map((s) => s.blockId)
      .filter((id) => ids.includes(id));
    expect(order).toEqual([ids[1], ids[0]]);
  });

  it("a single tool needs no conditions or order groups", () => {
    const { cfg } = filled(["shop"], "between", "counterbalanced");
    expect(cfg.design.conditions).toEqual([]);
    expect(cfg.design.orderGroups).toEqual([]);
    expect(cfg.blocks.find((b) => b.type === "online_shop")!.showTo).toEqual([]);
  });
});

describe("online shop", () => {
  const { t, full, cfg: draft } = filled(["shop"]);
  const shopBlock = draft.blocks.find((b): b is OnlineShopBlock => b.type === "online_shop")!;
  const ads = t.library.ads;
  shopBlock.placements = { banner: [ads[0].id], sidebar: [], sponsored: [t.library.products[1].id], popup: ads[1].id, popupDelaySec: 5 };
  shopBlock.maxItems = 3;
  shopBlock.minItems = 1;
  const base = StudyConfig.parse(draft);
  const { snapshot, missing } = buildSnapshot(base, full);
  const cfg = { ...base, library: snapshot };
  const block = cfg.blocks.find((b): b is OnlineShopBlock => b.type === "online_shop")!;
  const [p1, p2] = t.library.products;

  it("snapshots its products and placed ads, and needs media for them", () => {
    expect(missing).toEqual([]);
    expect(Object.keys(snapshot.products).sort()).toEqual(t.library.products.map((p) => p.id).sort());
    expect(Object.keys(snapshot.ads).sort()).toEqual([ads[0].id, ads[1].id].sort());
    expect(mediaIssues(base, snapshot).length).toBeGreaterThan(0);
  });

  it("validates the cart against the published products and limits", () => {
    const ok = validateShopAnswer(block, cfg, noAssign, { cart: [{ product: p1.id, qty: 2 }], checkedOut: true });
    expect(ok).toEqual({ ok: true, value: { cart: [{ product: p1.id, qty: 2 }], checkedOut: true, timedOut: false } });
    expect(validateShopAnswer(block, cfg, noAssign, { cart: [{ product: crypto.randomUUID(), qty: 1 }] })).toEqual({ ok: false, error: "invalid" });
    expect(validateShopAnswer(block, cfg, noAssign, { cart: [{ product: p1.id, qty: 1 }, { product: p1.id, qty: 1 }] })).toEqual({ ok: false, error: "invalid" });
    expect(validateShopAnswer(block, cfg, noAssign, { cart: [{ product: p1.id, qty: 2 }, { product: p2.id, qty: 2 }] })).toEqual({ ok: false, error: "selectMax" });
    expect(validateShopAnswer(block, cfg, noAssign, { cart: [] })).toEqual({ ok: false, error: "selectMin" });
    expect(validateShopAnswer(block, cfg, noAssign, { cart: [], timedOut: true }).ok).toBe(true);
    expect(validateShopAnswer(block, cfg, noAssign, "nonsense")).toEqual({ ok: false, error: "invalid" });
    const tight = { ...block, budget: p1.basePrice } as OnlineShopBlock;
    expect(validateShopAnswer(tight, cfg, noAssign, { cart: [{ product: p1.id, qty: 2 }] })).toEqual({ ok: false, error: "max" });
    expect(cartValue(block, cfg, noAssign, [{ product: p1.id, qty: 2 }])).toBe(Math.round(p1.basePrice * 2 * 1000) / 1000);
  });

  it("exports per-product, behaviour and ad columns", () => {
    const cols = buildColumns([cfg]);
    const P = block.variable;
    const s = {
      id: "s1",
      condition: null,
      factors: {},
      groups: {},
      answers: { [P]: { cart: [{ product: p2.id, qty: 1 }], checkedOut: true, timedOut: false } },
      media: { [`ad:${ads[1].id}`]: { visibleMs: 4200, maxPct: 0, plays: 0, completed: false } },
      env: { [block.id]: { stores: {}, productsViewed: 3, details: 1, shop: { ...emptyShop(), products: { [p2.id]: { views: 2, details: 1 } }, searches: 2, checkoutStarted: true, popupCloseMs: 1500, maxScroll: 80 } } },
    } as unknown as SessionRecord;
    const get = (n: string) => cols.find((c) => c.name === n)?.cell(s);
    expect(get(`${P}_${p1.code}_pos`)).toBe(1);
    expect(get(`${P}_${p2.code}_viewed`)).toBe(2);
    expect(get(`${P}_${p2.code}_detail`)).toBe(1);
    expect(get(`${P}_${p1.code}_viewed`)).toBe(0);
    expect(get(`${P}_${p2.code}_qty`)).toBe(1);
    expect(get(`${P}_${p1.code}_qty`)).toBe(0);
    expect(get(`${P}_items`)).toBe(1);
    expect(get(`${P}_value`)).toBe(p2.basePrice);
    expect(get(`${P}_searches`)).toBe(2);
    expect(get(`${P}_details_opened`)).toBe(1);
    expect(get(`${P}_checkout_started`)).toBe(1);
    expect(get(`${P}_checked_out`)).toBe(1);
    expect(get(`${P}_max_scroll`)).toBe(80);
    expect(get(`${P}_popup_close_sec`)).toBe(1.5);
    expect(get(`${P}_ad_${ads[1].code}_visible_sec`)).toBe(4.2);
    expect(get(`${P}_ad_${ads[0].code}_version`)).toBe("authentic");
    expect(new Set(cols.map((c) => c.name)).size).toBe(cols.length);
    // Sessions that never reached the shop stay blank.
    const none = { ...s, answers: {}, env: {} } as unknown as SessionRecord;
    expect(cols.find((c) => c.name === `${P}_items`)!.cell(none)).toBeNull();
    expect(cols.find((c) => c.name === `${P}_searches`)!.cell(none)).toBeNull();
  });
});

