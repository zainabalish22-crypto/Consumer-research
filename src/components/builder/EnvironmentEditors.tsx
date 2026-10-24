"use client";
/** Editors for the advertising and shopping-environment blocks (Phase 3). */
import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { AdRules, Block, FeedPost, ItemOrder, Language, LocalizedText, OfferRule, StudyConfig } from "@/lib/study/schema";
import { shortId } from "@/lib/study/factories";
import { lt } from "@/lib/study/text";
import { IdList } from "@/components/IdList";
import { Button, Select } from "@/components/ui";
import { LocalizedField } from "./LocalizedField";
import { Checkbox, NumberField, TextField } from "./controls";
import { useLibrary } from "./LibraryContext";
import { MediaPicker } from "./MediaPicker";

type P<T extends Block["type"]> = {
  block: Extract<Block, { type: T }>;
  config: StudyConfig;
  languages: Language[];
  onChange: (b: Extract<Block, { type: T }>) => void;
};

function useIdListLabels() {
  const t = useTranslations("builder.env");
  return { none: t("noneYet"), missing: t("missing"), moveUp: t("moveUp"), remove: t("remove"), choose: t("choose"), add: t("add") };
}

function useOptions(kind: "stores" | "ads") {
  const lib = useLibrary();
  const locale = useLocale() as Language;
  return Object.values(lib[kind]).map((x) => ({ id: x.id, label: `${x.code} · ${lt(x.name, locale, locale === "ar" ? "en" : "ar")}` }));
}

function LibraryLink() {
  const t = useTranslations("builder.env");
  return (
    <p className="text-xs text-muted">
      {t("libraryHint")}{" "}
      <Link href="/studio/library" target="_blank" className="text-accent underline">
        {t("openLibrary")}
      </Link>
    </p>
  );
}

function ItemOrderEditor({ order, config, onChange, label }: { order: ItemOrder; config: StudyConfig; onChange: (o: ItemOrder) => void; label: string }) {
  const t = useTranslations("builder.env");
  const orderFactors = config.design.factors.filter((f) => f.kind === "order");
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor={`ord-${label}`}>
          {label}
        </label>
        <Select id={`ord-${label}`} value={order.mode} onChange={(e) => onChange({ mode: e.target.value as ItemOrder["mode"], factorId: order.factorId })}>
          <option value="listed">{t("order.listed")}</option>
          <option value="random">{t("order.random")}</option>
          <option value="factor">{t("order.factor")}</option>
        </Select>
      </div>
      {order.mode === "factor" && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={`ordf-${label}`}>
            {t("orderFactor")}
          </label>
          <Select id={`ordf-${label}`} value={order.factorId ?? ""} onChange={(e) => onChange({ mode: "factor", factorId: e.target.value || undefined })}>
            <option value="">{t("choose")}</option>
            {orderFactors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name || f.variable}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted">{t("orderFactorHint")}</p>
        </div>
      )}
    </div>
  );
}

function OfferRuleEditor({ rule, stores, config, onChange }: { rule: OfferRule; stores: string[]; config: StudyConfig; onChange: (r: OfferRule) => void }) {
  const t = useTranslations("builder.env");
  const lib = useLibrary();
  const locale = useLocale() as Language;
  const mappings = config.design.factors.filter((f) => f.kind === "mapping");
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-line p-3">
      <legend className="px-1 text-sm font-medium">{t("offers")}</legend>
      <Select
        aria-label={t("offers")}
        value={rule.mode}
        onChange={(e) => {
          const mode = e.target.value as OfferRule["mode"];
          onChange(mode === "none" ? { mode } : mode === "fixed" ? { mode, byStore: {} } : { mode, factorId: mappings[0]?.id ?? "" });
        }}
      >
        <option value="none">{t("offerModes.none")}</option>
        <option value="fixed">{t("offerModes.fixed")}</option>
        <option value="factor">{t("offerModes.factor")}</option>
      </Select>
      {rule.mode === "fixed" &&
        stores.map((sid) => (
          <label key={sid} className="flex items-center gap-2 text-sm">
            <span className="w-40 truncate" dir="auto">
              {lib.stores[sid]
                ? `${lib.stores[sid].code} · ${lt(lib.stores[sid].name, locale, "en")}`
                : lib.products[sid]
                  ? `${lib.products[sid].code} · ${lt(lib.products[sid].name, locale, "en")}`
                  : sid}
            </span>
            <Select
              className="w-auto"
              value={rule.byStore[sid] ?? ""}
              onChange={(e) => {
                const byStore = { ...rule.byStore };
                if (e.target.value) byStore[sid] = e.target.value;
                else delete byStore[sid];
                onChange({ mode: "fixed", byStore });
              }}
            >
              <option value="">{t("noOffer")}</option>
              {Object.values(lib.offers).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.code} · {lt(o.name, locale, "en")}
                </option>
              ))}
            </Select>
          </label>
        ))}
      {rule.mode === "factor" && (
        <>
          <Select aria-label={t("offerFactor")} value={rule.factorId} onChange={(e) => onChange({ mode: "factor", factorId: e.target.value })}>
            <option value="">{t("choose")}</option>
            {mappings.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name || f.variable}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted">{t("offerFactorHint")}</p>
        </>
      )}
    </fieldset>
  );
}

