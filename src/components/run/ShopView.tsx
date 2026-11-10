"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Banner, Lang, Product, Shop } from "@/lib/study/types";
import { useMediaUrl } from "@/lib/study/useMedia";
import { money, shuffle, tx } from "@/lib/study/util";
import type { Log } from "./Runner";

type Line = { product: string; qty: number; price: number };
type View = { page: "home" } | { page: "product"; id: string } | { page: "checkout" } | { page: "done" };

/**
 * The e-commerce simulator, as participants see it: a realistic, simple online shop. No real
 * payment, no real order, no payment details. Everything the participant does is logged.
 */
export function ShopView({ shop, lang, seed, log, onDone }: { shop: Shop; lang: Lang; seed: string; log: Log; onDone: (basket: Line[]) => void }) {
  const t = useTranslations("run.shop");
  const [view, setView] = useState<View>({ page: "home" });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<"default" | "low" | "high">("default");
  const [offersOnly, setOffersOnly] = useState(false);
  const [basket, setBasket] = useState<Line[]>([]);
  const [basketOpen, setBasketOpen] = useState(false);
  const scrolled = useRef(0);
  const fmt = (n: number) => money(n, shop.currency || "BHD", lang);

  const ordered = useMemo(() => (shop.order === "random" ? shuffle(shop.products, `${seed}-shop`) : shop.products), [shop, seed]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = ordered.filter((p) => (category === "all" || p.category === category) && (!offersOnly || p.offer?.[lang] || (p.was && p.was > p.price)) && (!q || `${tx(p.name, lang)} ${tx(p.description, lang)}`.toLowerCase().includes(q)));
    if (sort !== "default") list = [...list].sort((a, b) => (sort === "low" ? a.price - b.price : b.price - a.price));
    // Sponsored products lead the listing, as on real shops.
    if (sort === "default") list = [...list.filter((p) => p.sponsored), ...list.filter((p) => !p.sponsored)];
    return list;
  }, [ordered, query, category, offersOnly, sort, lang]);

  const count = basket.reduce((n, l) => n + l.qty, 0);
  const subtotal = basket.reduce((n, l) => n + l.qty * l.price, 0);

  // Page views and scroll depth.
  useEffect(() => {
    log("page_view", { page: view.page, ...(view.page === "product" ? { product: view.id } : {}) });
    if (view.page === "product") log("product_view", { product: view.id });
    window.scrollTo({ top: 0 });
    scrolled.current = 0;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0) scrolled.current = Math.max(scrolled.current, Math.round((window.scrollY / max) * 100));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrolled.current) log("scroll_depth", { page: view.page, percent: scrolled.current });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Search is logged once typing pauses.
  useEffect(() => {
    if (!query.trim()) return;
    const id = window.setTimeout(() => log("search", { query: query.trim().slice(0, 100), results: results.length }), 700);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // The basket is read from a ref so each change is logged exactly once (state updaters may run twice).
  const basketRef = useRef<Line[]>([]);
  function setQty(p: Product, qty: number) {
    const b = basketRef.current;
    const had = b.find((l) => l.product === p.id)?.qty ?? 0;
    if (qty === had) return;
    if (qty > had) log("add_to_cart", { product: p.id, qty: qty - had, price: p.price });
    else log("remove_from_cart", { product: p.id, qty: had - qty });
    const rest = b.filter((l) => l.product !== p.id);
    const next = qty > 0 ? [...rest, { product: p.id, qty, price: p.price }] : rest;
    basketRef.current = next;
    setBasket(next);
  }
  const qtyOf = (id: string) => basket.find((l) => l.product === id)?.qty ?? 0;
  const product = (id: string) => shop.products.find((p) => p.id === id);
  const open = (id: string, from: string) => {
    log("product_click", { product: id, from });
    setView({ page: "product", id });
  };

  const hero = shop.banners.filter((b) => b.placement === "hero" && b.image);
  const inListing = shop.banners.filter((b) => b.placement === "listing" && b.image);

  return (
    <div className="pb-24">
      {/* Store header */}
      <header className="sticky top-0 z-20 border-b border-[#ECEAE4] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => setView({ page: "home" })} className="text-lg font-bold tracking-tight" style={{ color: "var(--accent)" }}>
            {tx(shop.name, lang)}
          </button>
          {view.page === "home" && (
            <div className="relative ms-auto hidden max-w-md flex-1 sm:block">
              <SearchBox value={query} onChange={setQuery} label={t("search")} />
            </div>
          )}
          <button type="button" onClick={() => setBasketOpen(true)} className="ms-auto flex h-11 items-center gap-2 rounded-full border border-[#E3E0D8] px-4 text-sm font-semibold sm:ms-0" aria-label={`${t("basket")}: ${count}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 7h12l-1 13H7L6 7z" />
              <path d="M9 7a3 3 0 0 1 6 0" />
            </svg>
            <span aria-hidden="true">{t("basket")}</span>
            <span aria-live="polite" className="min-w-6 rounded-full px-1.5 text-center text-xs leading-6 text-white" style={{ background: "var(--accent)" }}>
              {count}
            </span>
          </button>
        </div>
        {view.page === "home" && (
          <div className="mx-auto max-w-6xl px-4 pb-3 sm:hidden">
            <SearchBox value={query} onChange={setQuery} label={t("search")} />
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4">
        {view.page === "home" && (
          <>
            {hero[0] && !query && <HeroBanner banner={hero[0]} lang={lang} onClick={() => { log("banner_click", { banner: hero[0].id }); if (hero[0].product) open(hero[0].product, "banner"); }} onSeen={() => log("ad_impression", { banner: hero[0].id })} />}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <div role="tablist" aria-label={t("filters")} className="flex flex-wrap gap-2">
                {[{ id: "all", name: { en: t("all"), ar: t("all") } }, ...shop.categories].map((c) => (
                  <button
                    key={c.id}
                    role="tab"
                    type="button"
                    aria-selected={category === c.id}
                    onClick={() => {
                      setCategory(c.id);
                      log("filter", { category: c.id });
                    }}
                    className={`h-10 rounded-full border px-4 text-sm font-medium ${category === c.id ? "border-transparent text-white" : "border-[#E3E0D8] hover:border-[#C9C5BB]"}`}
                    style={category === c.id ? { background: "var(--accent)" } : undefined}
                  >
                    {tx(c.name, lang)}
                  </button>
                ))}
              </div>
              <label className="ms-auto flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={offersOnly}
                  onChange={(e) => {
                    setOffersOnly(e.target.checked);
                    log("filter", { on_offer: e.target.checked ? 1 : 0 });
                  }}
                  className="h-5 w-5 accent-[var(--accent)]"
                />
                {t("onOffer")}
              </label>
              <label className="flex h-10 items-center gap-2 text-sm">
                <span className="sr-only sm:not-sr-only">{t("sort")}</span>
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value as typeof sort);
                    log("sort", { by: e.target.value });
                  }}
                  className="h-10 rounded-full border border-[#E3E0D8] bg-white px-3"
                >
                  <option value="default">{t("sortDefault")}</option>
                  <option value="low">{t("sortLow")}</option>
                  <option value="high">{t("sortHigh")}</option>
                </select>
              </label>
            </div>

            <p className="mt-4 text-sm text-[#5C6066]" aria-live="polite">
              {t("results", { n: results.length })}
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
              {results.map((p, i) => (
                <ListingItem key={p.id} i={i} p={p} banner={inListing[0]} lang={lang} fmt={fmt} qty={qtyOf(p.id)} onOpen={() => open(p.id, "listing")} onAdd={() => setQty(p, qtyOf(p.id) + 1)} log={log} />
              ))}
            </ul>
          </>
        )}

        {view.page === "product" && product(view.id) && (
          <ProductPage p={product(view.id)!} lang={lang} fmt={fmt} qty={qtyOf(view.id)} setQty={(q) => setQty(product(view.id)!, q)} back={() => setView({ page: "home" })} />
        )}

        {view.page === "checkout" && (
          <section className="mx-auto mt-8 flex max-w-lg flex-col gap-4">
            <h1 className="text-2xl font-semibold">{t("confirm")}</h1>
            <BasketLines basket={basket} shop={shop} lang={lang} fmt={fmt} setQty={setQty} />
            <Totals subtotal={subtotal} budget={shop.budget} fmt={fmt} />
            <p className="rounded-xl bg-[#F7F6F2] p-3 text-sm text-[#5C6066]">{t("simulated")}</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!basket.length}
                onClick={() => {
                  log("checkout_complete", { items: count, value: Math.round(subtotal * 1000) / 1000 });
                  setView({ page: "done" });
                }}
                className="h-[52px] flex-1 rounded-[14px] px-6 font-semibold text-white disabled:opacity-40"
                style={{ background: "var(--accent)" }}
              >
                {t("placeOrder")}
              </button>
              <button type="button" onClick={() => setView({ page: "home" })} className="h-[52px] rounded-[14px] border-[1.5px] border-[#E3E0D8] px-6 font-semibold">
                {t("backToShop")}
              </button>
            </div>
          </section>
        )}

        {view.page === "done" && (
          <section className="mx-auto mt-16 flex max-w-lg flex-col items-center gap-4 text-center">
            <div aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full text-3xl text-white" style={{ background: "var(--accent)" }}>
              ✓
            </div>
            <h1 className="text-2xl font-semibold">{t("done")}</h1>
            <p className="text-[#5C6066]">{t("simulated")}</p>
            <button type="button" onClick={() => onDone(basket)} className="h-[52px] rounded-[14px] px-8 font-semibold text-white" style={{ background: "var(--accent)" }}>
              {t("continue")}
            </button>
          </section>
        )}
      </main>

      {/* Basket drawer */}
      {basketOpen && (
        <div className="fixed inset-0 z-30 flex justify-end bg-black/30" onClick={() => setBasketOpen(false)}>
          <aside role="dialog" aria-modal="true" aria-label={t("basket")} onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-md flex-col gap-4 overflow-auto bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{t("basket")}</h2>
              <button type="button" autoFocus onClick={() => setBasketOpen(false)} aria-label="×" className="h-11 w-11 rounded-full text-2xl">
                ×
              </button>
            </div>
            {basket.length === 0 ? (
              <p className="text-[#5C6066]">{t("empty")}</p>
            ) : (
              <>
                <BasketLines basket={basket} shop={shop} lang={lang} fmt={fmt} setQty={setQty} />
                <Totals subtotal={subtotal} budget={shop.budget} fmt={fmt} />
                <button
                  type="button"
                  onClick={() => {
                    setBasketOpen(false);
                    log("checkout_start", { items: count });
                    setView({ page: "checkout" });
                  }}
                  className="h-[52px] rounded-[14px] font-semibold text-white"
                  style={{ background: "var(--accent)" }}
                >
                  {t("checkout")}
                </button>
              </>
            )}
          </aside>
        </div>
      )}

      {/* Sticky checkout bar on phones */}
      {count > 0 && view.page === "home" && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-[#ECEAE4] bg-white p-3 sm:hidden">
          <button type="button" onClick={() => setBasketOpen(true)} className="flex h-[52px] w-full items-center justify-between rounded-[14px] px-5 font-semibold text-white" style={{ background: "var(--accent)" }}>
            <span>
              {t("basket")} · {count}
            </span>
            <span dir="ltr">{fmt(subtotal)}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function SearchBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="relative w-full">
      <svg className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[#8A8E94]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={label} aria-label={label} className="h-11 w-full rounded-full border border-[#E3E0D8] bg-[#F7F6F2] ps-10 pe-4 text-[15px] focus:border-[var(--accent)] focus:outline-none" />
    </div>
  );
}

function Photo({ src, className, alt = "" }: { src?: string; className?: string; alt?: string }) {
  const t = useTranslations("run.shop");
  const { url } = useMediaUrl(src);
  return url ? <img src={url} alt={alt} className={className} /> : <div className={`flex items-center justify-center bg-[#F1EFEA] text-xs text-[#8A8E94] ${className}`}>{t("noPhoto")}</div>;
}

function HeroBanner({ banner, lang, onClick, onSeen }: { banner: Banner; lang: Lang; onClick: () => void; onSeen: () => void }) {
  useEffect(onSeen, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <button type="button" onClick={onClick} className="relative mt-4 block aspect-[21/9] w-full overflow-hidden rounded-2xl text-start sm:aspect-[3/1]">
      <Photo src={banner.image} className="absolute inset-0 h-full w-full object-cover" />
      <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
      <span className="absolute bottom-0 start-0 p-5 text-xl font-semibold text-white sm:p-8 sm:text-3xl">{tx(banner.headline, lang)}</span>
    </button>
  );
}

function Price({ p, fmt, big = false }: { p: Product; fmt: (n: number) => string; big?: boolean }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <strong className={big ? "text-2xl" : "text-[15px]"} dir="ltr">
        {fmt(p.price)}
      </strong>
      {p.was && p.was > p.price && (
        <s className="text-sm text-[#8A8E94]" dir="ltr">
          {fmt(p.was)}
        </s>
      )}
    </span>
  );
}

function ListingItem({ p, i, banner, lang, fmt, qty, onOpen, onAdd, log }: { p: Product; i: number; banner?: Banner; lang: Lang; fmt: (n: number) => string; qty: number; onOpen: () => void; onAdd: () => void; log: Log }) {
  const t = useTranslations("run.shop");
  return (
    <>
      {/* An in-listing ad after the fourth product */}
      {banner && i === 4 && (
        <li className="col-span-2 md:col-span-3 lg:col-span-4">
          <ListingBanner banner={banner} lang={lang} log={log} />
        </li>
      )}
      <li className="flex flex-col gap-2">
        <button type="button" onClick={onOpen} className="group relative block overflow-hidden rounded-2xl bg-[#F1EFEA] text-start">
          <Photo src={p.images[0]} className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          {p.offer?.[lang] && <span className="absolute start-2 top-2 rounded-full bg-[#FFE66D] px-2.5 py-1 text-xs font-bold text-[#1A1A1A]">{tx(p.offer, lang)}</span>}
        </button>
        <div className="flex flex-col gap-1 px-0.5">
          {p.sponsored && <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8A8E94]">{t("sponsored")}</span>}
          <button type="button" onClick={onOpen} className="text-start text-[15px] font-medium leading-snug hover:underline">
            {tx(p.name, lang)}
          </button>
          {p.rating !== undefined && <Stars n={p.rating} />}
          <Price p={p} fmt={fmt} />
          <button
            type="button"
            onClick={onAdd}
            className={`mt-1 h-11 rounded-xl text-sm font-semibold ${qty ? "border-[1.5px] border-[var(--accent)] text-[var(--accent)]" : "text-white"}`}
            style={qty ? undefined : { background: "var(--accent)" }}
          >
            {qty ? `✓ ${t("added")} · ${qty}` : t("add")}
          </button>
        </div>
      </li>
    </>
  );
}

function ListingBanner({ banner, lang, log }: { banner: Banner; lang: Lang; log: Log }) {
  useEffect(() => log("ad_impression", { banner: banner.id }), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="relative aspect-[4/1] overflow-hidden rounded-2xl">
      <Photo src={banner.image} className="absolute inset-0 h-full w-full object-cover" />
      <span className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent rtl:bg-gradient-to-l" />
      <span className="absolute inset-y-0 start-0 flex items-center p-5 text-lg font-semibold text-white">{tx(banner.headline, lang)}</span>
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-1 text-sm text-[#5C6066]" aria-label={`${n} / 5`}>
      <span aria-hidden="true" className="text-[#E8A317]">
        {"★".repeat(Math.round(n))}
        <span className="text-[#D9D6CF]">{"★".repeat(5 - Math.round(n))}</span>
      </span>
      <span dir="ltr">{n.toFixed(1)}</span>
    </span>
  );
}

function ProductPage({ p, lang, fmt, qty, setQty, back }: { p: Product; lang: Lang; fmt: (n: number) => string; qty: number; setQty: (q: number) => void; back: () => void }) {
  const t = useTranslations("run.shop");
  const [img, setImg] = useState(0);
  return (
    <section className="mt-4 flex flex-col gap-6">
      <button type="button" onClick={back} className="self-start py-2 text-sm font-medium hover:underline">
        ← {t("backToShop")}
      </button>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Photo src={p.images[img]} className="aspect-square w-full rounded-2xl object-cover" alt={tx(p.name, lang)} />
          {p.images.length > 1 && (
            <div className="flex gap-2">
              {p.images.map((m, i) => (
                <button key={i} type="button" onClick={() => setImg(i)} aria-label={`${i + 1}`} aria-pressed={img === i} className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${img === i ? "border-[var(--accent)]" : "border-transparent"}`}>
                  <Photo src={m} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4">
          {p.sponsored && <span className="text-xs font-semibold uppercase tracking-wide text-[#8A8E94]">{t("sponsored")}</span>}
          <h1 className="text-3xl font-semibold leading-tight">{tx(p.name, lang)}</h1>
          {p.rating !== undefined && <Stars n={p.rating} />}
          <Price p={p} fmt={fmt} big />
          {p.offer?.[lang] && <span className="self-start rounded-full bg-[#FFE66D] px-3 py-1 text-sm font-bold text-[#1A1A1A]">{tx(p.offer, lang)}</span>}
          <p className="text-[16px] leading-[1.7] text-[#2D3035]">{tx(p.description, lang)}</p>
          {p.attributes && p.attributes.length > 0 && (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {p.attributes.map((a, i) => (
                <div key={i} className="contents">
                  <dt className="text-[#5C6066]">{tx(a.key, lang)}</dt>
                  <dd>{tx(a.value, lang)}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="flex items-center gap-3">
            {qty > 0 ? (
              <div className="flex items-center rounded-[14px] border-[1.5px] border-[#E3E0D8]">
                <button type="button" onClick={() => setQty(qty - 1)} aria-label={t("remove")} className="h-[52px] w-12 text-xl">
                  −
                </button>
                <span className="w-10 text-center font-semibold" aria-live="polite" aria-label={`${t("qty")}: ${qty}`}>
                  {qty}
                </span>
                <button type="button" onClick={() => setQty(qty + 1)} aria-label={t("add")} className="h-[52px] w-12 text-xl">
                  +
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setQty(1)} className="h-[52px] flex-1 rounded-[14px] px-6 font-semibold text-white sm:flex-none" style={{ background: "var(--accent)" }}>
                {t("add")}
              </button>
            )}
          </div>
          {p.reviews && p.reviews.length > 0 && (
            <section className="mt-4 flex flex-col gap-3 border-t border-[#ECEAE4] pt-4">
              <h2 className="text-lg font-semibold">{t("reviews")}</h2>
              {p.reviews.map((r) => (
                <article key={r.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <strong className="text-sm">{r.author}</strong>
                    <Stars n={r.stars} />
                  </div>
                  <p className="text-sm text-[#2D3035]">{tx(r.text, lang)}</p>
                </article>
              ))}
            </section>
          )}
        </div>
      </div>
    </section>
  );
}

function BasketLines({ basket, shop, lang, fmt, setQty }: { basket: Line[]; shop: Shop; lang: Lang; fmt: (n: number) => string; setQty: (p: Product, q: number) => void }) {
  const t = useTranslations("run.shop");
  return (
    <ul className="flex flex-col divide-y divide-[#ECEAE4]">
      {basket.map((l) => {
        const p = shop.products.find((x) => x.id === l.product);
        if (!p) return null;
        return (
          <li key={l.product} className="flex items-center gap-3 py-3">
            <Photo src={p.images[0]} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{tx(p.name, lang)}</span>
              <span className="text-sm text-[#5C6066]" dir="ltr">
                {fmt(l.price)}
              </span>
            </div>
            <div className="flex items-center rounded-xl border border-[#E3E0D8]">
              <button type="button" onClick={() => setQty(p, l.qty - 1)} aria-label={`${t("remove")}: ${tx(p.name, lang)}`} className="h-11 w-10">
                −
              </button>
              <span className="w-6 text-center text-sm font-semibold">{l.qty}</span>
              <button type="button" onClick={() => setQty(p, l.qty + 1)} aria-label={`${t("add")}: ${tx(p.name, lang)}`} className="h-11 w-10">
                +
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Totals({ subtotal, budget, fmt }: { subtotal: number; budget?: number; fmt: (n: number) => string }) {
  const t = useTranslations("run.shop");
  return (
    <div className="flex flex-col gap-1 border-t border-[#ECEAE4] pt-3">
      <div className="flex justify-between text-lg font-semibold">
        <span>{t("subtotal")}</span>
        <span dir="ltr">{fmt(subtotal)}</span>
      </div>
      {budget !== undefined && (
        <p className={`text-sm ${subtotal > budget ? "font-medium text-[#B42318]" : "text-[#5C6066]"}`}>
          {t("budget", { amount: fmt(budget) })}
          {subtotal > budget ? ` · ${t("overBudget")}` : ""}
        </p>
      )}
    </div>
  );
}
