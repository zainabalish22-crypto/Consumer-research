import { describe, expect, it } from "vitest";
import { StudyConfig, type Block } from "@/lib/study/schema";
import { effectiveUnitPrice, lineTotal, unitsReceived, type LibOffer, type LibrarySnapshot } from "@/lib/study/library";
import { buildTemplate, type TemplateKind } from "@/lib/templates";
import { buildSnapshot } from "@/lib/library/rows";
import { mediaIssues } from "@/lib/library/checks";
import { methodWarnings } from "@/lib/study/warnings";
import { offerForStore, orderItems, resolveAd } from "@/lib/study/environment";
import { resolveSteps, type Assignment } from "@/lib/study/flow";
import { validateStoreChoice, validateVillageAnswer, basketValue } from "@/lib/study/envAnswers";
import { buildColumns, type SessionRecord } from "@/lib/export/columns";

const offer = (kind: LibOffer["kind"], params: LibOffer["params"] = {}): LibOffer => ({ id: crypto.randomUUID(), code: "O", name: {}, kind, params, displayText: {} });

describe("offer pricing", () => {
  it("computes line totals and effective unit prices", () => {
    expect(lineTotal(2, null, 3)).toBe(6);
    expect(lineTotal(2, offer("percentage", { percent: 50 }), 1)).toBe(1);
    expect(lineTotal(2, offer("fixed_amount", { amount: 1 }), 2)).toBe(2);
    expect(lineTotal(0.5, offer("fixed_amount", { amount: 1 }), 1)).toBe(0); // never negative
    const bogo = offer("buy_x_get_y", { buy: 1, get: 1 });
    expect(lineTotal(2, bogo, 1)).toBe(2);
    expect(lineTotal(2, bogo, 2)).toBe(2);
    expect(lineTotal(2, bogo, 3)).toBe(4);
    expect(effectiveUnitPrice(2, bogo)).toBe(1);
    expect(unitsReceived(bogo, 1)).toBe(2);
    expect(lineTotal(2, offer("bundle", { bundleQty: 3, bundlePrice: 5 }), 4)).toBe(7);
    expect(effectiveUnitPrice(2, offer("none"))).toBe(2);
    expect(effectiveUnitPrice(2.345, offer("percentage", { percent: 10 }))).toBe(2.111);
  });
});

function makeTemplate(kind: TemplateKind) {
  const used = new Set<string>();
  const t = buildTemplate(kind, {
    newId: () => crypto.randomUUID(),
    code: (k, w) => {
      let c = w;
      for (let i = 2; used.has(`${k}:${c}`); i++) c = `${w}_${i}`;
      used.add(`${k}:${c}`);
      return c;
    },
  });
  const full: LibrarySnapshot = { brands: {}, stores: {}, products: {}, offers: {}, ads: {} };
  for (const b of t.library.brands) full.brands[b.id] = b;
  for (const s of t.library.stores) full.stores[s.id] = s;
  for (const p of t.library.products) full.products[p.id] = p;
  for (const o of t.library.offers) full.offers[o.id] = o;
  for (const a of t.library.ads) full.ads[a.id] = a;
  return { t, full };
}

describe("templates are expressible with the normal builder", () => {
  for (const kind of ["foodcourt", "deepfake"] as const) {
    it(`${kind}: valid config, complete library snapshot, no design warnings`, () => {
      const { t, full } = makeTemplate(kind);
      const parsed = StudyConfig.safeParse(t.config);
      expect(parsed.success, JSON.stringify(!parsed.success && parsed.error.issues.slice(0, 5))).toBe(true);
      const cfg = parsed.data!;
      const { snapshot, missing } = buildSnapshot(cfg, full);
      expect(missing).toEqual([]);
      expect(Object.keys(snapshot.stores).length).toBe(t.library.stores.length);
      expect(Object.keys(snapshot.products).length).toBe(t.library.products.length);
      expect(methodWarnings({ ...cfg, library: snapshot })).toEqual([]);
      expect(StudyConfig.safeParse({ ...cfg, library: snapshot }).success).toBe(true);
    });
  }

  it("deepfake: publishing is blocked until every ad version has media", () => {
    const { t, full } = makeTemplate("deepfake");
    const cfg = StudyConfig.parse(t.config);
    const { snapshot } = buildSnapshot(cfg, full);
    expect(mediaIssues(cfg, snapshot)).toHaveLength(6);
    for (const ad of Object.values(snapshot.ads)) for (const v of ad.versions) v.media = { assetId: crypto.randomUUID(), storagePath: "ws/v.mp4", kind: "video", mimeType: "video/mp4", alt: {} };
    expect(mediaIssues(cfg, snapshot)).toEqual([]);
  });
});

