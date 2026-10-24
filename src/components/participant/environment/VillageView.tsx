"use client";
/**
 * Walkable 2D shopping street / food court. Rendered with DOM and CSS (no game
 * engine) so it stays light on mid-range phones and is usable by keyboard and
 * screen readers. Movement: hold the arrow buttons, use the keyboard, drag the
 * street, or pick a shop from the list to walk there.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Language, StudyConfig, VillageBlock } from "@/lib/study/schema";
import type { Assignment } from "@/lib/study/flow";
import { libraryOf, offerForStore, orderItems, resolveAd, type ShownAd } from "@/lib/study/environment";
import { formatPrice, lineTotal, type LibOffer, type LibProduct, type LibStore } from "@/lib/study/library";
import { seededShuffle } from "@/lib/random";
import { lt } from "@/lib/study/text";
import { Alert, Button, cx } from "@/components/ui";
import type { Tr } from "../i18n";
import type { EventData } from "../events";
import { AdCreative, OfferBadge, Price, ProductIcon, brandColor, type Log } from "./shared";
import type { VillageAnswer } from "@/lib/study/envAnswers";

const SPACING = 240;
const STORE_W = 180;

interface StoreView {
  id: string;
  s: LibStore;
  pos: number;
  color: string;
  offer: LibOffer | null;
  products: LibProduct[];
  facadeAd: ShownAd | null;
  inStoreAds: ShownAd[];
}

type Line = VillageAnswer["basket"][number];

/**
 * Street appearance per theme. Themes change colours and paving only, never
 * store positions, distances or anything that is recorded.
 */
const THEMES: Record<string, { ground: string; road: string; sky?: string; marking: string; markingStyle?: React.CSSProperties }> = {
  minimal: { ground: "bg-[#eef2f1]", road: "bg-[#cfd6dc]", marking: "top-1/2 h-0 -translate-y-1/2 border-t-4 border-dashed border-white/80" },
  neutral: { ground: "bg-[#eceff3]", road: "bg-[#d5d9de]", marking: "top-1/2 h-0 -translate-y-1/2 border-t-2 border-white/70" },
  playful: {
    ground: "bg-[#fff4d6]",
    road: "bg-[#ffd1dc]",
    sky: "bg-gradient-to-b from-[#cdeffd] to-[#fff4d6]",
    marking: "top-0 h-full",
    markingStyle: { backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.9) 0 6px, transparent 7px)", backgroundSize: "48px 48px", backgroundPosition: "0 50%" },
  },
  luxury: {
    ground: "bg-[#f6f1e7]",
    road: "bg-[#2b2b2b]",
    sky: "bg-gradient-to-b from-[#ece3d0] to-[#f6f1e7]",
    marking: "top-1/2 h-0 -translate-y-1/2 border-t-2 border-[#c8a96a]",
  },
  souq: {
    ground: "bg-[#efe2c8]",
    road: "bg-[#d9c29a]",
    sky: "bg-[#e7d3ad]",
    marking: "top-0 h-full",
    markingStyle: {
      backgroundImage: "repeating-linear-gradient(90deg, rgba(122,86,44,0.18) 0 2px, transparent 2px 56px), repeating-linear-gradient(0deg, rgba(122,86,44,0.12) 0 2px, transparent 2px 28px)",
    },
  },
};