function AdRulesEditor({ rules, config, onChange }: { rules: AdRules; config: StudyConfig; onChange: (r: AdRules) => void }) {
  const t = useTranslations("builder.env");
  const picks = config.design.factors.filter((f) => f.kind === "pick");
  const v = rules.version;
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-3">
      <legend className="px-1 text-sm font-medium">{t("adRules")}</legend>
      <Select
        aria-label={t("versionMode")}
        value={v.mode}
        onChange={(e) =>
          onChange({
            ...rules,
            version: e.target.value === "fixed" ? { mode: "fixed", key: "authentic" } : { mode: "targeted", factorId: picks[0]?.id ?? "", targetKey: "ai", otherKey: "authentic" },
          })
        }
      >
        <option value="fixed">{t("versionModes.fixed")}</option>
        <option value="targeted">{t("versionModes.targeted")}</option>
      </Select>
      {v.mode === "fixed" && (
        <TextField label={t("versionKey")} value={v.key} dir="ltr" mono onChange={(x) => onChange({ ...rules, version: { mode: "fixed", key: x.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20) } })} />
      )}
      {v.mode === "targeted" && (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="tgt-factor">
              {t("targetFactor")}
            </label>
            <Select id="tgt-factor" value={v.factorId} onChange={(e) => onChange({ ...rules, version: { ...v, factorId: e.target.value } })}>
              <option value="">{t("choose")}</option>
              {picks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name || f.variable}
                </option>
              ))}
            </Select>
          </div>
          <TextField label={t("targetKey")} value={v.targetKey} dir="ltr" mono onChange={(x) => onChange({ ...rules, version: { ...v, targetKey: x.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20) } })} />
          <TextField label={t("otherKey")} value={v.otherKey} dir="ltr" mono onChange={(x) => onChange({ ...rules, version: { ...v, otherKey: x.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20) } })} />
          <p className="text-xs text-muted sm:col-span-3">{t("targetedHint")}</p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="disc-show">
          {t("disclosure")}
        </label>
        <Select id="disc-show" value={rules.disclosure.showFor} onChange={(e) => onChange({ ...rules, disclosure: { ...rules.disclosure, showFor: e.target.value as AdRules["disclosure"]["showFor"] } })}>
          <option value="none">{t("disclosureFor.none")}</option>
          <option value="targeted">{t("disclosureFor.targeted")}</option>
          <option value="all">{t("disclosureFor.all")}</option>
        </Select>
        {rules.disclosure.showFor !== "none" && config.design.conditions.length > 1 && (
          <div className="flex flex-wrap gap-3">
            {config.design.conditions.map((c) => (
              <Checkbox
                key={c.id}
                label={c.label || c.id}
                checked={rules.disclosure.conditions.includes(c.id)}
                onChange={(on) =>
                  onChange({
                    ...rules,
                    disclosure: {
                      ...rules.disclosure,
                      conditions: on ? [...rules.disclosure.conditions, c.id] : rules.disclosure.conditions.filter((x) => x !== c.id),
                    },
                  })
                }
              />
            ))}
          </div>
        )}
        <p className="text-xs text-muted">{t("disclosureHint")}</p>
      </div>
    </fieldset>
  );
}

