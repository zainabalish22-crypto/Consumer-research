"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { Banner, Lang, Product, Shop, Study } from "@/lib/study/types";
import { useMediaUrl } from "@/lib/study/useMedia";
import { money, tx, uid } from "@/lib/study/util";
import { Button, Icon, IconButton, L10nInput, MediaInput, NumberInput, Panel, Select, TextInput, Toggle } from "./ui";

type Update = (fn: (s: Study) => Study) => void;

/** The e-commerce simulator's content: store settings, categories, products and banners. */
export function ShopEditor({ study, update }: { study: Study; update: Update }) {
  const t = useTranslations("studio.shop");
  const shop = study.shop!;
  const langs = study.languages;
  const locale = useLocale() as Lang;
  const [open, setOpen] = useState<string | null>(null);
  const setShop = (fn: (s: Shop) => Shop) => update((s) => ({ ...s, shop: fn(s.shop!) }));
  const setProduct = (id: string, p: Partial<Product>) => setShop((s) => ({ ...s, products: s.products.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  const setBanner = (id: string, p: Partial<Banner>) => setShop((s) => ({ ...s, banners: s.banners.map((x) => (x.id === id ? { ...x, ...p } : x)) }));

  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <div className="flex flex-col gap-6">
        <Panel title={t("store")}>
          <L10nInput label={t("name")} value={shop.name} onChange={(v) => setShop((s) => ({ ...s, name: v }))} langs={langs} />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextInput label={t("currency")} value={shop.currency} onChange={(v) => setShop((s) => ({ ...s, currency: v.toUpperCase().slice(0, 3) }))} dir="ltr" />
            <NumberInput label={t("budget")} value={shop.budget} onChange={(v) => setShop((s) => ({ ...s, budget: v }))} />
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-mist">
              {t("accent")}
              <input type="color" value={shop.accent} onChange={(e) => setShop((s) => ({ ...s, accent: e.target.value }))} className="h-11 w-full cursor-pointer rounded-md border border-line-2 bg-void" />
            </label>
          </div>
          <Select
            label={t("order")}
            value={shop.order}
            onChange={(v) => setShop((s) => ({ ...s, order: v }))}
            options={[
              ["fixed", t("orderFixed")],
              ["random", t("orderRandom")],
            ]}
          />
        </Panel>

        <Panel title={t("categories")}>
          {shop.categories.map((c) => (
            <div key={c.id} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <L10nInput label={t("category")} value={c.name} onChange={(v) => setShop((s) => ({ ...s, categories: s.categories.map((x) => (x.id === c.id ? { ...x, name: v } : x)) }))} langs={langs} />
              </div>
              <IconButton label={t("remove")} onClick={() => setShop((s) => ({ ...s, categories: s.categories.filter((x) => x.id !== c.id) }))}>
                {Icon.x}
              </IconButton>
            </div>
          ))}
          <div>
            <Button onClick={() => setShop((s) => ({ ...s, categories: [...s.categories, { id: uid("c"), name: {} }] }))}>
              {Icon.plus}
              {t("addCategory")}
            </Button>
          </div>
        </Panel>

        <Panel title={t("banners")}>
          {shop.banners.map((b) => (
            <div key={b.id} className="flex flex-col gap-3 rounded-md border border-line-2 p-3">
              <MediaInput label={t("images")} value={b.image} onChange={(v) => setBanner(b.id, { image: v ?? "" })} />
              <L10nInput label={t("headline")} value={b.headline} onChange={(v) => setBanner(b.id, { headline: v })} langs={langs} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label={t("placement")}
                  value={b.placement}
                  onChange={(v) => setBanner(b.id, { placement: v })}
                  options={[
                    ["hero", t("hero")],
                    ["listing", t("listing")],
                  ]}
                />
                <Select label={t("linksTo")} value={b.product ?? ""} onChange={(v) => setBanner(b.id, { product: v || undefined })} options={[["", t("none")], ...shop.products.map((p) => [p.id, tx(p.name, locale)] as [string, string])]} />
              </div>
              <div>
                <Button kind="danger" onClick={() => setShop((s) => ({ ...s, banners: s.banners.filter((x) => x.id !== b.id) }))}>
                  {t("remove")}
                </Button>
              </div>
            </div>
          ))}
          <div>
            <Button onClick={() => setShop((s) => ({ ...s, banners: [...s.banners, { id: uid("a"), image: "", headline: {}, placement: "hero" }] }))}>
              {Icon.plus}
              {t("addBanner")}
            </Button>
          </div>
        </Panel>
      </div>

      <Panel
        title={t("products")}
        actions={
          <Button
            onClick={() => {
              const p: Product = { id: uid("p"), name: {}, description: {}, category: shop.categories[0]?.id ?? "", price: 1, images: [] };
              setShop((s) => ({ ...s, products: [...s.products, p] }));
              setOpen(p.id);
            }}
          >
            {Icon.plus}
            {t("addProduct")}
          </Button>
        }
      >
        <ul className="flex flex-col gap-2">
          {shop.products.map((p, i) => (
            <li key={p.id} className="rounded-md border border-line-2 bg-void">
              <div className="flex items-center gap-2 p-1">
                <Thumb src={p.images[0]} />
                <button type="button" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id} className="flex min-h-11 min-w-0 flex-1 flex-col items-start py-1 text-start">
                  <span className="w-full truncate text-sm">{tx(p.name, locale) || "—"}</span>
                  <span className="font-mono text-[11px] text-faint">
                    {money(p.price, shop.currency, locale)}
                    {p.offer ? ` · ${tx(p.offer, locale)}` : ""}
                    {p.sponsored ? ` · ${t("sponsored")}` : ""}
                  </span>
                </button>
                <IconButton label={t("remove")} onClick={() => setShop((s) => ({ ...s, products: s.products.filter((x) => x.id !== p.id) }))}>
                  {Icon.x}
                </IconButton>
                <IconButton label="↑" disabled={i === 0} onClick={() => setShop((s) => ({ ...s, products: s.products.map((_, j) => s.products[j === i - 1 ? i : j === i ? i - 1 : j]) }))}>
                  {Icon.up}
                </IconButton>
              </div>
              {open === p.id && (
                <div className="flex flex-col gap-4 border-t border-line-2 p-4">
                  <L10nInput label={t("productName")} value={p.name} onChange={(v) => setProduct(p.id, { name: v })} langs={langs} />
                  <L10nInput label={t("description")} value={p.description} onChange={(v) => setProduct(p.id, { description: v })} langs={langs} multiline />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <NumberInput label={t("price")} value={p.price} onChange={(v) => setProduct(p.id, { price: v ?? 0 })} />
                    <NumberInput label={t("was")} value={p.was} onChange={(v) => setProduct(p.id, { was: v })} />
                    <Select label={t("category")} value={p.category} onChange={(v) => setProduct(p.id, { category: v })} options={shop.categories.map((c) => [c.id, tx(c.name, locale)] as [string, string])} />
                  </div>
                  <L10nInput label={t("offer")} value={p.offer ?? {}} onChange={(v) => setProduct(p.id, { offer: v })} langs={langs} />
                  <div className="flex flex-col gap-3">
                    {[...p.images, undefined].map((m, j) => (
                      <MediaInput
                        key={`${j}-${m ?? "new"}`}
                        label={`${t("images")} ${j + 1}`}
                        value={m}
                        onChange={(v) => {
                          const imgs = [...p.images];
                          if (v) imgs[j] = v;
                          else imgs.splice(j, 1);
                          setProduct(p.id, { images: imgs.filter(Boolean) });
                        }}
                      />
                    ))}
                  </div>
                  <Toggle label={t("sponsored")} checked={!!p.sponsored} onChange={(v) => setProduct(p.id, { sponsored: v })} />
                  <NumberInput label={t("rating")} value={p.rating} onChange={(v) => setProduct(p.id, { rating: v === undefined ? undefined : Math.min(5, Math.max(0, v)) })} />
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-[13px] font-medium text-mist">{t("reviews")}</legend>
                    {(p.reviews ?? []).map((r) => (
                      <div key={r.id} className="flex flex-col gap-2 rounded-md border border-line-2 p-2">
                        <div className="grid grid-cols-[1fr_100px_auto] items-end gap-2">
                          <TextInput label={t("author")} value={r.author} onChange={(v) => setProduct(p.id, { reviews: p.reviews!.map((x) => (x.id === r.id ? { ...x, author: v } : x)) })} />
                          <NumberInput label={t("stars")} value={r.stars} step="1" onChange={(v) => setProduct(p.id, { reviews: p.reviews!.map((x) => (x.id === r.id ? { ...x, stars: Math.min(5, Math.max(1, v ?? 5)) } : x)) })} />
                          <IconButton label={t("remove")} onClick={() => setProduct(p.id, { reviews: p.reviews!.filter((x) => x.id !== r.id) })}>
                            {Icon.x}
                          </IconButton>
                        </div>
                        <L10nInput label={t("description")} value={r.text} onChange={(v) => setProduct(p.id, { reviews: p.reviews!.map((x) => (x.id === r.id ? { ...x, text: v } : x)) })} langs={langs} />
                      </div>
                    ))}
                    <div>
                      <Button onClick={() => setProduct(p.id, { reviews: [...(p.reviews ?? []), { id: uid("r"), author: "", stars: 5, text: {} }] })}>
                        {Icon.plus}
                        {t("addReview")}
                      </Button>
                    </div>
                  </fieldset>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function Thumb({ src }: { src?: string }) {
  const { url } = useMediaUrl(src);
  return <div className="h-11 w-11 shrink-0 overflow-hidden rounded bg-carbon">{url && <img src={url} alt="" className="h-full w-full object-cover" />}</div>;
}
