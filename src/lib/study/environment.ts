/**
 * Resolves what a participant sees in environment and advertising blocks:
 * the order of stores/ads, which offer each store has, and which ad version
 * (and disclosure label) is shown. Pure functions shared by the participant
 * page, preview and export.
 */
import { seededShuffle } from "@/lib/random";
import type { AdRules, ItemOrder, OfferRule, StudyConfig } from "./schema";
import type { Assignment } from "./flow";
import { EMPTY_LIBRARY, effectiveUnitPrice, type LibAd, type LibOffer, type LibrarySnapshot } from "./library";

export function libraryOf(config: StudyConfig): LibrarySnapshot {
  return config.library ?? EMPTY_LIBRARY;
}

/** Brand id of a library item, if it has one. */
function brandOf(lib: LibrarySnapshot, id: string): string | null {
  return lib.stores[id]?.brandId ?? lib.ads[id]?.brandId ?? lib.products[id]?.brandId ?? null;
}

/**
 * Order item ids. With an order factor, each level's ref may point at the item
 * itself or at its brand (e.g. an ad order defined over brands).
 */
export function orderItems(
  ids: string[],
  order: ItemOrder,
  config: StudyConfig,
  a: Assignment,
  seed: string,
): string[] {
  if (order.mode === "random") return seededShuffle(ids, seed);
  if (order.mode !== "factor") return ids;
  const factor = config.design.factors.find((f) => f.id === order.factorId);
  const assigned = factor ? a.factors[factor.variable] : undefined;
  if (!factor || !Array.isArray(assigned)) return ids;
  const lib = libraryOf(config);
  const refByValue = new Map(factor.levels.map((l) => [l.value, l.ref]));
  const rank = new Map<string, number>();
  assigned.forEach((value, i) => {
    const ref = refByValue.get(value);
    if (ref) rank.set(ref, i);
  });
  const pos = (id: string) => rank.get(id) ?? rank.get(brandOf(lib, id) ?? "") ?? 999 + ids.indexOf(id);
  return [...ids].sort((x, y) => pos(x) - pos(y));
}

/** The offer a store shows to this participant, or null. */
export function offerForStore(rule: OfferRule, storeId: string, config: StudyConfig, a: Assignment): LibOffer | null {
  const lib = libraryOf(config);
  if (rule.mode === "none") return null;
  if (rule.mode === "fixed") {
    const offerId = rule.byStore[storeId];
    return offerId ? (lib.offers[offerId] ?? null) : null;
  }
  const factor = config.design.factors.find((f) => f.id === rule.factorId);
  const mapping = factor ? a.factors[factor.variable] : undefined;
  if (!factor || !mapping || typeof mapping !== "object" || Array.isArray(mapping)) return null;
  const target = factor.targets.find((t) => t.ref === storeId || (!!t.ref && t.ref === brandOf(lib, storeId)));
  if (!target) return null;
  const levelValue = (mapping as Record<string, string>)[target.value];
  const level = factor.levels.find((l) => l.value === levelValue);
  // A "none" offer is returned too, so the data records that this store had no promotion.
  return level?.ref ? (lib.offers[level.ref] ?? null) : null;
}

export interface ShownAd {
  ad: LibAd;
  versionKey: string;
  media: LibAd["versions"][number]["media"];
  disclosed: boolean;
}

/** Which version of an ad this participant sees, and whether it carries the disclosure label. */
export function resolveAd(ad: LibAd, rules: AdRules, config: StudyConfig, a: Assignment): ShownAd {
  let key = rules.version.mode === "fixed" ? rules.version.key : rules.version.otherKey;
  let targeted = false;
  if (rules.version.mode === "targeted") {
    const factorId = rules.version.factorId;
    const factor = config.design.factors.find((f) => f.id === factorId);
    const value = factor ? a.factors[factor.variable] : undefined;
    const level = factor?.levels.find((l) => l.value === value);
    targeted = !!level?.ref && (level.ref === ad.brandId || level.ref === ad.id);
    if (targeted) key = rules.version.targetKey;
  }
  const version = ad.versions.find((v) => v.key === key) ?? ad.versions[0];
  const d = rules.disclosure;
  const inCondition = !d.conditions.length || (a.condition !== null && d.conditions.includes(a.condition));
  const disclosed = inCondition && (d.showFor === "all" || (d.showFor === "targeted" && targeted));
  return { ad, versionKey: version.key, media: version.media, disclosed };
}

/** Effective price info for a product under a store's offer. */
export function priceInfo(basePrice: number, offer: LibOffer | null) {
  return { base: basePrice, effective: effectiveUnitPrice(basePrice, offer), hasOffer: !!offer && offer.kind !== "none" };
}

/** Offers for products in the online shop use the same rules as stores (targets ref products or brands). */
export const offerForItem = offerForStore;
