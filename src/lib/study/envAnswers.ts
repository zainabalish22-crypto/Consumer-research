/**
 * Answers produced by environment blocks, validated on the server against the
 * published version (stores, products and offers come from config.library).
 */
import { z } from "zod";
import type { OnlineShopBlock, StoreChoiceBlock, StudyConfig, VillageBlock } from "./schema";
import type { Assignment } from "./flow";
import { lineTotal } from "./library";
import { libraryOf, offerForItem, offerForStore } from "./environment";

export const VillageAnswer = z.object({
  basket: z
    .array(z.object({ store: z.string().uuid(), product: z.string().uuid(), qty: z.number().int().min(1).max(50) }))
    .max(100),
  consideration: z.record(z.string().uuid(), z.union([z.literal(0), z.literal(1)])).default({}),
  timedOut: z.boolean().default(false),
});
export type VillageAnswer = z.infer<typeof VillageAnswer>;

export const StoreChoiceAnswer = z.object({ store: z.string().uuid().nullable() });
export type StoreChoiceAnswer = z.infer<typeof StoreChoiceAnswer>;

export function basketValue(block: VillageBlock, config: StudyConfig, a: Assignment, basket: VillageAnswer["basket"]): number {
  const lib = libraryOf(config);
  return Math.round(
    basket.reduce((sum, line) => {
      const p = lib.products[line.product];
      return sum + (p ? lineTotal(p.basePrice, offerForStore(block.offers, line.store, config, a), line.qty) : 0);
    }, 0) * 1000,
  ) / 1000;
}

export type EnvValidation = { ok: true; value: unknown } | { ok: false; error: string };

export function validateVillageAnswer(block: VillageBlock, config: StudyConfig, a: Assignment, raw: unknown): EnvValidation {
  const parsed = VillageAnswer.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const lib = libraryOf(config);
  const v = parsed.data;
  for (const line of v.basket) {
    const store = lib.stores[line.store];
    if (!store || !block.stores.includes(line.store) || !store.productIds.includes(line.product)) return { ok: false, error: "invalid" };
  }
  for (const sid of Object.keys(v.consideration)) if (!block.stores.includes(sid)) return { ok: false, error: "invalid" };
  const items = v.basket.reduce((n, l) => n + l.qty, 0);
  if (items > block.maxPurchases) return { ok: false, error: "selectMax" };
  if (!v.timedOut && items < block.minPurchases) return { ok: false, error: "selectMin" };
  if (block.budget !== undefined && basketValue(block, config, a, v.basket) > block.budget + 1e-9) return { ok: false, error: "max" };
  return { ok: true, value: v };
}

export function validateStoreChoice(block: StoreChoiceBlock, raw: unknown): EnvValidation {
  const parsed = StoreChoiceAnswer.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { store } = parsed.data;
  if (store === null) return block.allowNone ? { ok: true, value: parsed.data } : { ok: false, error: "required" };
  return block.stores.includes(store) ? { ok: true, value: parsed.data } : { ok: false, error: "invalid" };
}

export const ShopAnswer = z.object({
  cart: z.array(z.object({ product: z.string().uuid(), qty: z.number().int().min(1).max(50) })).max(100),
  checkedOut: z.boolean().default(false),
  timedOut: z.boolean().default(false),
});
export type ShopAnswer = z.infer<typeof ShopAnswer>;

export function cartValue(block: OnlineShopBlock, config: StudyConfig, a: Assignment, cart: ShopAnswer["cart"]): number {
  const lib = libraryOf(config);
  return Math.round(
    cart.reduce((sum, line) => {
      const p = lib.products[line.product];
      return sum + (p ? lineTotal(p.basePrice, offerForItem(block.offers, line.product, config, a), line.qty) : 0);
    }, 0) * 1000,
  ) / 1000;
}

export function validateShopAnswer(block: OnlineShopBlock, config: StudyConfig, a: Assignment, raw: unknown): EnvValidation {
  const parsed = ShopAnswer.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const lib = libraryOf(config);
  const v = parsed.data;
  const seen = new Set<string>();
  for (const line of v.cart) {
    if (!lib.products[line.product] || !block.products.includes(line.product) || seen.has(line.product)) return { ok: false, error: "invalid" };
    seen.add(line.product);
  }
  const items = v.cart.reduce((n, l) => n + l.qty, 0);
  if (items > block.maxItems) return { ok: false, error: "selectMax" };
  if (!v.timedOut && items < block.minItems) return { ok: false, error: "selectMin" };
  if (block.budget !== undefined && cartValue(block, config, a, v.cart) > block.budget + 1e-9) return { ok: false, error: "max" };
  return { ok: true, value: v };
}
