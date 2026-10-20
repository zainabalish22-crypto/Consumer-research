"use client";
/**
 * Online shop simulation: home, listing (search, filters, sorting), product
 * pages, cart and a simulated checkout. No payment is taken, no order is placed
 * and no payment or address details are ever asked for.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Language, OnlineShopBlock, StudyConfig } from "@/lib/study/schema";
import type { Assignment } from "@/lib/study/flow";
import { libraryOf, offerForItem, orderItems, resolveAd } from "@/lib/study/environment";
import { effectiveUnitPrice, formatPrice, lineTotal, type LibOffer, type LibProduct } from "@/lib/study/library";
import { lt } from "@/lib/study/text";
import { Alert, Button, cx } from "@/components/ui";
import type { Tr } from "../i18n";
import type { EventData } from "../events";
import { AdCreative, OfferBadge, ProductIcon, type Log } from "./shared";
import type { ShopAnswer } from "@/lib/study/envAnswers";

type Page = { name: "home" } | { name: "list" } | { name: "product"; id: string } | { name: "cart" } | { name: "checkout" };
type Sort = "featured" | "price_asc" | "price_desc" | "rating" | "name";
type Line = ShopAnswer["cart"][number];

interface Item {
  p: LibProduct;
  pos: number;
  offer: LibOffer | null;
  price: number;
  sponsored: boolean;
}

export function ShopView({
  block,
  config,
  assignment,
  seed,
  lang,
  fallback,
  mediaUrls,
  tr,
  t,
  log,
  busy,
  error,
  onSubmit,
  heading,
}: {
  block: OnlineShopBlock;
  config: StudyConfig;
  assignment: Assignment;
  seed: string;
  lang: Language;
  fallback: Language;
  mediaUrls: Record<string, string>;
  tr: Tr;
  t: (x: Parameters<typeof lt>[0]) => string;
  log: Log;
  busy: boolean;
  error?: string;
  onSubmit: (value: ShopAnswer) => void;
  heading: (text: string) => React.ReactNode;
}) {
  const lib = libraryOf(config);
  const L = useCallback((x: Parameters<typeof lt>[0]) => lt(x, lang, fallback), [lang, fallback]);
  const money = (n: number, cur = block.currency) => formatPrice(n, cur, lang);

  const items: Item[] = useMemo(() => {
    const ids = orderItems(block.products, block.productOrder, config, assignment, `${seed}:${block.id}`);
    return ids
      .map((id, i) => {
        const p = lib.products[id];
        if (!p) return null;
        const offer = offerForItem(block.offers, id, config, assignment);
        return { p, pos: i + 1, offer, price: effectiveUnitPrice(p.basePrice, offer), sponsored: block.placements.sponsored.includes(id) } satisfies Item;
      })
      .filter((x): x is Item => x !== null);
  }, [block, config, assignment, seed, lib]);
  const byId = useMemo(() => new Map(items.map((x) => [x.p.id, x])), [items]);
  const categories = useMemo(() => [...new Set(items.map((x) => x.p.category).filter(Boolean))], [items]);
  const adOf = (id: string | null) => (id && lib.ads[id] ? resolveAd(lib.ads[id], block.ads, config, assignment) : null);

  const [page, setPage] = useState<Page>({ name: "home" });
  const [cart, setCart] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [category, setCategory] = useState("");
  const [onOffer, setOnOffer] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [sort, setSort] = useState<Sort>("featured");
  const [showFilters, setShowFilters] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(block.timeLimitSec ?? null);
  const done = useRef(false);
  const popupShownAt = useRef(0);
  const maxScroll = useRef(0);
  const topRef = useRef<HTMLDivElement>(null);

  const ctx = (id: string): EventData => {
    const it = byId.get(id);
    return { product: id, productCode: it?.p.code ?? null, pos: it?.pos ?? null, offer: it?.offer?.code ?? null, sponsored: it?.sponsored ?? false };
  };
  const pageKey = (pg: Page) => (pg.name === "product" ? `product:${lib.products[pg.id]?.code ?? pg.id}` : pg.name);

  // Page views and scroll depth (max % of the page scrolled, reported when leaving the page).
  useEffect(() => {
    log("shop_page", { page: page.name, product: page.name === "product" ? page.id : null, category: page.name === "list" ? category || null : null });
    maxScroll.current = 0;
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const pct = h > 0 ? Math.min(100, Math.round((window.scrollY / h) * 100)) : 100;
      maxScroll.current = Math.max(maxScroll.current, pct);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const key = pageKey(page);
    return () => {
      window.removeEventListener("scroll", onScroll);
      log("scroll_depth", { page: key, pct: maxScroll.current });
    };
    // Logged once per page view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    log("env_enter", { products: items.length });
    if (block.placements.popup && adOf(block.placements.popup)) {
      const timer = setTimeout(() => {
        popupShownAt.current = performance.now();
        setPopupOpen(true);
      }, block.placements.popupDelaySec * 1000);
      return () => clearTimeout(timer);
    }
    // Once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (pg: Page) => {
    setPage(pg);
    setNotice(null);
    topRef.current?.scrollIntoView({ block: "start" });
    window.scrollTo({ top: 0 });
  };

  // ---------------------------------------------------------------------------
  // Cart
  // ---------------------------------------------------------------------------
  const count = cart.reduce((n, l) => n + l.qty, 0);
  const lineValue = (l: Line) => {
    const it = byId.get(l.product);
    return it ? lineTotal(it.p.basePrice, it.offer, l.qty) : 0;
  };
  const total = Math.round(cart.reduce((s, l) => s + lineValue(l), 0) * 1000) / 1000;

  const setQty = (id: string, qty: number) => {
    const current = cart.find((l) => l.product === id)?.qty ?? 0;
    const delta = qty - current;
    if (delta > 0 && count + delta > block.maxItems) return setNotice(tr("maxReached", { n: block.maxItems }));
    const next = qty <= 0 ? cart.filter((l) => l.product !== id) : current ? cart.map((l) => (l.product === id ? { ...l, qty } : l)) : [...cart, { product: id, qty }];
    const value = next.reduce((s, l) => s + lineValue(l), 0);
    if (delta > 0 && block.budget !== undefined && value > block.budget + 1e-9) return setNotice(tr("overBudget"));
    setCart(next);
    if (delta > 0) {
      setNotice(tr("addedToCart", { item: L(byId.get(id)!.p.name) }));
      log("bag_add", { ...ctx(id), qty: delta });
    } else if (delta < 0) log("bag_remove", { ...ctx(id), qty: -delta });
  };

  const finish = (timedOut: boolean) => {
    if (done.current) return;
    if (!timedOut && count < block.minItems) return setNotice(tr("needMore", { n: block.minItems }));
    done.current = true;
    log("checkout", { items: count, value: total, timedOut });
    onSubmit({ cart, checkedOut: !timedOut, timedOut });
  };

  useEffect(() => {
    if (timeLeft === null || done.current) return;
    if (timeLeft <= 0) {
      finish(true);
      return;
    }
    const timer = setTimeout(() => setTimeLeft((s) => (s === null ? s : s - 1)), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // ---------------------------------------------------------------------------
  // Listing
  // ---------------------------------------------------------------------------
  const matches = (it: Item) => {
    const q = appliedQuery.trim().toLowerCase();
    if (q) {
      const hay = [it.p.name.en, it.p.name.ar, it.p.description.en, it.p.description.ar, it.p.category, it.p.brandId ? lib.brands[it.p.brandId]?.name.en : "", it.p.brandId ? lib.brands[it.p.brandId]?.name.ar : ""]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (category && it.p.category !== category) return false;
    if (onOffer && !(it.offer && it.offer.kind !== "none") && !(it.p.originalPrice && it.p.originalPrice > it.p.basePrice)) return false;
    if (minRating && (it.p.rating ?? 0) < minRating) return false;
    if (maxPrice !== null && it.price > maxPrice) return false;
    return true;
  };
  const listed = useMemo(() => {
    const filtered = items.filter(matches);
    const sorted = [...filtered];
    if (sort === "price_asc") sorted.sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") sorted.sort((a, b) => b.price - a.price);
    else if (sort === "rating") sorted.sort((a, b) => (b.p.rating ?? 0) - (a.p.rating ?? 0));
    else if (sort === "name") sorted.sort((a, b) => L(a.p.name).localeCompare(L(b.p.name), lang));
    else sorted.sort((a, b) => Number(b.sponsored) - Number(a.sponsored)); // stable: sponsored first, then participant's order
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, appliedQuery, category, onOffer, minRating, maxPrice, sort, lang]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().slice(0, 100);
    setAppliedQuery(q);
    const results = items.filter((it) => {
      if (!q) return true;
      const hay = [it.p.name.en, it.p.name.ar, it.p.description.en, it.p.description.ar, it.p.category].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q.toLowerCase());
    }).length;
    log("shop_search", { query: q, results });
    go({ name: "list" });
  };
  const filter = (name: string, value: string | number | boolean | null, apply: () => void) => {
    apply();
    log("shop_filter", { filter: name, value });
  };

  // ---------------------------------------------------------------------------
  // Rendering helpers
  // ---------------------------------------------------------------------------
  const prices = items.map((x) => x.price);
  const priceCap = prices.length ? Math.ceil(Math.max(...prices)) : 0;

  const Stars = ({ value, count: n }: { value: number | null; count?: number | null }) =>
    !block.showRatings || value === null ? null : (
      <span className="flex items-center gap-1 text-xs text-muted">
        <span aria-label={tr("ratingOutOf", { value: value.toFixed(1) })} className="tracking-tight text-[#b45309]">
          {"★★★★★".slice(0, Math.round(value))}
          <span className="text-line">{"★★★★★".slice(Math.round(value))}</span>
        </span>
        <span>{value.toFixed(1)}</span>
        {n ? <span>({n})</span> : null}
      </span>
    );

  const PriceLine = ({ it }: { it: Item }) => {
    const cur = it.p.currency || block.currency;
    const was = it.p.originalPrice && it.p.originalPrice > it.p.basePrice ? it.p.originalPrice : null;
    return (
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold">{money(it.p.basePrice, cur)}</span>
        {was && <span className="text-xs text-muted line-through">{money(was, cur)}</span>}
        {it.offer && it.offer.kind !== "none" && it.price < it.p.basePrice && <span className="text-xs text-[#c2410c]">{tr("effectiveEach", { price: money(it.price, cur) })}</span>}
      </span>
    );
  };

  const Thumb = ({ it, className }: { it: Item; className?: string }) => {
    const img = it.p.images.find((m) => m.kind === "image");
    const url = img ? mediaUrls[img.storagePath] : undefined;
    const brand = it.p.brandId ? lib.brands[it.p.brandId] : undefined;
    return (
      <span className={cx("block overflow-hidden bg-paper", className)}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={L(img!.alt) || L(it.p.name)} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <ProductIcon color={brand?.colors.primary} />
        )}
      </span>
    );
  };

  const ProductGrid = ({ list }: { list: Item[] }) => (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {list.map((it) => (
        <ProductCard key={it.p.id} it={it} />
      ))}
    </ul>
  );

  const ProductCard = ({ it }: { it: Item }) => {
    const ref = useRef<HTMLLIElement>(null);
    useEffect(() => {
      const el = ref.current;
      if (!el || typeof IntersectionObserver === "undefined") return;
      let seen = false;
      const obs = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting && !seen) {
            seen = true;
            log("product_view", { ...ctx(it.p.id), page: page.name });
          }
        },
        { threshold: 0.5 },
      );
      obs.observe(el);
      return () => obs.disconnect();
      // One view per card per page.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [it.p.id]);
    return (
      <li ref={ref} className="flex flex-col overflow-hidden rounded-lg border border-line bg-white">
        <button type="button" className="relative text-start" onClick={() => openProduct(it.p.id)} aria-label={tr("details", { item: L(it.p.name) })}>
          <Thumb it={it} className="aspect-square w-full" />
          {it.sponsored && <span className="absolute start-1.5 top-1.5 rounded bg-white/90 px-1.5 text-[10px] font-medium text-muted">{tr("sponsored")}</span>}
          <OfferBadge offer={it.offer} lang={lang} fallback={fallback} className="absolute end-1.5 top-1.5" />
        </button>
        <div className="flex flex-1 flex-col gap-1 p-2 text-sm">
          <button type="button" className="text-start font-medium hover:underline" dir="auto" onClick={() => openProduct(it.p.id)}>
            {L(it.p.name)}
          </button>
          {it.p.brandId && lib.brands[it.p.brandId] && <span className="text-xs text-muted">{L(lib.brands[it.p.brandId].name)}</span>}
          <Stars value={it.p.rating} count={it.p.ratingCount} />
          <PriceLine it={it} />
          <Button size="sm" className="mt-auto" onClick={() => setQty(it.p.id, (cart.find((l) => l.product === it.p.id)?.qty ?? 0) + 1)}>
            {tr("addToCart")}
          </Button>
        </div>
      </li>
    );
  };

  const openProduct = (id: string) => {
    log("product_detail", ctx(id));
    go({ name: "product", id });
  };

  const sidebarAds = block.placements.sidebar.map(adOf).filter((x): x is NonNullable<typeof x> => !!x);
  const bannerAds = block.placements.banner.map(adOf).filter((x): x is NonNullable<typeof x> => !!x);
  const popupAd = adOf(block.placements.popup);

  // ---------------------------------------------------------------------------
  // Pages
  // ---------------------------------------------------------------------------
  let body: React.ReactNode = null;
  if (page.name === "home") {
    const featured = [...items].sort((a, b) => Number(b.sponsored) - Number(a.sponsored)).slice(0, 8);
    body = (
      <div className="flex flex-col gap-5">
        {bannerAds.length > 0 && (
          <div className="flex snap-x gap-3 overflow-x-auto">
            {bannerAds.map((ad) => (
              <AdCreative key={ad.ad.id} shown={ad} url={ad.media ? mediaUrls[ad.media.storagePath] : undefined} lang={lang} fallback={fallback} log={log} context={{ placement: "banner" }} compact className="max-h-72 w-full shrink-0 snap-start" />
            ))}
          </div>
        )}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className="rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:border-accent"
                onClick={() => filter("category", c, () => (setCategory(c), go({ name: "list" })))}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{tr("featured")}</h2>
            <button type="button" className="text-sm text-accent hover:underline" onClick={() => go({ name: "list" })}>
              {tr("seeAll")}
            </button>
          </div>
          <ProductGrid list={featured} />
        </section>
      </div>
    );
  } else if (page.name === "list") {
    body = (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">{tr("resultsCount", { n: listed.length })}</span>
          {appliedQuery && (
            <button type="button" className="rounded-full bg-paper px-2 py-0.5" onClick={() => (setAppliedQuery(""), setQuery(""))}>
              “{appliedQuery}” ✕
            </button>
          )}
          <span className="flex-1" />
          {block.showFilters && (
            <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
              {tr("filters")}
            </Button>
          )}
          {block.showSort && (
            <label className="flex items-center gap-1">
              <span className="text-muted">{tr("sortBy")}</span>
              <select
                className="rounded-lg border border-line bg-white px-2 py-1"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as Sort);
                  log("shop_sort", { sort: e.target.value });
                }}
              >
                {(["featured", "price_asc", "price_desc", ...(block.showRatings ? (["rating"] as const) : []), "name"] as Sort[]).map((s) => (
                  <option key={s} value={s}>
                    {tr(`sort_${s}`)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {listed.length === 0 ? <p className="rounded-lg bg-paper p-6 text-center text-sm text-muted">{tr("noResults")}</p> : <ProductGrid list={listed} />}
      </div>
    );
  } else if (page.name === "product") {
    const it = byId.get(page.id);
    if (it) {
      const inCart = cart.find((l) => l.product === it.p.id)?.qty ?? 0;
      body = (
        <div className="flex flex-col gap-4">
          <button type="button" className="self-start text-sm text-accent hover:underline" onClick={() => go({ name: "list" })}>
            ← {tr("backToResults")}
          </button>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              {it.p.images.length === 0 ? (
                <Thumb it={it} className="aspect-square w-full rounded-lg" />
              ) : (
                it.p.images.map((m) =>
                  !mediaUrls[m.storagePath] ? null : m.kind === "video" ? (
                    <video key={m.assetId} src={mediaUrls[m.storagePath]} controls playsInline preload="metadata" className="w-full rounded-lg bg-black" aria-label={L(m.alt)} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={m.assetId} src={mediaUrls[m.storagePath]} alt={L(m.alt) || L(it.p.name)} className="w-full rounded-lg object-cover" />
                  ),
                )
              )}
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold" dir="auto">
                {L(it.p.name)}
              </h2>
              {it.p.brandId && lib.brands[it.p.brandId] && <p className="text-sm text-muted">{L(lib.brands[it.p.brandId].name)}</p>}
              <Stars value={it.p.rating} count={it.p.ratingCount} />
              <div className="flex flex-wrap items-center gap-2">
                <PriceLine it={it} />
                <OfferBadge offer={it.offer} lang={lang} fallback={fallback} />
              </div>
              {L(it.p.description) && <p className="prose-study text-sm">{L(it.p.description)}</p>}
              {it.p.attributes.length > 0 && (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  {it.p.attributes.map((a, i) => (
                    <div key={i} className="contents">
                      <dt className="text-muted">{L(a.name)}</dt>
                      <dd>{L(a.value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="flex items-center gap-2">
                <Button onClick={() => setQty(it.p.id, inCart + 1)}>{tr("addToCart")}</Button>
                {inCart > 0 && <span className="text-sm text-muted">{tr("inCart", { n: inCart })}</span>}
              </div>
            </div>
          </div>
          {block.showRatings && it.p.reviews.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="font-semibold">{tr("reviews")}</h3>
              <ul className="flex flex-col gap-2">
                {it.p.reviews.map((r, i) => (
                  <li key={i} className="rounded-lg border border-line bg-white p-3 text-sm">
                    <p className="flex items-center gap-2">
                      <span className="font-medium" dir="auto">
                        {L(r.author)}
                      </span>
                      <span className="text-[#b45309]" aria-label={tr("ratingOutOf", { value: String(r.rating) })}>
                        {"★".repeat(r.rating)}
                      </span>
                    </p>
                    <p className="prose-study mt-1" dir="auto">
                      {L(r.text)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      );
    }
  } else if (page.name === "cart" || page.name === "checkout") {
    const checkout = page.name === "checkout";
    body = (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{checkout ? tr("checkoutTitle") : tr("cart")}</h2>
        {cart.length === 0 ? (
          <p className="text-sm text-muted">{tr("cartEmpty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-white">
            {cart.map((l) => {
              const it = byId.get(l.product)!;
              return (
                <li key={l.product} className="flex items-center gap-3 p-3 text-sm">
                  <Thumb it={it} className="h-14 w-14 shrink-0 rounded-md" />
                  <span className="flex-1">
                    <span className="block font-medium" dir="auto">
                      {L(it.p.name)}
                    </span>
                    <OfferBadge offer={it.offer} lang={lang} fallback={fallback} />
                  </span>
                  {checkout ? (
                    <span className="tabular-nums">×{l.qty}</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Button variant="secondary" size="sm" aria-label={tr("decrease", { item: L(it.p.name) })} onClick={() => setQty(l.product, l.qty - 1)}>
                        −
                      </Button>
                      <span className="w-6 text-center tabular-nums">{l.qty}</span>
                      <Button variant="secondary" size="sm" aria-label={tr("increase", { item: L(it.p.name) })} onClick={() => setQty(l.product, l.qty + 1)}>
                        +
                      </Button>
                    </span>
                  )}
                  <span className="w-24 text-end tabular-nums">{money(lineValue(l))}</span>
                  {!checkout && (
                    <Button variant="ghost" size="sm" onClick={() => setQty(l.product, 0)}>
                      {tr("remove")}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="flex justify-between border-t border-line pt-3 font-semibold">
          <span>{tr("total")}</span>
          <span className="tabular-nums">{money(total)}</span>
        </p>
        {block.budget !== undefined && <p className="text-sm text-muted">{tr("budgetLeft", { amount: money(Math.max(0, block.budget - total)) })}</p>}
        {checkout ? (
          <>
            <Alert>{tr("simulatedCheckout")}</Alert>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => go({ name: "cart" })}>
                {tr("backToCart")}
              </Button>
              <Button disabled={busy} onClick={() => finish(false)} className="min-w-40 py-3">
                {busy ? tr("saving") : tr("placeOrder")}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => go({ name: "list" })}>
              {tr("continueShopping")}
            </Button>
            <Button
              disabled={cart.length === 0 && block.minItems > 0}
              onClick={() => {
                if (count < block.minItems) return setNotice(tr("needMore", { n: block.minItems }));
                log("checkout_start", { items: count, value: total });
                go({ name: "checkout" });
              }}
            >
              {tr("proceedToCheckout")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3" ref={topRef}>
      {t(block.heading) ? heading(t(block.heading)) : <div className="sr-only">{heading(t(block.shopName) || tr("shopTitle"))}</div>}
      {t(block.instructions) && <p className="prose-study text-sm text-muted">{t(block.instructions)}</p>}
      {error && <Alert tone="danger">{tr(`err_${error}`)}</Alert>}

      <div className="overflow-hidden rounded-xl border border-line bg-[#fafafa]">
        {/* Shop header */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-white px-3 py-2">
          <button type="button" className="text-lg font-bold" onClick={() => go({ name: "home" })} dir="auto">
            {t(block.shopName) || tr("shopTitle")}
          </button>
          {block.showSearch && (
            <form role="search" onSubmit={submitSearch} className="order-last flex w-full gap-1 sm:order-none sm:w-auto sm:flex-1">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr("searchProducts")}
                aria-label={tr("searchProducts")}
                maxLength={100}
                dir="auto"
                className="min-w-0 flex-1 rounded-lg border border-line px-3 py-1.5 text-sm"
              />
              <Button type="submit" size="sm">
                {tr("search")}
              </Button>
            </form>
          )}
          <span className="flex-1 sm:hidden" />
          <button type="button" onClick={() => go({ name: "list" })} className="rounded-lg px-2 py-1.5 text-sm hover:bg-paper">
            {tr("allProducts")}
          </button>
          <button type="button" onClick={() => go({ name: "cart" })} className="flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-paper" aria-label={tr("cartSummary", { n: count, total: money(total) })}>
            🛒 {tr("cartSummary", { n: count, total: money(total) })}
          </button>
          {timeLeft !== null && (
            <span className={cx("text-sm tabular-nums", timeLeft <= 30 ? "font-semibold text-danger" : "text-muted")}>
              ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </span>
          )}
        </div>
        {notice && (
          <p role="status" className="bg-accent-soft px-3 py-1.5 text-sm text-accent-strong">
            {notice}
          </p>
        )}

        <div className="grid gap-4 p-3 lg:grid-cols-[13rem_1fr]">
          {/* Sidebar: filters (listing only) and sidebar ads */}
          <aside className={cx("flex flex-col gap-4", page.name === "list" && block.showFilters ? (showFilters ? "" : "hidden lg:flex") : sidebarAds.length ? "hidden lg:flex" : "hidden")}>
            {page.name === "list" && block.showFilters && (
              <div className="flex flex-col gap-3 rounded-lg border border-line bg-white p-3 text-sm">
                <p className="font-semibold">{tr("filters")}</p>
                {categories.length > 0 && (
                  <label className="flex flex-col gap-1">
                    <span className="text-muted">{tr("category")}</span>
                    <select className="rounded-lg border border-line px-2 py-1" value={category} onChange={(e) => filter("category", e.target.value || null, () => setCategory(e.target.value))}>
                      <option value="">{tr("allCategories")}</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {priceCap > 0 && (
                  <label className="flex flex-col gap-1">
                    <span className="text-muted">{tr("maxPrice", { price: money(maxPrice ?? priceCap) })}</span>
                    <input
                      type="range"
                      min={0}
                      max={priceCap}
                      step={0.5}
                      value={maxPrice ?? priceCap}
                      onChange={(e) => setMaxPrice(Number(e.target.value))}
                      onPointerUp={() => log("shop_filter", { filter: "max_price", value: maxPrice })}
                      onKeyUp={() => log("shop_filter", { filter: "max_price", value: maxPrice })}
                      className="accent-[var(--color-accent)]"
                    />
                  </label>
                )}
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={onOffer} onChange={(e) => filter("on_offer", e.target.checked, () => setOnOffer(e.target.checked))} />
                  {tr("onOfferOnly")}
                </label>
                {block.showRatings && items.some((x) => x.p.rating !== null) && (
                  <label className="flex flex-col gap-1">
                    <span className="text-muted">{tr("minRating")}</span>
                    <select className="rounded-lg border border-line px-2 py-1" value={minRating} onChange={(e) => filter("min_rating", Number(e.target.value), () => setMinRating(Number(e.target.value)))}>
                      {[0, 3, 4, 4.5].map((r) => (
                        <option key={r} value={r}>
                          {r === 0 ? tr("anyRating") : tr("ratingAtLeast", { value: r })}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  className="self-start text-accent hover:underline"
                  onClick={() => filter("clear", null, () => (setCategory(""), setOnOffer(false), setMinRating(0), setMaxPrice(null)))}
                >
                  {tr("clearFilters")}
                </button>
              </div>
            )}
            {sidebarAds.map((ad) => (
              <AdCreative key={ad.ad.id} shown={ad} url={ad.media ? mediaUrls[ad.media.storagePath] : undefined} lang={lang} fallback={fallback} log={log} context={{ placement: "sidebar" }} compact />
            ))}
          </aside>
          <div className="min-w-0">{body}</div>
        </div>
      </div>

      {!block.requireCheckout && page.name !== "checkout" && (
        <div className="flex justify-end">
          <Button variant="secondary" disabled={busy} onClick={() => finish(false)}>
            {tr("leaveShop")}
          </Button>
        </div>
      )}

      {popupOpen && popupAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-label={tr("advert")} className="flex w-full max-w-md flex-col gap-3 rounded-2xl bg-white p-4">
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                autoFocus
                onClick={() => {
                  log("popup_close", { ad: popupAd.ad.id, ms: Math.round(performance.now() - popupShownAt.current) });
                  setPopupOpen(false);
                }}
              >
                {tr("close")} ✕
              </Button>
            </div>
            <AdCreative shown={popupAd} url={popupAd.media ? mediaUrls[popupAd.media.storagePath] : undefined} lang={lang} fallback={fallback} log={log} context={{ placement: "popup" }} />
          </div>
        </div>
      )}
    </section>
  );
}
