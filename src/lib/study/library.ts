/**
 * Content library: brands, stores, products, offers and ads.
 *
 * These are researcher-owned objects stored in their own tables. Study configs
 * reference them by id; at publish time the referenced objects are copied into
 * the immutable version (config.library) so participants always see exactly
 * what was published.
 */
import { z } from "zod";
import { LocalizedText, MediaRef } from "./schema-base";

export const libCode = z.string().regex(/^[A-Za-z0-9_]{1,20}$/, "Use letters, numbers or _ (max 20)");
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const uuid = z.string().uuid();

export const LibBrand = z.object({
  id: uuid,
  code: libCode,
  name: LocalizedText,
  logo: MediaRef.nullable().default(null),
  colors: z.object({ primary: hex.default("#0f6e6e"), secondary: hex.default("#f4efe6") }).default({ primary: "#0f6e6e", secondary: "#f4efe6" }),
  fictional: z.boolean().default(true),
});
export type LibBrand = z.infer<typeof LibBrand>;

export const LibProduct = z.object({
  id: uuid,
  code: libCode,
  brandId: uuid.nullable().default(null),
  name: LocalizedText,
  description: LocalizedText.default({}),
  images: z.array(MediaRef).max(10).default([]),
  basePrice: z.number().min(0).max(1_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/).default("BHD"),
  category: z.string().max(80).default(""),
  attributes: z.array(z.object({ name: LocalizedText, value: LocalizedText })).max(20).default([]),
});
export type LibProduct = z.infer<typeof LibProduct>;

export const OFFER_KINDS = ["none", "percentage", "fixed_amount", "buy_x_get_y", "bundle", "free_shipping"] as const;
export const LibOffer = z.object({
  id: uuid,
  code: libCode,
  name: LocalizedText,
  kind: z.enum(OFFER_KINDS),
  params: z
    .object({
      percent: z.number().min(0).max(100).optional(),
      amount: z.number().min(0).max(1_000_000).optional(),
      buy: z.number().int().min(1).max(20).optional(),
      get: z.number().int().min(1).max(20).optional(),
      bundleQty: z.number().int().min(2).max(50).optional(),
      bundlePrice: z.number().min(0).max(1_000_000).optional(),
    })
    .default({}),
  /** What participants read on the badge, e.g. "Buy 1 get 1 free". */
  displayText: LocalizedText.default({}),
});
export type LibOffer = z.infer<typeof LibOffer>;

export const LibStore = z.object({
  id: uuid,
  code: libCode,
  brandId: uuid.nullable().default(null),
  name: LocalizedText,
  facade: z
    .object({
      color: hex.optional(),
      signText: LocalizedText.default({}),
      style: z.enum(["kiosk", "shop", "cafe"]).default("shop"),
      image: MediaRef.nullable().default(null),
    })
    .default({ signText: {}, style: "shop", image: null }),
  facadeAdId: uuid.nullable().default(null),
  productIds: z.array(uuid).max(200).default([]),
  inStoreAdIds: z.array(uuid).max(20).default([]),
});
export type LibStore = z.infer<typeof LibStore>;

export const AdVersion = z.object({
  key: libCode,
  label: z.string().max(80).default(""),
  media: MediaRef.nullable().default(null),
});
export const LibAd = z.object({
  id: uuid,
  code: libCode,
  brandId: uuid.nullable().default(null),
  name: LocalizedText,
  versions: z.array(AdVersion).min(1).max(10),
  disclosure: z
    .object({
      text: LocalizedText.default({ en: "AI-generated", ar: "مُنتج بالذكاء الاصطناعي" }),
      position: z.enum(["top-start", "top-end", "bottom-start", "bottom-end"]).default("top-start"),
      style: z.enum(["badge", "banner", "subtle"]).default("badge"),
    })
    .default({ text: { en: "AI-generated", ar: "مُنتج بالذكاء الاصطناعي" }, position: "top-start", style: "badge" }),
});
export type LibAd = z.infer<typeof LibAd>;

export const LibrarySnapshot = z.object({
  brands: z.record(z.string(), LibBrand).default({}),
  stores: z.record(z.string(), LibStore).default({}),
  products: z.record(z.string(), LibProduct).default({}),
  offers: z.record(z.string(), LibOffer).default({}),
  ads: z.record(z.string(), LibAd).default({}),
});
export type LibrarySnapshot = z.infer<typeof LibrarySnapshot>;
export const EMPTY_LIBRARY: LibrarySnapshot = { brands: {}, stores: {}, products: {}, offers: {}, ads: {} };

export type LibraryKind = "brand" | "store" | "product" | "offer" | "ad";
export const LIBRARY_KINDS: LibraryKind[] = ["brand", "store", "product", "offer", "ad"];
export const LIBRARY_SCHEMAS = { brand: LibBrand, store: LibStore, product: LibProduct, offer: LibOffer, ad: LibAd } as const;

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Total price for buying `qty` units of a product under an offer. */
export function lineTotal(basePrice: number, offer: LibOffer | null | undefined, qty: number): number {
  if (qty <= 0) return 0;
  if (!offer) return round3(basePrice * qty);
  const p = offer.params;
  switch (offer.kind) {
    case "percentage":
      return round3(basePrice * qty * (1 - (p.percent ?? 0) / 100));
    case "fixed_amount":
      return round3(Math.max(0, basePrice - (p.amount ?? 0)) * qty);
    case "buy_x_get_y": {
      const buy = p.buy ?? 1;
      const get = p.get ?? 1;
      const free = Math.floor(qty / (buy + get)) * get;
      return round3(basePrice * (qty - free));
    }
    case "bundle": {
      const n = p.bundleQty ?? 2;
      const bp = p.bundlePrice ?? basePrice * n;
      return round3(Math.floor(qty / n) * bp + (qty % n) * basePrice);
    }
    default:
      return round3(basePrice * qty);
  }
}

/**
 * Effective unit price at the quantity that qualifies for the offer
 * (e.g. BOGO on 2.000 → 1.000 per unit when buying 2). Stored with every
 * offer exposure so analyses can use the economic value of each offer.
 */
export function effectiveUnitPrice(basePrice: number, offer: LibOffer | null | undefined): number {
  if (!offer) return round3(basePrice);
  const p = offer.params;
  const qty = offer.kind === "buy_x_get_y" ? (p.buy ?? 1) + (p.get ?? 1) : offer.kind === "bundle" ? (p.bundleQty ?? 2) : 1;
  return round3(lineTotal(basePrice, offer, qty) / qty);
}

/** Units in hand for `paid` units (buy-x-get-y adds free items). */
export function unitsReceived(offer: LibOffer | null | undefined, paid: number): number {
  if (offer?.kind !== "buy_x_get_y") return paid;
  const buy = offer.params.buy ?? 1;
  const get = offer.params.get ?? 1;
  return paid + Math.floor(paid / buy) * get;
}

export function formatPrice(amount: number, currency: string, lang: "en" | "ar"): string {
  try {
    return new Intl.NumberFormat(lang === "ar" ? "ar-BH" : "en-BH", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(3)} ${currency}`;
  }
}