describe("environment resolution", () => {
  const { t, full } = makeTemplate("foodcourt");
  const base = StudyConfig.parse(t.config);
  const cfg = { ...base, library: buildSnapshot(base, full).snapshot };
  const stores = t.library.stores;
  const offers = t.library.offers;

  it("orders stores and maps offers from the participant's factors", () => {
    const a: Assignment = {
      condition: "village",
      factors: { outlet_order: ["O3", "O1", "O4", "O2"], offer_for_store: { O1: "NONE", O2: "BOGO", O3: "HALF", O4: "ONEOFF" } },
      groups: {},
    };
    const village = { ...(cfg.blocks.find((b) => b.type === "village") as Extract<Block, { type: "village" }>), maxPurchases: 5 };
    expect(orderItems(village.stores, village.storeOrder, cfg, a, "s")).toEqual([stores[2].id, stores[0].id, stores[3].id, stores[1].id]);
    expect(offerForStore(village.offers, stores[1].id, cfg, a)?.code).toBe(offers[0].code); // BOGO
    expect(offerForStore(village.offers, stores[0].id, cfg, a)?.kind).toBe("none");

    // Basket value uses each store's offer: BOGO 2 drinks = 2.000, 50% off 1 drink = 1.000.
    const basket = [
      { store: stores[1].id, product: stores[1].productIds[0], qty: 2 },
      { store: stores[2].id, product: stores[2].productIds[0], qty: 1 },
    ];
    expect(basketValue(village, cfg, a, basket)).toBe(3);
    expect(validateVillageAnswer(village, cfg, a, { basket }).ok).toBe(true);
    expect(validateVillageAnswer(village, cfg, a, { basket: [{ ...basket[0], product: stores[0].productIds[0] }] })).toEqual({ ok: false, error: "invalid" });
    expect(validateVillageAnswer(village, cfg, a, { basket: [] })).toEqual({ ok: false, error: "selectMin" });
    expect(validateVillageAnswer(village, cfg, a, { basket: [], timedOut: true }).ok).toBe(true);
    expect(validateVillageAnswer(village, cfg, a, { basket: [{ ...basket[0], qty: 6 }] })).toEqual({ ok: false, error: "selectMax" });
    const budgeted = { ...village, budget: 1.5 };
    expect(validateVillageAnswer(budgeted, cfg, a, { basket: [basket[1]] }).ok).toBe(true);
    expect(validateVillageAnswer(budgeted, cfg, a, { basket })).toEqual({ ok: false, error: "max" });

    const choice = cfg.blocks.find((b) => b.type === "store_choice") as Extract<Block, { type: "store_choice" }>;
    expect(validateStoreChoice(choice, { store: stores[0].id }).ok).toBe(true);
    expect(validateStoreChoice(choice, { store: null }).ok).toBe(false);
    expect(validateStoreChoice(choice, { store: crypto.randomUUID() }).ok).toBe(false);
  });

  it("shows the village or the questionnaire by condition", () => {
    const steps = (condition: string) =>
      resolveSteps(cfg, { condition, factors: { outlet_order: ["O1", "O2", "O3", "O4"] }, groups: {} }, "s").map((s) => cfg.blocks.find((b) => b.id === s.blockId)!.type);
    expect(steps("village")).toContain("village");
    expect(steps("village")).not.toContain("store_choice");
    expect(steps("survey")).toContain("store_choice");
    expect(steps("survey")).not.toContain("village");
    // Purchase intention is repeated once per outlet.
    expect(steps("survey").filter((x) => x === "questionnaire").length).toBeGreaterThanOrEqual(4 + 3);
  });
});