export function AdExposureEditor({ block, config, languages, onChange }: P<"ad_exposure">) {
  const t = useTranslations("builder.env");
  const labels = useIdListLabels();
  const ads = useOptions("ads");
  return (
    <>
      <LibraryLink />
      <LocalizedField label={t("heading")} value={block.heading} languages={languages} onChange={(v) => onChange({ ...block, heading: v })} />
      <LocalizedField label={t("intro")} value={block.intro} languages={languages} multiline onChange={(v) => onChange({ ...block, intro: v })} />
      <IdList label={t("ads")} ids={block.ads} options={ads} labels={labels} onChange={(v) => onChange({ ...block, ads: v })} />
      <ItemOrderEditor label={t("adOrder")} order={block.order} config={config} onChange={(o) => onChange({ ...block, order: o })} />
      <AdRulesEditor rules={block.rules} config={config} onChange={(r) => onChange({ ...block, rules: r })} />
      <NumberField label={t("minViewSeconds")} value={block.minViewSeconds} min={0} max={3600} onChange={(v) => onChange({ ...block, minViewSeconds: v ?? 0 })} />
      <Checkbox label={t("requireEnd")} checked={block.requireEnd} onChange={(v) => onChange({ ...block, requireEnd: v })} />
      <Checkbox label={t("autoplay")} checked={block.autoplay} onChange={(v) => onChange({ ...block, autoplay: v })} />
      <Checkbox label={t("showControls")} checked={block.showControls} onChange={(v) => onChange({ ...block, showControls: v })} />
    </>
  );
}

function StoreSetFields({
  block,
  config,
  onChange,
}: {
  block: Extract<Block, { type: "village" | "store_choice" }>;
  config: StudyConfig;
  onChange: (patch: Partial<Extract<Block, { type: "village" | "store_choice" }>>) => void;
}) {
  const t = useTranslations("builder.env");
  const labels = useIdListLabels();
  const stores = useOptions("stores");
  return (
    <>
      <LibraryLink />
      <TextField
        label={t("variablePrefix")}
        hint={t("variablePrefixHint", { prefix: block.variable })}
        value={block.variable}
        dir="ltr"
        mono
        onChange={(v) => onChange({ variable: v.replace(/[^A-Za-z0-9_]/g, "").slice(0, 30) })}
      />
      <IdList label={t("stores")} hint={t("storesHint")} ids={block.stores} options={stores} labels={labels} onChange={(v) => onChange({ stores: v })} />
      <ItemOrderEditor label={t("storeOrder")} order={block.storeOrder} config={config} onChange={(o) => onChange({ storeOrder: o })} />
      <OfferRuleEditor rule={block.offers} stores={block.stores} config={config} onChange={(r) => onChange({ offers: r })} />
      <TextField label={t("currency")} value={block.currency} dir="ltr" mono onChange={(v) => onChange({ currency: v.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) })} />
    </>
  );
}

export function StoreChoiceEditor({ block, config, languages, onChange }: P<"store_choice">) {
  const t = useTranslations("builder.env");
  return (
    <>
      <LocalizedField label={t("heading")} value={block.heading} languages={languages} onChange={(v) => onChange({ ...block, heading: v })} />
      <LocalizedField label={t("prompt")} value={block.prompt} languages={languages} multiline onChange={(v) => onChange({ ...block, prompt: v })} />
      <StoreSetFields block={block} config={config} onChange={(p) => onChange({ ...block, ...p } as typeof block)} />
      <Checkbox label={t("showProducts")} checked={block.showProducts} onChange={(v) => onChange({ ...block, showProducts: v })} />
      <Checkbox label={t("allowNone")} checked={block.allowNone} onChange={(v) => onChange({ ...block, allowNone: v })} />
      {block.allowNone && <LocalizedField label={t("noneLabel")} value={block.noneLabel} languages={languages} onChange={(v) => onChange({ ...block, noneLabel: v })} />}
    </>
  );
}

function useProductOptions() {
  const lib = useLibrary();
  const locale = useLocale() as Language;
  return Object.values(lib.products).map((p) => ({ id: p.id, label: `${p.code} · ${lt(p.name, locale, locale === "ar" ? "en" : "ar")} · ${p.basePrice} ${p.currency}` }));
}

