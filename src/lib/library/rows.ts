/**
 * Mapping between library table rows (snake_case) and library objects, plus
 * the snapshot builder that copies exactly the objects a study uses.
 */
import {
  LibAd,
  LibBrand,
  LibOffer,
  LibProduct,
  LibStore,
  type LibraryKind,
  type LibrarySnapshot,
} from "@/lib/study/library";
import type { StudyConfig } from "@/lib/study/schema";

export const TABLES: Record<LibraryKind, string> = {
  brand: "brands",
  store: "stores",
  product: "products",
  offer: "offers",
  ad: "ads",
};
export const SNAPSHOT_KEY: Record<LibraryKind, keyof LibrarySnapshot> = {
  brand: "brands",
  store: "stores",
  product: "products",
  offer: "offers",
  ad: "ads",
};

type Row = Record<string, unknown>;

export function fromRow(kind: LibraryKind, r: Row) {
  switch (kind) {
    case "brand":
      return LibBrand.parse({ id: r.id, code: r.code, name: r.name, logo: r.logo ?? null, colors: r.colors ?? {}, fictional: r.fictional });
    case "product":
      return LibProduct.parse({
        id: r.id,
        code: r.code,
        brandId: r.brand_id ?? null,
        name: r.name,
        description: r.description,
        images: r.images,
        basePrice: Number(r.base_price),
        originalPrice: r.original_price === null || r.original_price === undefined ? null : Number(r.original_price),
        currency: r.currency,
        category: r.category,
        attributes: r.attributes,
        rating: r.rating === null || r.rating === undefined ? null : Number(r.rating),
        ratingCount: r.rating_count ?? null,
        reviews: r.reviews ?? [],
      });
    case "offer":
      return LibOffer.parse({ id: r.id, code: r.code, name: r.name, kind: r.kind, params: r.params, displayText: r.display_text });
    case "store":
      return LibStore.parse({
        id: r.id,
        code: r.code,
        brandId: r.brand_id ?? null,
        name: r.name,
        facade: r.facade,
        facadeAdId: r.facade_ad_id ?? null,
        productIds: r.product_ids ?? [],
        inStoreAdIds: r.in_store_ad_ids ?? [],
      });
    case "ad":
      return LibAd.parse({ id: r.id, code: r.code, brandId: r.brand_id ?? null, name: r.name, versions: r.versions, disclosure: r.disclosure });
  }
}

/** Columns to write for an object (id and workspace are handled by the caller). */
export function toRow(kind: LibraryKind, o: Record<string, unknown>): Row {
  switch (kind) {
    case "brand":
      return { code: o.code, name: o.name, logo: o.logo ?? null, colors: o.colors, fictional: o.fictional };
    case "product":
      return {
        code: o.code,
        brand_id: o.brandId ?? null,
        name: o.name,
        description: o.description,
        images: o.images,
        base_price: o.basePrice,
        original_price: o.originalPrice ?? null,
        currency: o.currency,
        category: o.category,
        attributes: o.attributes,
        rating: o.rating ?? null,
        rating_count: o.ratingCount ?? null,
        reviews: o.reviews ?? [],
      };
    case "offer":
      return { code: o.code, name: o.name, kind: o.kind, params: o.params, display_text: o.displayText };
    case "store":
      return {
        code: o.code,
        brand_id: o.brandId ?? null,
        name: o.name,
        facade: o.facade,
        facade_ad_id: o.facadeAdId ?? null,
        product_ids: o.productIds,
        in_store_ad_ids: o.inStoreAdIds,
      };
    case "ad":
      return { code: o.code, brand_id: o.brandId ?? null, name: o.name, versions: o.versions, disclosure: o.disclosure };
  }
}

/** Every library id a study references (directly or through stores, ads and factors). */
export function referencedIds(config: StudyConfig, full: LibrarySnapshot) {
  const ids = { brands: new Set<string>(), stores: new Set<string>(), products: new Set<string>(), offers: new Set<string>(), ads: new Set<string>() };
  const addAny = (id: string | undefined | null) => {
    if (!id) return;
    if (full.brands[id]) ids.brands.add(id);
    else if (full.stores[id]) ids.stores.add(id);
    else if (full.products[id]) ids.products.add(id);
    else if (full.offers[id]) ids.offers.add(id);
    else if (full.ads[id]) ids.ads.add(id);
    else missing.add(id);
  };
  const missing = new Set<string>();
  for (const b of config.blocks) {
    if (b.type === "village" || b.type === "store_choice") {
      b.stores.forEach(addAny);
      if (b.offers.mode === "fixed") Object.values(b.offers.byStore).forEach(addAny);
    }
    if (b.type === "ad_exposure") b.ads.forEach(addAny);
    if (b.type === "social_feed") b.posts.forEach((p) => p.adId && addAny(p.adId));
    if (b.type === "online_shop") {
      b.products.forEach(addAny);
      if (b.offers.mode === "fixed") Object.values(b.offers.byStore).forEach(addAny);
      [...b.placements.banner, ...b.placements.sidebar, b.placements.popup].forEach(addAny);
      b.placements.sponsored.forEach(addAny);
    }
  }
  for (const f of config.design.factors) {
    f.levels.forEach((l) => addAny(l.ref));
    f.targets.forEach((t) => addAny(t.ref));
  }
  // Follow references from stores, products and ads.
  for (const sid of [...ids.stores]) {
    const s = full.stores[sid];
    if (!s) continue;
    addAny(s.brandId);
    addAny(s.facadeAdId);
    s.inStoreAdIds.forEach(addAny);
    s.productIds.forEach(addAny);
  }
  for (const pid of [...ids.products]) addAny(full.products[pid]?.brandId);
  for (const aid of [...ids.ads]) addAny(full.ads[aid]?.brandId);
  return { ids, missing: [...missing] };
}

/** Copy the referenced objects into a snapshot. Missing ids are reported, not silently dropped. */
export function buildSnapshot(config: StudyConfig, full: LibrarySnapshot): { snapshot: LibrarySnapshot; missing: string[] } {
  const { ids, missing } = referencedIds(config, full);
  const pick = <K extends keyof LibrarySnapshot>(k: K) =>
    Object.fromEntries([...ids[k]].map((id) => [id, full[k][id]])) as LibrarySnapshot[K];
  return {
    snapshot: { brands: pick("brands"), stores: pick("stores"), products: pick("products"), offers: pick("offers"), ads: pick("ads") },
    missing,
  };
}