describe("targeted ad versions and disclosure", () => {
  const { t, full } = makeTemplate("deepfake");
  const base = StudyConfig.parse(t.config);
  const cfg = { ...base, library: buildSnapshot(base, full).snapshot };
  const exposure = cfg.blocks.find((b) => b.type === "ad_exposure") as Extract<Block, { type: "ad_exposure" }>;
  const ads = t.library.ads;

  it("only the target brand's ad is AI-generated, and only the label condition sees the label", () => {
    const a = (condition: string): Assignment => ({ condition, factors: { target_brand: "B", ad_order: ["C", "A", "B"] }, groups: {} });
    const shown = (condition: string) => ads.map((ad) => resolveAd(ad, exposure.rules, cfg, a(condition)));
    expect(shown("label").map((s) => s.versionKey)).toEqual(["authentic", "ai", "authentic"]);
    expect(shown("label").map((s) => s.disclosed)).toEqual([false, true, false]);
    expect(shown("no_label").map((s) => s.disclosed)).toEqual([false, false, false]);
    expect(orderItems(exposure.ads, exposure.order, cfg, a("label"), "s")).toEqual([ads[2].id, ads[0].id, ads[1].id]);
  });

  it("exports per-brand scales plus target and non-target summaries", () => {
    const cols = buildColumns([cfg]);
    const names = cols.map((c) => c.name);
    for (const n of ["att1_A", "att1_B", "att1_C", "att1_target", "att1_nontarget_mean", "det_target", `ad_${ads[0].code}_version`, `ad_${ads[0].code}_disclosed`, "cs_items", "cs_value"]) {
      expect(names).toContain(n);
    }
    const s: SessionRecord = {
      id: "s1",
      version_number: 1,
      status: "completed",
      is_test: false,
      excluded: false,
      exclusion_reason: null,
      screen_reason: null,
      language: "en",
      device_class: "mobile",
      started_at: "2026-10-21T10:00:00Z",
      ended_at: "2026-10-21T10:10:00Z",
      last_activity_at: "2026-10-21T10:10:00Z",
      consent: "given",
      condition: "label",
      factors: { target_brand: "B", ad_order: ["C", "A", "B"] },
      groups: {},
      params: {},
      completion_code: "X",
      answers: { att1_A: 6, att1_B: 2, att1_C: 5 },
      blockSeconds: {},
      media: { [`ad:${ads[1].id}`]: { visibleMs: 15000, maxPct: 100, plays: 1, completed: true } },
      env: {},
    };
    const get = (n: string) => cols.find((c) => c.name === n)!.cell(s);
    expect(get("att1_target")).toBe(2);
    expect(get("att1_nontarget_mean")).toBe(5.5);
    expect(get(`ad_${ads[1].code}_version`)).toBe("ai");
    expect(get(`ad_${ads[1].code}_disclosed`)).toBe(1);
    expect(get(`ad_${ads[0].code}_disclosed`)).toBe(0);
    expect(get(`ad_${ads[1].code}_pct`)).toBe(100);
    expect(get(`ad_${ads[2].code}_pos`)).toBe(1);
  });
});

describe("village export columns", () => {
  const { t, full } = makeTemplate("foodcourt");
  const base = StudyConfig.parse(t.config);
  const cfg = { ...base, library: buildSnapshot(base, full).snapshot };
  const st = t.library.stores;

  it("computes stops, entries, dwell time, items and the chosen store and offer", () => {
    const cols = buildColumns([cfg]);
    const s = {
      id: "s1",
      condition: "village",
      factors: { outlet_order: ["O2", "O1", "O3", "O4"], offer_for_store: { O1: "NONE", O2: "BOGO", O3: "HALF", O4: "ONEOFF" } },
      groups: {},
      answers: { fc: { basket: [{ store: st[1].id, product: st[1].productIds[0], qty: 2 }], consideration: {}, timedOut: false } },
      env: { [cfg.blocks.find((b) => b.type === "village")!.id]: { stores: { [st[1].id]: { approached: true, entered: true, dwellMs: 23400, views: 1, passes: 0 }, [st[0].id]: { approached: true, entered: false, dwellMs: 0, views: 0, passes: 1 } }, productsViewed: 1, details: 0 } },
    } as unknown as SessionRecord;
    const get = (n: string) => cols.find((c) => c.name === n)?.cell(s);
    const c1 = st[0].code;
    const c2 = st[1].code;
    expect(get(`fc_${c2}_pos`)).toBe(1);
    expect(get(`fc_${c2}_offer`)).toBe(t.library.offers[0].code);
    expect(get(`fc_${c2}_entered`)).toBe(1);
    expect(get(`fc_${c2}_dwell_sec`)).toBe(23.4);
    expect(get(`fc_${c1}_approached`)).toBe(1);
    expect(get(`fc_${c1}_entered`)).toBe(0);
    expect(get(`fc_${c2}_items`)).toBe(2);
    expect(get("fc_items")).toBe(2);
    expect(get("fc_value")).toBe(2);
    expect(get("fc_choice_store")).toBe(c2);
    expect(get("fc_choice_offer")).toBe(t.library.offers[0].code);
    expect(get("fc_stores_entered")).toBe(1);
  });
});