export function OnlineShopEditor({ block, config, languages, onChange }: P<"online_shop">) {
  const t = useTranslations("builder.env");
  const labels = useIdListLabels();
  const products = useProductOptions();
  const ads = useOptions("ads");
  const set = (p: Partial<typeof block>) => onChange({ ...block, ...p });
  const pl = block.placements;
  const setPl = (p: Partial<typeof pl>) => set({ placements: { ...pl, ...p } });
  return (
    <>
      <LibraryLink />
      <LocalizedField label={t("heading")} value={block.heading} languages={languages} onChange={(v) => set({ heading: v })} />
      <LocalizedField label={t("instructions")} value={block.instructions} languages={languages} multiline onChange={(v) => set({ instructions: v })} />
      <LocalizedField label={t("shopName")} value={block.shopName} languages={languages} onChange={(v) => set({ shopName: v })} />
      <TextField
        label={t("variablePrefix")}
        hint={t("shopPrefixHint", { prefix: block.variable })}
        value={block.variable}
        dir="ltr"
        mono
        onChange={(v) => set({ variable: v.replace(/[^A-Za-z0-9_]/g, "").slice(0, 30) })}
      />
      <IdList label={t("products")} hint={t("productsHint")} ids={block.products} options={products} labels={labels} onChange={(v) => set({ products: v })} />
      <ItemOrderEditor label={t("shopProductOrder")} order={block.productOrder} config={config} onChange={(o) => set({ productOrder: o })} />
      <OfferRuleEditor rule={block.offers} stores={block.products} config={config} onChange={(r) => set({ offers: r })} />
      <TextField label={t("currency")} value={block.currency} dir="ltr" mono onChange={(v) => set({ currency: v.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) })} />
      <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-3">
        <legend className="px-1 text-sm font-medium">{t("placements")}</legend>
        <IdList label={t("bannerAds")} ids={pl.banner} options={ads} labels={labels} onChange={(v) => setPl({ banner: v })} />
        <IdList label={t("sidebarAds")} ids={pl.sidebar} options={ads} labels={labels} onChange={(v) => setPl({ sidebar: v })} />
        <IdList label={t("sponsored")} hint={t("sponsoredHint")} ids={pl.sponsored} options={products.filter((p) => block.products.includes(p.id))} labels={labels} onChange={(v) => setPl({ sponsored: v })} />
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor={`popup-${block.id}`}>
              {t("popupAd")}
            </label>
            <Select id={`popup-${block.id}`} value={pl.popup ?? ""} onChange={(e) => setPl({ popup: e.target.value || null })}>
              <option value="">{t("noPopup")}</option>
              {ads.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </div>
          {pl.popup && <NumberField label={t("popupDelay")} value={pl.popupDelaySec} min={0} max={600} onChange={(v) => setPl({ popupDelaySec: v ?? 5 })} />}
        </div>
      </fieldset>
      <AdRulesEditor rules={block.ads} config={config} onChange={(r) => set({ ads: r })} />
      <div className="flex flex-wrap gap-4">
        <Checkbox label={t("showSearch")} checked={block.showSearch} onChange={(v) => set({ showSearch: v })} />
        <Checkbox label={t("showFilters")} checked={block.showFilters} onChange={(v) => set({ showFilters: v })} />
        <Checkbox label={t("showSort")} checked={block.showSort} onChange={(v) => set({ showSort: v })} />
        <Checkbox label={t("showRatings")} checked={block.showRatings} onChange={(v) => set({ showRatings: v })} />
      </div>
      <fieldset className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-3">
        <legend className="px-1 text-sm font-medium">{t("rules")}</legend>
        <NumberField label={t("minPurchases")} value={block.minItems} min={0} max={50} onChange={(v) => set({ minItems: v ?? 0 })} />
        <NumberField label={t("maxPurchases")} value={block.maxItems} min={1} max={100} onChange={(v) => set({ maxItems: v ?? 20 })} />
        <NumberField label={t("budget")} value={block.budget} optional min={0} step={0.001} onChange={(v) => set({ budget: v })} />
        <NumberField label={t("timeLimit")} value={block.timeLimitSec} optional min={10} max={7200} onChange={(v) => set({ timeLimitSec: v })} />
      </fieldset>
      <Checkbox label={t("requireCheckout")} hint={t("requireCheckoutHint")} checked={block.requireCheckout} onChange={(v) => set({ requireCheckout: v })} />
    </>
  );
}