export function VillageView({
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
  block: VillageBlock;
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
  onSubmit: (value: VillageAnswer) => void;
  heading: (text: string) => React.ReactNode;
}) {
  const lib = libraryOf(config);
  const stores: StoreView[] = useMemo(() => {
    const ids = orderItems(block.stores, block.storeOrder, config, assignment, `${seed}:${block.id}`);
    return ids
      .map((id, i) => {
        const s = lib.stores[id];
        if (!s) return null;
        const brand = s.brandId ? lib.brands[s.brandId] : undefined;
        const products = s.productIds.map((p) => lib.products[p]).filter(Boolean);
        const facadeAd = s.facadeAdId && lib.ads[s.facadeAdId] ? resolveAd(lib.ads[s.facadeAdId], block.ads, config, assignment) : null;
        return {
          id,
          s,
          pos: i + 1,
          color: s.facade.color ?? brandColor(brand),
          offer: offerForStore(block.offers, id, config, assignment),
          products: block.productOrder === "random" ? seededShuffle(products, `${seed}:${id}:products`) : products,
          facadeAd,
          inStoreAds: s.inStoreAdIds.filter((a) => lib.ads[a]).map((a) => resolveAd(lib.ads[a], block.ads, config, assignment)),
        } satisfies StoreView;
      })
      .filter((x): x is StoreView => x !== null);
  }, [block, config, assignment, seed, lib]);

  const length = (stores.length + 1) * SPACING;
  const storeX = (i: number) => (i + 1) * SPACING;
  const ctx = (i: number): EventData => ({ store: stores[i].id, storeCode: stores[i].s.code, pos: stores[i].pos, offer: stores[i].offer?.code ?? null });

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [x, setX] = useState(SPACING / 2);
  const xRef = useRef(SPACING / 2);
  const [inside, setInside] = useState<number | null>(null);
  const enteredAt = useRef(0);
  const [entered, setEntered] = useState<Set<string>>(new Set());
  const [basket, setBasket] = useState<Line[]>([]);
  const [consideration, setConsideration] = useState<Record<string, 0 | 1>>({});
  const [asking, setAsking] = useState<number | null>(null);
  const [detail, setDetail] = useState<LibProduct | null>(null);
  const [showBag, setShowBag] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(block.timeLimitSec ?? null);
  const [vw, setVw] = useState(360);
  const viewport = useRef<HTMLDivElement>(null);
  const dir = useRef(0);
  const target = useRef<{ x: number; enter?: number } | null>(null);
  const near = useRef<Record<number, { since: number; approached: boolean; entered: boolean }>>({});
  const finished = useRef(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    log("env_enter", { stores: stores.length });
    const measure = () => setVw(viewport.current?.clientWidth ?? 360);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // Once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = basket.reduce((n, l) => n + l.qty, 0);
  const lineValue = (l: Line) => {
    const st = stores.find((s) => s.id === l.store);
    const p = lib.products[l.product];
    return p ? lineTotal(p.basePrice, st?.offer ?? null, l.qty) : 0;
  };
  const total = Math.round(basket.reduce((s, l) => s + lineValue(l), 0) * 1000) / 1000;
  const money = (n: number) => formatPrice(n, block.currency, lang);

  // ---------------------------------------------------------------------------
  // Entering / leaving
  // ---------------------------------------------------------------------------
  const enter = useCallback(
    (i: number) => {
      dir.current = 0;
      target.current = null;
      if (near.current[i]) near.current[i].entered = true;
      else near.current[i] = { since: performance.now(), approached: true, entered: true };
      enteredAt.current = performance.now();
      setEntered((s) => new Set(s).add(stores[i].id));
      setInside(i);
      log("store_enter", ctx(i));
      window.scrollTo({ top: 0 });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stores, log],
  );

  const exitStore = (i: number) => {
    log("store_leave", { ...ctx(i), ms: Math.round(performance.now() - enteredAt.current) });
    setInside(null);
    setDetail(null);
  };

  const leave = () => {
    if (inside === null) return;
    if (block.considerationPrompt && consideration[stores[inside].id] === undefined) setAsking(inside);
    else exitStore(inside);
  };

  // ---------------------------------------------------------------------------
  // Walking loop (only on the street)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (inside !== null || finished.current) return;
    let raf = 0;
    let last = 0;
    const speed = () => (reduced.current ? 4000 : 320);
    const step = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      let nx = xRef.current;
      if (target.current) {
        const d = target.current.x - nx;
        nx += Math.sign(d) * Math.min(Math.abs(d), speed() * dt);
        if (Math.abs(target.current.x - nx) < 1) {
          nx = target.current.x;
          const enterIdx = target.current.enter;
          target.current = null;
          if (enterIdx !== undefined) {
            xRef.current = nx;
            setX(nx);
            enter(enterIdx);
            return;
          }
        }
      } else if (dir.current) nx += dir.current * speed() * dt;
      nx = Math.max(0, Math.min(length, nx));
      if (nx !== xRef.current) {
        xRef.current = nx;
        setX(nx);
      }
      // Approach / pass detection.
      stores.forEach((_, i) => {
        const d = Math.abs(xRef.current - storeX(i));
        const n = near.current[i];
        if (d < block.approachDistance) {
          if (!n) near.current[i] = { since: now, approached: false, entered: false };
          else if (!n.approached && (now - n.since) / 1000 >= block.approachSeconds) {
            n.approached = true;
            log("store_approach", ctx(i));
          }
        } else if (n) {
          if (!n.entered) log("store_pass", { ...ctx(i), approached: n.approached });
          delete near.current[i];
        }
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inside, stores, length, block.approachDistance, block.approachSeconds, enter]);

  // Keyboard: arrows walk, Enter goes into the nearest shop.
  useEffect(() => {
    if (inside !== null) return;
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") dir.current = 1;
      else if (e.key === "ArrowLeft") dir.current = -1;
      else return;
      target.current = null;
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") dir.current = 0;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [inside]);

  // Time limit.
  useEffect(() => {
    if (timeLeft === null || finished.current) return;
    if (timeLeft <= 0) {
      finish(true);
      return;
    }
    const timer = setTimeout(() => setTimeLeft((s) => (s === null ? s : s - 1)), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // Drag the street to walk.
  const drag = useRef<{ startX: number; x0: number; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startX: e.clientX, x0: xRef.current, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 6) drag.current.moved = true;
    if (drag.current.moved) {
      target.current = null;
      const nx = Math.max(0, Math.min(length, drag.current.x0 - dx));
      xRef.current = nx;
      setX(nx);
    }
  };
  const onPointerUp = () => {
    setTimeout(() => (drag.current = null), 0);
  };

  const walkTo = (i: number, andEnter = true) => {
    if (drag.current?.moved) return;
    dir.current = 0;
    target.current = { x: storeX(i), enter: andEnter ? i : undefined };
  };

  // ---------------------------------------------------------------------------
  // Bag
  // ---------------------------------------------------------------------------
  const add = (st: StoreView, p: LibProduct, qty = 1) => {
    if (items + qty > block.maxPurchases) return setNotice(tr("maxReached", { n: block.maxPurchases }));
    const next = [...basket];
    const existing = next.find((l) => l.store === st.id && l.product === p.id);
    if (existing) existing.qty += qty;
    else next.push({ store: st.id, product: p.id, qty });
    const value = next.reduce((s, l) => s + lineValue(l), 0);
    if (block.budget !== undefined && value > block.budget + 1e-9) return setNotice(tr("overBudget"));
    setBasket(next.map((l) => ({ ...l })));
    setNotice(tr("added", { item: lt(p.name, lang, fallback) }));
    log("bag_add", { ...ctx(stores.indexOf(st)), product: p.id, productCode: p.code, qty, price: p.basePrice });
  };
  const remove = (l: Line) => {
    setBasket((b) => b.filter((x) => !(x.store === l.store && x.product === l.product)));
    const i = stores.findIndex((s) => s.id === l.store);
    const p = lib.products[l.product];
    log("bag_remove", { ...(i >= 0 ? ctx(i) : {}), product: l.product, productCode: p?.code ?? null, qty: l.qty });
  };

  const finish = (timedOut = false) => {
    if (finished.current) return;
    if (!timedOut) {
      if (items < block.minPurchases) return setNotice(tr("needMore", { n: block.minPurchases }));
      if (entered.size < block.mustEnterStores) return setNotice(tr("needStores", { n: block.mustEnterStores }));
    }
    finished.current = true;
    if (inside !== null) exitStore(inside);
    log("checkout", { items, value: total, timedOut });
    onSubmit({ basket, consideration, timedOut });
  };

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  const nearIdx = (() => {
    let best = -1;
    let bestD = Infinity;
    stores.forEach((_, i) => {
      const d = Math.abs(x - storeX(i));
      if (d < block.approachDistance && d < bestD) {
        best = i;
        bestD = d;
      }
    });
    return best;
  })();
  const offset = Math.max(0, Math.min(Math.max(0, length - vw + SPACING / 2), x - vw / 2));
  const food = block.layout === "foodcourt";
  const look = THEMES[block.theme] ?? THEMES.minimal;

  const topBar = (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface/95 px-3 py-2 text-sm shadow-sm backdrop-blur">
      <button type="button" onClick={() => setShowBag(true)} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 hover:bg-paper" aria-haspopup="dialog">
        <span aria-hidden>🛍</span>
        {tr("bagSummary", { n: items, total: money(total) })}
      </button>
      {block.budget !== undefined && <span className="text-muted">{tr("budgetLeft", { amount: money(Math.max(0, block.budget - total)) })}</span>}
      {timeLeft !== null && (
        <span className={cx("tabular-nums", timeLeft <= 30 ? "font-semibold text-danger" : "text-muted")} aria-live="off">
          ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
        </span>
      )}
      <span className="flex-1" />
      <Button size="sm" disabled={busy} onClick={() => finish(false)}>
        {busy ? tr("saving") : tr("finishShopping")}
      </Button>
    </div>
  );

  const storeInterior = inside !== null && stores[inside] && (
    <StoreInterior
      st={stores[inside]}
      lang={lang}
      fallback={fallback}
      mediaUrls={mediaUrls}
      currency={block.currency}
      tr={tr}
      log={log}
      ctx={ctx(inside)}
      onLeave={leave}
      onAdd={(p, q) => add(stores[inside], p, q)}
      onDetail={(p) => {
        setDetail(p);
        log("product_detail", { ...ctx(inside), product: p.id, productCode: p.code });
      }}
    />
  );

  return (
    <section className="flex flex-col gap-3">
      {block.heading && t(block.heading) ? heading(t(block.heading)) : heading(tr("villageTitle"))}
      {t(block.instructions) && <p className="prose-study text-sm text-muted">{t(block.instructions)}</p>}
      {error && <Alert tone="danger">{tr(`err_${error}`)}</Alert>}
      {topBar}
      {notice && (
        <p role="status" className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-strong">
          {notice}
        </p>
      )}

      {inside === null ? (
        <>
          <div
            ref={viewport}
            dir="ltr"
            className={cx(
              "relative h-[min(62vh,440px)] touch-pan-y select-none overflow-hidden rounded-xl border border-line",
              food ? "bg-[#f3eadb]" : look.ground,
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            role="application"
            aria-roledescription={tr("villageRole")}
            aria-label={tr("villageHelp")}
          >
            <div className="absolute inset-y-0" style={{ width: length + vw, transform: `translateX(${-offset}px)` }}>
              {/* Road / plaza */}
              {!food && look.sky && <div className={cx("absolute inset-x-0 top-0 h-[40%]", look.sky)} aria-hidden />}
              <div className={cx("absolute inset-x-0 top-[40%] h-[20%]", food ? "bg-[#e6d7bf]" : look.road)}>
                {food ? (
                  Array.from({ length: Math.ceil((length + vw) / 120) }, (_, k) => (
                    <span key={k} className="absolute top-1/2 h-7 w-7 -translate-y-1/2 rounded-full border-2 border-[#b89b72] bg-[#fdf8ef]" style={{ left: k * 120 + 40 }} aria-hidden />
                  ))
                ) : (
                  <div className={cx("absolute inset-x-0", look.marking)} style={look.markingStyle} aria-hidden />
                )}
              </div>
              {stores.map((st, i) => (
                <Facade
                  key={st.id}
                  st={st}
                  top={i % 2 === 0}
                  left={storeX(i) - STORE_W / 2}
                  near={nearIdx === i}
                  visited={entered.has(st.id)}
                  lang={lang}
                  fallback={fallback}
                  mediaUrls={mediaUrls}
                  log={log}
                  ctx={ctx(i)}
                  food={food}
                  label={tr("goToStore", { store: lt(st.s.name, lang, fallback) })}
                  onClick={() => walkTo(i)}
                />
              ))}
            </div>
            {/* Avatar */}
            <div
              className="pointer-events-none absolute top-[50%] z-10 -translate-x-1/2 -translate-y-1/2 transition-none"
              style={{ left: x - offset }}
              aria-hidden
            >
              <svg width="34" height="52" viewBox="0 0 34 52">
                <circle cx="17" cy="9" r="8" fill="#1c2430" />
                <rect x="8" y="18" width="18" height="20" rx="7" fill="#0f6e6e" />
                <rect x="9" y="36" width="6" height="14" rx="3" fill="#1c2430" />
                <rect x="19" y="36" width="6" height="14" rx="3" fill="#1c2430" />
              </svg>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2" dir="ltr">
            <HoldButton label={tr("walkLeft")} onHold={(on) => ((dir.current = on ? -1 : 0), (target.current = null))}>
              ◀
            </HoldButton>
            <HoldButton label={tr("walkRight")} onHold={(on) => ((dir.current = on ? 1 : 0), (target.current = null))}>
              ▶
            </HoldButton>
            {nearIdx >= 0 && (
              <Button onClick={() => enter(nearIdx)} className="py-2.5" dir="auto">
                {tr("enterStore", { store: lt(stores[nearIdx].s.name, lang, fallback) })}
              </Button>
            )}
            <span className="flex-1" />
            <label className="flex items-center gap-2 text-sm" dir="auto">
              <span>{tr("goTo")}</span>
              <select
                className="rounded-lg border border-line bg-surface px-2 py-1.5"
                value=""
                onChange={(e) => e.target.value !== "" && walkTo(Number(e.target.value), false)}
              >
                <option value="">{tr("chooseStore")}</option>
                {stores.map((st, i) => (
                  <option key={st.id} value={i}>
                    {lt(st.s.name, lang, fallback)}
                    {entered.has(st.id) ? ` ✓` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-muted">{tr("villageHelp")}</p>
        </>
      ) : (
        storeInterior
      )}

      {detail && inside !== null && (
        <Dialog onClose={() => setDetail(null)} title={lt(detail.name, lang, fallback)} closeLabel={tr("close")}>
          <ProductDetail product={detail} st={stores[inside]} lang={lang} fallback={fallback} mediaUrls={mediaUrls} currency={block.currency} tr={tr} onAdd={(q) => (add(stores[inside], detail, q), setDetail(null))} />
        </Dialog>
      )}

      {asking !== null && (
        <Dialog onClose={() => undefined} title={t(block.considerationPrompt)} closeLabel={null}>
          <div className="flex gap-3">
            {([1, 0] as const).map((v) => (
              <Button
                key={v}
                variant={v ? "primary" : "secondary"}
                className="flex-1 py-3"
                onClick={() => {
                  const i = asking;
                  setConsideration((c) => ({ ...c, [stores[i].id]: v }));
                  log("consideration", { ...ctx(i), value: v });
                  setAsking(null);
                  exitStore(i);
                }}
              >
                {v ? tr("yes") : tr("no")}
              </Button>
            ))}
          </div>
        </Dialog>
      )}

      {showBag && (
        <Dialog onClose={() => setShowBag(false)} title={tr("bag")} closeLabel={tr("close")}>
          {basket.length === 0 ? (
            <p className="text-sm text-muted">{tr("bagEmpty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {basket.map((l) => {
                const p = lib.products[l.product];
                const st = stores.find((s) => s.id === l.store);
                return (
                  <li key={`${l.store}:${l.product}`} className="flex items-center gap-3 py-2 text-sm">
                    <span className="flex-1">
                      <span className="font-medium">{p ? lt(p.name, lang, fallback) : ""}</span>
                      <span className="block text-xs text-muted">
                        {st ? lt(st.s.name, lang, fallback) : ""} · ×{l.qty}
                      </span>
                    </span>
                    <span className="tabular-nums">{money(lineValue(l))}</span>
                    <Button variant="ghost" size="sm" onClick={() => remove(l)}>
                      {tr("remove")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 flex justify-between border-t border-line pt-3 font-semibold">
            <span>{tr("total")}</span>
            <span className="tabular-nums">{money(total)}</span>
          </p>
        </Dialog>
      )}
    </section>
  );
}

function HoldButton({ label, onHold, children }: { label: string; onHold: (on: boolean) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onKeyDown={(e) => (e.key === " " || e.key === "Enter") && onHold(true)}
      onKeyUp={() => onHold(false)}
      onBlur={() => onHold(false)}
      className="flex h-12 w-14 touch-none items-center justify-center rounded-xl border border-line bg-surface text-lg shadow-sm active:bg-accent-soft"
    >
      {children}
    </button>
  );
}

function Facade({
  st,
  top,
  left,
  near,
  visited,
  lang,
  fallback,
  mediaUrls,
  log,
  ctx,
  food,
  label,
  onClick,
}: {
  st: StoreView;
  top: boolean;
  left: number;
  near: boolean;
  visited: boolean;
  lang: Language;
  fallback: Language;
  mediaUrls: Record<string, string>;
  log: Log;
  ctx: EventData;
  food: boolean;
  label: string;
  onClick: () => void;
}) {
  const sign = lt(st.s.facade.signText, lang, fallback) || lt(st.s.name, lang, fallback);
  const img = st.s.facade.image ? mediaUrls[st.s.facade.image.storagePath] : undefined;
  return (
    <div className={cx("absolute flex flex-col items-center", top ? "top-[3%] h-[36%]" : "bottom-[3%] h-[36%] flex-col-reverse")} style={{ left, width: STORE_W }}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cx(
          "relative flex h-full w-full flex-col overflow-hidden rounded-lg border-2 bg-white text-start shadow-sm transition-shadow",
          near ? "border-accent shadow-lg" : "border-transparent",
        )}
      >
        <span className="h-[18%] w-full" style={{ background: `repeating-linear-gradient(90deg, ${st.color} 0 16px, #ffffff 16px 32px)` }} aria-hidden />
        <span className="flex h-[26%] items-center justify-center px-2 text-center text-sm font-bold text-white" style={{ background: st.color }} dir="auto">
          <span className="line-clamp-2">{sign}</span>
        </span>
        <span className="relative flex flex-1 items-end justify-center gap-2 bg-[#fbfbfa] px-2 pb-1">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <>
              <span className="h-[70%] w-[38%] rounded-t-md border-2 border-[#9aa4ae] bg-[#dbe7ee]" aria-hidden />
              <span className="h-[85%] w-[26%] rounded-t-md" style={{ background: food ? "#8b5e34" : "#4b5563" }} aria-hidden />
            </>
          )}
        </span>
        {st.offer && st.offer.kind !== "none" && <OfferBadge offer={st.offer} lang={lang} fallback={fallback} className="absolute end-1 top-1" />}
        {visited && (
          <span className="absolute start-1 top-1 rounded-full bg-white/90 px-1.5 text-xs" aria-hidden>
            ✓
          </span>
        )}
      </button>
      {st.facadeAd && (
        <div className="pointer-events-none absolute" style={{ right: -92, width: 84, top: "18%" }}>
          <AdCreative
            shown={st.facadeAd}
            url={st.facadeAd.media ? mediaUrls[st.facadeAd.media.storagePath] : undefined}
            lang={lang}
            fallback={fallback}
            log={log}
            context={{ ...ctx, placement: "facade" }}
            compact
            className="shadow"
          />
        </div>
      )}
    </div>
  );
}

function StoreInterior({
  st,
  lang,
  fallback,
  mediaUrls,
  currency,
  tr,
  log,
  ctx,
  onLeave,
  onAdd,
  onDetail,
}: {
  st: StoreView;
  lang: Language;
  fallback: Language;
  mediaUrls: Record<string, string>;
  currency: string;
  tr: Tr;
  log: Log;
  ctx: EventData;
  onLeave: () => void;
  onAdd: (p: LibProduct, qty: number) => void;
  onDetail: (p: LibProduct) => void;
}) {
  // product_view: a product card was at least half visible, once per visit.
  const seen = useRef(new Set<string>());
  const observer = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    observer.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.product;
          if (id && e.isIntersecting && !seen.current.has(id)) {
            seen.current.add(id);
            const p = st.products.find((x) => x.id === id);
            log("product_view", { ...ctx, product: id, productCode: p?.code ?? null });
          }
        }
      },
      { threshold: 0.5 },
    );
    return () => observer.current?.disconnect();
    // One observer per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.id]);
  const observe = (el: HTMLElement | null) => {
    if (el && observer.current) observer.current.observe(el);
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-3 sm:p-4">
      <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-white" style={{ background: st.color }}>
        <h2 className="flex-1 text-lg font-bold" dir="auto">
          {lt(st.s.name, lang, fallback)}
        </h2>
        <OfferBadge offer={st.offer} lang={lang} fallback={fallback} />
        <Button variant="secondary" size="sm" onClick={onLeave}>
          {tr("leaveStore")}
        </Button>
      </div>
      {st.inStoreAds.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {st.inStoreAds.map((ad) => (
            <AdCreative key={ad.ad.id} shown={ad} url={ad.media ? mediaUrls[ad.media.storagePath] : undefined} lang={lang} fallback={fallback} log={log} context={{ ...ctx, placement: "in_store" }} compact />
          ))}
        </div>
      )}
      {st.products.length === 0 ? (
        <p className="text-sm text-muted">{tr("noProducts")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {st.products.map((p) => {
            const img = p.images[0] ? mediaUrls[p.images[0].storagePath] : undefined;
            return (
              <li key={p.id} ref={observe} data-product={p.id} className="flex flex-col overflow-hidden rounded-lg border border-line bg-white">
                <button type="button" onClick={() => onDetail(p)} className="aspect-square w-full overflow-hidden bg-paper" aria-label={tr("details", { item: lt(p.name, lang, fallback) })}>
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={lt(p.images[0].alt, lang, fallback) || lt(p.name, lang, fallback)} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <ProductIcon color={st.color} />
                  )}
                </button>
                <div className="flex flex-1 flex-col gap-1 p-2 text-sm">
                  <span className="font-medium" dir="auto">
                    {lt(p.name, lang, fallback)}
                  </span>
                  <Price product={p} offer={st.offer} currency={currency} lang={lang} each={(price) => tr("effectiveEach", { price })} />
                  <Button size="sm" className="mt-auto" onClick={() => onAdd(p, 1)}>
                    {tr("addToBag")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ProductDetail({
  product,
  st,
  lang,
  fallback,
  mediaUrls,
  currency,
  tr,
  onAdd,
}: {
  product: LibProduct;
  st: StoreView;
  lang: Language;
  fallback: Language;
  mediaUrls: Record<string, string>;
  currency: string;
  tr: Tr;
  onAdd: (qty: number) => void;
}) {
  const [qty, setQty] = useState(1);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 overflow-x-auto">
        {product.images.length === 0 ? (
          <span className="h-40 w-40 overflow-hidden rounded-lg">
            <ProductIcon color={st.color} />
          </span>
        ) : (
          product.images.map((m) =>
            mediaUrls[m.storagePath] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.assetId} src={mediaUrls[m.storagePath]} alt={lt(m.alt, lang, fallback)} className="h-40 rounded-lg object-cover" />
            ) : null,
          )
        )}
      </div>
      {lt(product.description, lang, fallback) && <p className="prose-study text-sm">{lt(product.description, lang, fallback)}</p>}
      {product.attributes.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          {product.attributes.map((a, i) => (
            <div key={i} className="contents">
              <dt className="text-muted">{lt(a.name, lang, fallback)}</dt>
              <dd>{lt(a.value, lang, fallback)}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex items-center gap-3">
        <Price product={product} offer={st.offer} currency={currency} lang={lang} each={(price) => tr("effectiveEach", { price })} />
        <OfferBadge offer={st.offer} lang={lang} fallback={fallback} />
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          {tr("quantity")}
          <select value={qty} onChange={(e) => setQty(Number(e.target.value))} className="rounded-lg border border-line px-2 py-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <span className="text-sm text-muted">{formatPrice(lineTotal(product.basePrice, st.offer, qty), product.currency || currency, lang)}</span>
        <Button className="ms-auto" onClick={() => onAdd(qty)}>
          {tr("addToBag")}
        </Button>
      </div>
    </div>
  );
}

function Dialog({ title, onClose, closeLabel, children }: { title: string; onClose: () => void; closeLabel: string | null; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button, select")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeLabel && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, closeLabel]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[85vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-t-2xl bg-surface p-4 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold" dir="auto">
            {title}
          </h3>
          {closeLabel && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              {closeLabel}
            </Button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