export function VillageEditor({ block, config, languages, onChange }: P<"village">) {
  const t = useTranslations("builder.env");
  const set = (p: Partial<typeof block>) => onChange({ ...block, ...p });
  return (
    <>
      <LocalizedField label={t("heading")} value={block.heading} languages={languages} onChange={(v) => set({ heading: v })} />
      <LocalizedField label={t("instructions")} value={block.instructions} languages={languages} multiline onChange={(v) => set({ instructions: v })} />
      <StoreSetFields block={block} config={config} onChange={(p) => set(p as Partial<typeof block>)} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="v-layout">
            {t("layout")}
          </label>
          <Select id="v-layout" value={block.layout} onChange={(e) => set({ layout: e.target.value as typeof block.layout })}>
            <option value="street">{t("layouts.street")}</option>
            <option value="foodcourt">{t("layouts.foodcourt")}</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="v-theme">
            {t("theme")}
          </label>
          <Select id="v-theme" value={block.theme} onChange={(e) => set({ theme: e.target.value as typeof block.theme })}>
            <option value="minimal">{t("themes.minimal")}</option>
            <option value="neutral">{t("themes.neutral")}</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="v-porder">
            {t("productOrder")}
          </label>
          <Select id="v-porder" value={block.productOrder} onChange={(e) => set({ productOrder: e.target.value as typeof block.productOrder })}>
            <option value="listed">{t("order.listed")}</option>
            <option value="random">{t("order.random")}</option>
          </Select>
        </div>
      </div>
      <AdRulesEditor rules={block.ads} config={config} onChange={(r) => set({ ads: r })} />
      <fieldset className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-3">
        <legend className="px-1 text-sm font-medium">{t("rules")}</legend>
        <NumberField label={t("approachDistance")} value={block.approachDistance} min={40} max={400} onChange={(v) => set({ approachDistance: v ?? 120 })} />
        <NumberField label={t("approachSeconds")} value={block.approachSeconds} min={0} max={10} step={0.5} onChange={(v) => set({ approachSeconds: v ?? 1 })} />
        <NumberField label={t("mustEnterStores")} value={block.mustEnterStores} min={0} max={60} onChange={(v) => set({ mustEnterStores: v ?? 0 })} />
        <NumberField label={t("minPurchases")} value={block.minPurchases} min={0} max={50} onChange={(v) => set({ minPurchases: v ?? 0 })} />
        <NumberField label={t("maxPurchases")} value={block.maxPurchases} min={1} max={100} onChange={(v) => set({ maxPurchases: v ?? 10 })} />
        <NumberField label={t("budget")} value={block.budget} optional min={0} step={0.001} onChange={(v) => set({ budget: v })} />
        <NumberField label={t("timeLimit")} value={block.timeLimitSec} optional min={10} max={7200} onChange={(v) => set({ timeLimitSec: v })} />
      </fieldset>
      <LocalizedField
        label={t("considerationPrompt")}
        hint={t("considerationHint")}
        value={block.considerationPrompt}
        languages={languages}
        onChange={(v: LocalizedText) => set({ considerationPrompt: v.en?.trim() || v.ar?.trim() ? v : undefined })}
      />
    </>
  );
}

export function SocialFeedEditor({ block, config, languages, onChange }: P<"social_feed">) {
  const t = useTranslations("builder.env");
  const ads = useOptions("ads");
  const [picking, setPicking] = useState<number | null>(null);
  const setPost = (i: number, patch: Partial<FeedPost>) => onChange({ ...block, posts: block.posts.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const move = (i: number, d: number) => {
    const posts = [...block.posts];
    const [p] = posts.splice(i, 1);
    posts.splice(i + d, 0, p);
    onChange({ ...block, posts });
  };
  const add = (kind: FeedPost["kind"]) =>
    onChange({ ...block, posts: [...block.posts, { id: shortId("p"), kind, author: { en: "", ar: "" }, text: { en: "", ar: "" }, ...(kind === "post" ? { likes: 0 } : {}) }] });
  return (
    <>
      <LibraryLink />
      <TextField
        label={t("variablePrefix")}
        hint={t("feedPrefixHint", { prefix: block.variable })}
        value={block.variable}
        dir="ltr"
        mono
        onChange={(v) => onChange({ ...block, variable: v.replace(/[^A-Za-z0-9_]/g, "").slice(0, 30) })}
      />
      <LocalizedField label={t("heading")} value={block.heading} languages={languages} onChange={(v) => onChange({ ...block, heading: v })} />
      <LocalizedField label={t("intro")} value={block.intro} languages={languages} multiline onChange={(v) => onChange({ ...block, intro: v })} />
      <LocalizedField label={t("platformName")} value={block.platformName} languages={languages} onChange={(v) => onChange({ ...block, platformName: v ?? { en: "", ar: "" } })} />

      <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-3">
        <legend className="px-1 text-sm font-medium">{t("feedPosts")}</legend>
        <p className="text-xs text-muted">{t("feedPostsHint")}</p>
        {block.posts.map((p, i) => (
          <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-line bg-paper/50 p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {i + 1}. {p.kind === "ad" ? t("sponsoredPost") : t("organicPost")}
              </span>
              <span className="font-mono text-xs text-muted" dir="ltr">
                {p.id}
              </span>
              <span className="flex-1" />
              <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("moveUp")}>
                ↑
              </Button>
              <Button variant="ghost" size="sm" disabled={i === block.posts.length - 1} onClick={() => move(i, 1)} aria-label={t("moveDown")}>
                ↓
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={block.posts.length === 1}
                onClick={() => onChange({ ...block, posts: block.posts.filter((_, j) => j !== i) })}
                aria-label={t("removePost")}
              >
                ✕
              </Button>
            </div>
            {p.kind === "ad" && (
              <Select aria-label={t("chooseAd")} value={p.adId ?? ""} onChange={(e) => setPost(i, { adId: e.target.value || undefined })}>
                <option value="">{t("chooseAd")}</option>
                {ads.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
            <LocalizedField
              label={p.kind === "ad" ? t("postAuthorAd") : t("postAuthor")}
              value={p.author}
              languages={languages}
              onChange={(v) => setPost(i, { author: v ?? { en: "", ar: "" } })}
            />
            <LocalizedField label={t("postText")} value={p.text} languages={languages} multiline onChange={(v) => setPost(i, { text: v ?? { en: "", ar: "" } })} />
            {p.kind === "post" && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {p.media ? (
                  <>
                    <span className="truncate text-muted" dir="ltr">
                      {p.media.storagePath.split("/").pop()?.replace(/^[0-9a-f-]{36}-/, "")}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setPost(i, { media: undefined })}>
                      {t("removeMedia")}
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => setPicking(i)}>
                    {t("addPostMedia")}
                  </Button>
                )}
              </div>
            )}
            {block.showCounts && (
              <NumberField label={t("postLikes")} value={p.likes ?? 0} min={0} max={10_000_000} onChange={(v) => setPost(i, { likes: v ?? 0 })} />
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={block.posts.length >= 60} onClick={() => add("post")}>
            {t("addOrganicPost")}
          </Button>
          <Button variant="secondary" size="sm" disabled={block.posts.length >= 60} onClick={() => add("ad")}>
            {t("addSponsoredPost")}
          </Button>
        </div>
      </fieldset>
      {picking !== null && (
        <MediaPicker
          kinds={["image", "video"]}
          onClose={() => setPicking(null)}
          onPick={(ref) => {
            setPost(picking, { media: ref });
            setPicking(null);
          }}
        />
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("postOrder")}</span>
        <Select value={block.postOrder.mode === "random" ? "random" : "listed"} onChange={(e) => onChange({ ...block, postOrder: { mode: e.target.value as "listed" | "random" } })}>
          <option value="listed">{t("order.listed")}</option>
          <option value="random">{t("order.random")}</option>
        </Select>
      </label>
      <AdRulesEditor rules={block.ads} config={config} onChange={(r) => onChange({ ...block, ads: r })} />
      <Checkbox label={t("feedLike")} checked={block.actions.like} onChange={(v) => onChange({ ...block, actions: { ...block.actions, like: v } })} />
      <Checkbox label={t("feedSave")} checked={block.actions.save} onChange={(v) => onChange({ ...block, actions: { ...block.actions, save: v } })} />
      <Checkbox label={t("feedHide")} checked={block.actions.hide} onChange={(v) => onChange({ ...block, actions: { ...block.actions, hide: v } })} />
      <Checkbox label={t("showCounts")} hint={t("showCountsHint")} checked={block.showCounts} onChange={(v) => onChange({ ...block, showCounts: v })} />
      <NumberField label={t("minSeconds")} value={block.minSeconds} min={0} max={3600} onChange={(v) => onChange({ ...block, minSeconds: v ?? 0 })} />
    </>
  );
}
