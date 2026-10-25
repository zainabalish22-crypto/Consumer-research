"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  LIBRARY_KINDS,
  OFFER_KINDS,
  effectiveUnitPrice,
  formatPrice,
  type LibAd,
  type LibBrand,
  type LibOffer,
  type LibProduct,
  type LibStore,
  type LibraryKind,
  type LibrarySnapshot,
} from "@/lib/study/library";
import type { Language, LocalizedText, MediaRef } from "@/lib/study/schema";
import { lt } from "@/lib/study/text";
import { deleteLibraryItem, saveLibraryItem } from "@/lib/actions/library";
import type { LibraryMeta } from "@/lib/library/load";
import { Alert, Button, Card, EmptyState, Select, cx } from "@/components/ui";
import { LocalizedField } from "@/components/builder/LocalizedField";
import { Checkbox, IconButton, NumberField, TextField } from "@/components/builder/controls";
import { MediaPicker } from "@/components/builder/MediaPicker";
import { IdList } from "@/components/IdList";

const LANGS: Language[] = ["en", "ar"];
const KEY: Record<LibraryKind, keyof LibrarySnapshot> = { brand: "brands", store: "stores", product: "products", offer: "offers", ad: "ads" };

type AnyItem = LibBrand | LibStore | LibProduct | LibOffer | LibAd;

function blank(kind: LibraryKind, lib: LibrarySnapshot): Record<string, unknown> {
  const used = new Set(Object.values(lib[KEY[kind]]).map((x) => (x as AnyItem).code.toLowerCase()));
  const prefix = { brand: "B", store: "S", product: "P", offer: "O", ad: "AD" }[kind];
  let i = 1;
  while (used.has(`${prefix}${i}`.toLowerCase())) i++;
  const code = `${prefix}${i}`;
  switch (kind) {
    case "brand":
      return { code, name: {}, logo: null, colors: { primary: "#0f6e6e", secondary: "#f4efe6" }, fictional: true };
    case "product":
      return {
        code,
        brandId: null,
        name: {},
        description: {},
        images: [],
        basePrice: 2,
        originalPrice: null,
        currency: "BHD",
        category: "",
        attributes: [],
        rating: null,
        ratingCount: null,
        reviews: [],
      };
    case "offer":
      return { code, name: {}, kind: "percentage", params: { percent: 50 }, displayText: { en: "50% off", ar: "خصم 50٪" } };
    case "store":
      return { code, brandId: null, name: {}, facade: { signText: {}, style: "shop", image: null }, facadeAdId: null, productIds: [], inStoreAdIds: [] };
    case "ad":
      return {
        code,
        brandId: null,
        name: {},
        versions: [
          { key: "authentic", label: "Authentic", media: null },
          { key: "ai", label: "AI-generated", media: null },
        ],
        disclosure: { text: { en: "AI-generated", ar: "مُنتج بالذكاء الاصطناعي" }, position: "top-start", style: "badge" },
      };
  }
}

export function LibraryManager({
  workspaceId,
  lib,
  meta,
  initialTab,
  thumbs = {},
}: {
  workspaceId: string;
  lib: LibrarySnapshot;
  meta: Record<string, LibraryMeta>;
  initialTab?: string;
  thumbs?: Record<string, string>;
}) {
  const t = useTranslations("library");
  const locale = useLocale() as Language;
  const [kind, setKind] = useState<LibraryKind>((LIBRARY_KINDS as string[]).includes(initialTab ?? "") ? (initialTab as LibraryKind) : "brand");
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [search, setSearch] = useState("");
  const items = useMemo(
    () =>
      (Object.values(lib[KEY[kind]]) as AnyItem[])
        .filter((x) => !search || x.code.toLowerCase().includes(search.toLowerCase()) || lt(x.name, locale, "en").toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.code.localeCompare(b.code)),
    [lib, kind, search, locale],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="flex flex-wrap gap-1.5">
          {LIBRARY_KINDS.map((k) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={kind === k}
              onClick={() => {
                setKind(k);
                setEditing(null);
              }}
              className={cx("rounded-full px-3.5 py-1.5 text-sm", kind === k ? "bg-ink text-white" : "border border-line bg-surface hover:bg-paper")}
            >
              {t(`kinds.${k}`)} <span className={kind === k ? "opacity-75" : "text-muted"}>{Object.keys(lib[KEY[k]]).length}</span>
            </button>
          ))}
        </div>
        <span className="flex-1" />
        {editing === null && (
          <div className="flex gap-2">
            <input
              aria-label={t("search")}
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              dir="auto"
            />
            <Button onClick={() => setEditing(blank(kind, lib))}>{t("new")}</Button>
          </div>
        )}
      </div>

      {editing === null && (
        items.length === 0 ? (
          <EmptyState title={t("empty")}>{t(`emptyHint.${kind}`)}</EmptyState>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4">
            {items.map((x) => (
              <li key={x.id}>
                <ItemCard item={x} kind={kind} lib={lib} thumb={thumbs[x.id]} folder={meta[x.id]?.folder} onOpen={() => setEditing(structuredClone(x) as unknown as Record<string, unknown>)} />
              </li>
            ))}
          </ul>
        )
      )}

      {editing !== null && (
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <section className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              aria-label={t("search")}
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              dir="auto"
            />
            <Button onClick={() => setEditing(blank(kind, lib))}>{t("new")}</Button>
          </div>
          {items.length === 0 ? (
            <EmptyState title={t("empty")}>{t(`emptyHint.${kind}`)}</EmptyState>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {items.map((x) => (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(structuredClone(x) as unknown as Record<string, unknown>)}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-lg border bg-surface px-3 py-2 text-start hover:border-accent/50",
                      editing?.id === x.id ? "border-accent" : "border-line",
                    )}
                  >
                    <span className="rounded bg-paper px-1.5 font-mono text-xs" dir="ltr">
                      {x.code}
                    </span>
                    <span className="flex-1 truncate text-sm" dir="auto">
                      {lt(x.name, locale, locale === "ar" ? "en" : "ar") || <span className="text-muted">{t("untitled")}</span>}
                    </span>
                    {meta[x.id]?.folder && <span className="text-xs text-muted">{meta[x.id].folder}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          {editing ? (
            <ItemEditor
              key={String(editing.id ?? "new")}
              kind={kind}
              item={editing}
              lib={lib}
              meta={editing.id ? meta[String(editing.id)] : undefined}
              workspaceId={workspaceId}
              onDone={() => setEditing(null)}
            />
          ) : (
            <Card>
              <p className="text-sm text-muted">{t(`about.${kind}`)}</p>
            </Card>
          )}
        </section>
      </div>
      )}
    </div>
  );
}

function ItemEditor({
  kind,
  item: initial,
  lib,
  meta,
  workspaceId,
  onDone,
}: {
  kind: LibraryKind;
  item: Record<string, unknown>;
  lib: LibrarySnapshot;
  meta?: LibraryMeta;
  workspaceId: string;
  onDone: () => void;
}) {
  const t = useTranslations("library");
  const te = useTranslations("errors");
  const router = useRouter();
  const [item, setItem] = useState(initial);
  const [folder, setFolder] = useState(meta?.folder ?? "");
  const [tags, setTags] = useState((meta?.tags ?? []).join(", "));
  const [error, setError] = useState<{ text: string; issues?: { path: string; message: string }[] } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const set = (patch: Record<string, unknown>) => setItem((x) => ({ ...x, ...patch }));
  const isNew = !initial.id;

  const save = () =>
    start(async () => {
      setError(null);
      const r = await saveLibraryItem(workspaceId, kind, item, {
        folder: folder.trim() || null,
        tags: tags.split(",").map((x) => x.trim()).filter(Boolean),
      });
      if (!r.ok) return setError({ text: r.error === "codeTaken" ? t("codeTaken") : te(r.error), issues: r.issues });
      router.refresh();
      onDone();
    });

  const remove = () =>
    start(async () => {
      const r = await deleteLibraryItem(kind, String(item.id));
      if (!r.ok) return setError({ text: te(r.error) });
      router.refresh();
      onDone();
    });

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{isNew ? t(`newTitle.${kind}`) : t(`editTitle.${kind}`)}</h2>
        <Button variant="ghost" size="sm" onClick={onDone}>
          {t("close")}
        </Button>
      </div>
      {error && (
        <Alert tone="danger">
          {error.text}
          {!!error.issues?.length && (
            <ul className="mt-1 list-disc ps-5 text-xs">
              {error.issues.slice(0, 8).map((i, n) => (
                <li key={n}>
                  <code dir="ltr">{i.path}</code>: {i.message}
                </li>
              ))}
            </ul>
          )}
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label={t("code")} hint={t("codeHint")} value={String(item.code ?? "")} dir="ltr" mono onChange={(v) => set({ code: v.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20) })} />
        {kind !== "brand" && kind !== "offer" && <BrandSelect lib={lib} value={(item.brandId as string) ?? null} onChange={(v) => set({ brandId: v })} />}
      </div>
      <LocalizedField label={t("name")} value={item.name as LocalizedText} languages={LANGS} onChange={(v) => set({ name: v })} />

      {kind === "brand" && <BrandFields item={item} set={set} />}
      {kind === "product" && <ProductFields item={item} set={set} />}
      {kind === "offer" && <OfferFields item={item} set={set} />}
      {kind === "store" && <StoreFields item={item} set={set} lib={lib} />}
      {kind === "ad" && <AdFields item={item} set={set} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label={t("folder")} value={folder} dir="auto" onChange={setFolder} />
        <TextField label={t("tags")} value={tags} dir="auto" onChange={setTags} />
      </div>
      <p className="text-xs text-muted">{t("snapshotNote")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={pending}>
          {t("save")}
        </Button>
        {!isNew &&
          (confirmDelete ? (
            <>
              <span className="text-sm text-danger">{t("confirmDelete")}</span>
              <Button variant="danger" size="sm" onClick={remove} disabled={pending}>
                {t("delete")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                {t("cancel")}
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              {t("delete")}
            </Button>
          ))}
      </div>
    </Card>
  );
}

type FieldsProps = { item: Record<string, unknown>; set: (p: Record<string, unknown>) => void };

function BrandSelect({ lib, value, onChange }: { lib: LibrarySnapshot; value: string | null; onChange: (v: string | null) => void }) {
  const t = useTranslations("library");
  const locale = useLocale() as Language;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="brand-select" className="text-sm font-medium">
        {t("brand")}
      </label>
      <Select id="brand-select" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{t("noBrand")}</option>
        {Object.values(lib.brands).map((b) => (
          <option key={b.id} value={b.id}>
            {b.code} · {lt(b.name, locale, "en")}
          </option>
        ))}
      </Select>
    </div>
  );
}

function MediaSlot({ label, value, kinds, onChange }: { label: string; value: MediaRef | null; kinds: ("image" | "video" | "audio")[]; onChange: (m: MediaRef | null) => void }) {
  const t = useTranslations("library");
  const [picking, setPicking] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2 text-sm">
        <span className="truncate text-muted" dir="auto">
          {value ? value.storagePath.split("/").pop()?.replace(/^[0-9a-f-]{36}-/, "") : t("noMedia")}
        </span>
        <Button variant="secondary" size="sm" onClick={() => setPicking(true)}>
          {value ? t("change") : t("choose")}
        </Button>
        {value && (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            {t("remove")}
          </Button>
        )}
      </div>
      {picking && (
        <MediaPicker
          kinds={kinds}
          onClose={() => setPicking(false)}
          onPick={(m) => {
            onChange(m);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

function BrandFields({ item, set }: FieldsProps) {
  const t = useTranslations("library");
  const colors = (item.colors ?? {}) as { primary?: string; secondary?: string };
  return (
    <>
      <div className="flex flex-wrap gap-4">
        {(["primary", "secondary"] as const).map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm">
            <input type="color" value={colors[c] ?? "#0f6e6e"} onChange={(e) => set({ colors: { ...colors, [c]: e.target.value } })} />
            {t(`colors.${c}`)}
          </label>
        ))}
      </div>
      <MediaSlot label={t("logo")} value={(item.logo as MediaRef) ?? null} kinds={["image"]} onChange={(m) => set({ logo: m })} />
      <Checkbox label={t("fictional")} hint={t("fictionalHint")} checked={item.fictional !== false} onChange={(v) => set({ fictional: v })} />
    </>
  );
}

function ProductFields({ item, set }: FieldsProps) {
  const t = useTranslations("library");
  const images = (item.images ?? []) as MediaRef[];
  const attrs = (item.attributes ?? []) as { name: LocalizedText; value: LocalizedText }[];
  return (
    <>
      <LocalizedField label={t("description")} value={item.description as LocalizedText} languages={LANGS} multiline onChange={(v) => set({ description: v })} />
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField label={t("price")} value={item.basePrice as number} min={0} step={0.001} onChange={(v) => set({ basePrice: v ?? 0 })} />
        <TextField label={t("currency")} value={String(item.currency ?? "BHD")} dir="ltr" mono onChange={(v) => set({ currency: v.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) })} />
        <TextField label={t("category")} value={String(item.category ?? "")} dir="auto" onChange={(v) => set({ category: v.slice(0, 80) })} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("images")}</span>
        {images.map((m, i) => (
          <div key={`${m.assetId}-${i}`} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate" dir="auto">
              {m.storagePath.split("/").pop()?.replace(/^[0-9a-f-]{36}-/, "")}
            </span>
            <IconButton label={t("remove")} onClick={() => set({ images: images.filter((_, k) => k !== i) })}>
              ✕
            </IconButton>
          </div>
        ))}
        <MediaSlot label={t("addImage")} value={null} kinds={["image"]} onChange={(m) => m && set({ images: [...images, m] })} />
      </div>
      <NumberField label={t("originalPrice")} value={(item.originalPrice as number | null) ?? undefined} optional min={0} step={0.001} onChange={(v) => set({ originalPrice: v ?? null })} />
      <ReviewFields item={item} set={set} />
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("attributes")}</span>
        {attrs.map((a, i) => (
          <div key={i} className="grid gap-2 rounded-lg border border-line p-2 sm:grid-cols-[1fr_1fr_auto]">
            <LocalizedField label={t("attrName")} value={a.name} languages={LANGS} onChange={(v) => set({ attributes: attrs.map((x, k) => (k === i ? { ...x, name: v } : x)) })} />
            <LocalizedField label={t("attrValue")} value={a.value} languages={LANGS} onChange={(v) => set({ attributes: attrs.map((x, k) => (k === i ? { ...x, value: v } : x)) })} />
            <IconButton label={t("remove")} onClick={() => set({ attributes: attrs.filter((_, k) => k !== i) })}>
              ✕
            </IconButton>
          </div>
        ))}
        <Button variant="secondary" size="sm" className="self-start" onClick={() => set({ attributes: [...attrs, { name: {}, value: {} }] })}>
          {t("addAttribute")}
        </Button>
      </div>
    </>
  );
}

/** Ratings and reviews are stimuli written by the researcher, never real customer data. */
function ReviewFields({ item, set }: FieldsProps) {
  const t = useTranslations("library");
  const reviews = (item.reviews ?? []) as { author: LocalizedText; rating: number; text: LocalizedText }[];
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-warn/40 bg-warn-soft/40 p-3">
      <legend className="px-1 text-sm font-medium">{t("ratingsTitle")}</legend>
      <p className="text-xs text-warn">{t("ratingsNote")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField label={t("rating")} value={(item.rating as number | null) ?? undefined} optional min={0} max={5} step={0.1} onChange={(v) => set({ rating: v === undefined ? null : Math.min(5, Math.max(0, v)) })} />
        <NumberField label={t("ratingCount")} value={(item.ratingCount as number | null) ?? undefined} optional min={0} onChange={(v) => set({ ratingCount: v === undefined ? null : Math.max(0, Math.floor(v)) })} />
      </div>
      {reviews.map((r, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-line bg-surface p-2 sm:grid-cols-[1fr_6rem_auto]">
          <LocalizedField label={t("reviewAuthor")} value={r.author} languages={LANGS} onChange={(v) => set({ reviews: reviews.map((x, k) => (k === i ? { ...x, author: v } : x)) })} />
          <NumberField label={t("reviewStars")} value={r.rating} min={1} max={5} onChange={(v) => set({ reviews: reviews.map((x, k) => (k === i ? { ...x, rating: Math.min(5, Math.max(1, Math.round(v ?? 5))) } : x)) })} />
          <IconButton label={t("remove")} onClick={() => set({ reviews: reviews.filter((_, k) => k !== i) })}>
            ✕
          </IconButton>
          <div className="sm:col-span-3">
            <LocalizedField label={t("reviewText")} value={r.text} languages={LANGS} multiline rows={2} onChange={(v) => set({ reviews: reviews.map((x, k) => (k === i ? { ...x, text: v } : x)) })} />
          </div>
        </div>
      ))}
      <Button variant="secondary" size="sm" className="self-start" disabled={reviews.length >= 20} onClick={() => set({ reviews: [...reviews, { author: {}, rating: 5, text: {} }] })}>
        {t("addReview")}
      </Button>
    </fieldset>
  );
}

function OfferFields({ item, set }: FieldsProps) {
  const t = useTranslations("library");
  const locale = useLocale() as Language;
  const params = (item.params ?? {}) as Record<string, number | undefined>;
  const kind = item.kind as LibOffer["kind"];
  const setParam = (k: string, v: number | undefined) => set({ params: { ...params, [k]: v } });
  const example = effectiveUnitPrice(2, { id: "x", code: "x", name: {}, kind, params, displayText: {} } as LibOffer);
  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor="offer-kind" className="text-sm font-medium">
          {t("offerKind")}
        </label>
        <Select id="offer-kind" value={kind} onChange={(e) => set({ kind: e.target.value, params: {} })}>
          {OFFER_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`offerKinds.${k}`)}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {kind === "percentage" && <NumberField label={t("percent")} value={params.percent} min={0} max={100} onChange={(v) => setParam("percent", v)} />}
        {kind === "fixed_amount" && <NumberField label={t("amount")} value={params.amount} min={0} step={0.001} onChange={(v) => setParam("amount", v)} />}
        {kind === "buy_x_get_y" && (
          <>
            <NumberField label={t("buy")} value={params.buy ?? 1} min={1} max={20} onChange={(v) => setParam("buy", v)} />
            <NumberField label={t("get")} value={params.get ?? 1} min={1} max={20} onChange={(v) => setParam("get", v)} />
          </>
        )}
        {kind === "bundle" && (
          <>
            <NumberField label={t("bundleQty")} value={params.bundleQty ?? 2} min={2} max={50} onChange={(v) => setParam("bundleQty", v)} />
            <NumberField label={t("bundlePrice")} value={params.bundlePrice} min={0} step={0.001} onChange={(v) => setParam("bundlePrice", v)} />
          </>
        )}
      </div>
      <LocalizedField label={t("displayText")} hint={t("displayTextHint")} value={item.displayText as LocalizedText} languages={LANGS} onChange={(v) => set({ displayText: v })} />
      <p className="rounded-lg bg-paper p-3 text-sm">{t("effectiveExample", { base: formatPrice(2, "BHD", locale), effective: formatPrice(example, "BHD", locale) })}</p>
    </>
  );
}

function LibIdList(props: { label: string; ids: string[]; options: { id: string; label: string }[]; onChange: (ids: string[]) => void }) {
  const t = useTranslations("library");
  return <IdList {...props} labels={{ none: t("noneYet"), missing: t("missing"), moveUp: t("moveUp"), remove: t("remove"), choose: t("choose"), add: t("add") }} />;
}

function StoreFields({ item, set, lib }: FieldsProps & { lib: LibrarySnapshot }) {
  const t = useTranslations("library");
  const locale = useLocale() as Language;
  const facade = (item.facade ?? {}) as { color?: string; signText?: LocalizedText; style?: string; image?: MediaRef | null };
  const label = (x: AnyItem) => `${x.code} · ${lt(x.name, locale, "en")}`;
  const products = Object.values(lib.products).map((p) => ({ id: p.id, label: `${label(p)} · ${p.basePrice} ${p.currency}` }));
  const ads = Object.values(lib.ads).map((a) => ({ id: a.id, label: label(a) }));
  return (
    <>
      <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-3">
        <legend className="px-1 text-sm font-medium">{t("facade")}</legend>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="color" value={facade.color ?? "#0f6e6e"} onChange={(e) => set({ facade: { ...facade, color: e.target.value } })} />
            {t("facadeColor")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            {t("facadeStyle")}
            <Select className="w-auto" value={facade.style ?? "shop"} onChange={(e) => set({ facade: { ...facade, style: e.target.value } })}>
              {(["shop", "cafe", "kiosk"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`styles.${s}`)}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <LocalizedField label={t("signText")} hint={t("signTextHint")} value={facade.signText} languages={LANGS} onChange={(v) => set({ facade: { ...facade, signText: v } })} />
        <MediaSlot label={t("facadeImage")} value={facade.image ?? null} kinds={["image"]} onChange={(m) => set({ facade: { ...facade, image: m } })} />
      </fieldset>
      <div className="flex flex-col gap-1">
        <label htmlFor="facade-ad" className="text-sm font-medium">
          {t("facadeAd")}
        </label>
        <Select id="facade-ad" value={(item.facadeAdId as string) ?? ""} onChange={(e) => set({ facadeAdId: e.target.value || null })}>
          <option value="">{t("noAd")}</option>
          {ads.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </Select>
      </div>
      <LibIdList label={t("storeProducts")} ids={(item.productIds as string[]) ?? []} options={products} onChange={(v) => set({ productIds: v })} />
      <LibIdList label={t("inStoreAds")} ids={(item.inStoreAdIds as string[]) ?? []} options={ads} onChange={(v) => set({ inStoreAdIds: v })} />
    </>
  );
}

function AdFields({ item, set }: FieldsProps) {
  const t = useTranslations("library");
  const versions = (item.versions ?? []) as { key: string; label: string; media: MediaRef | null }[];
  const disclosure = (item.disclosure ?? {}) as { text?: LocalizedText; position?: string; style?: string };
  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("versions")}</span>
        <p className="text-xs text-muted">{t("versionsHint")}</p>
        {versions.map((v, i) => (
          <div key={i} className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[8rem_1fr_auto]">
            <TextField label={t("versionKey")} value={v.key} dir="ltr" mono onChange={(x) => set({ versions: versions.map((y, k) => (k === i ? { ...y, key: x.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20) } : y)) })} />
            <TextField label={t("versionLabel")} value={v.label} dir="auto" onChange={(x) => set({ versions: versions.map((y, k) => (k === i ? { ...y, label: x.slice(0, 80) } : y)) })} />
            <IconButton label={t("remove")} disabled={versions.length <= 1} onClick={() => set({ versions: versions.filter((_, k) => k !== i) })}>
              ✕
            </IconButton>
            <div className="sm:col-span-3">
              <MediaSlot label={t("versionMedia")} value={v.media} kinds={["image", "video"]} onChange={(m) => set({ versions: versions.map((y, k) => (k === i ? { ...y, media: m } : y)) })} />
            </div>
          </div>
        ))}
        <Button variant="secondary" size="sm" className="self-start" onClick={() => set({ versions: [...versions, { key: `v${versions.length + 1}`, label: "", media: null }] })}>
          {t("addVersion")}
        </Button>
      </div>
      <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-3">
        <legend className="px-1 text-sm font-medium">{t("disclosure")}</legend>
        <p className="text-xs text-muted">{t("disclosureHint")}</p>
        <LocalizedField label={t("disclosureText")} value={disclosure.text} languages={LANGS} onChange={(v) => set({ disclosure: { ...disclosure, text: v } })} />
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm">
            {t("position")}
            <Select className="w-auto" value={disclosure.position ?? "top-start"} onChange={(e) => set({ disclosure: { ...disclosure, position: e.target.value } })}>
              {(["top-start", "top-end", "bottom-start", "bottom-end"] as const).map((p) => (
                <option key={p} value={p}>
                  {t(`positions.${p}`)}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            {t("labelStyle")}
            <Select className="w-auto" value={disclosure.style ?? "badge"} onChange={(e) => set({ disclosure: { ...disclosure, style: e.target.value } })}>
              {(["badge", "banner", "subtle"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`labelStyles.${s}`)}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </fieldset>
    </>
  );
}

/** A library item as a card: its picture (or its brand's colour), names in both languages and key facts. */
function ItemCard({
  item,
  kind,
  lib,
  thumb,
  folder,
  onOpen,
}: {
  item: AnyItem;
  kind: LibraryKind;
  lib: LibrarySnapshot;
  thumb?: string;
  folder?: string | null;
  onOpen: () => void;
}) {
  const t = useTranslations("library");
  const locale = useLocale() as Language;
  const x = item as unknown as Record<string, unknown>;
  const brand = typeof x.brandId === "string" ? lib.brands[x.brandId] : kind === "brand" ? (item as unknown as LibrarySnapshot["brands"][string]) : undefined;
  const tone = brand?.colors.secondary ?? (kind === "offer" ? "#fcebd5" : kind === "ad" ? "#e1efee" : "#efe9fa");
  const ink = brand?.colors.primary ?? (kind === "offer" ? "#b45309" : kind === "ad" ? "#0f6e6e" : "#6a3fb5");
  const en = lt(item.name, "en");
  const ar = lt(item.name, "ar");
  const primary = (locale === "ar" ? ar || en : en || ar) || t("untitled");
  const secondary = locale === "ar" ? (ar ? en : "") : en ? ar : "";
  const product = kind === "product" ? (item as unknown as LibrarySnapshot["products"][string]) : null;
  const offer = kind === "offer" ? (item as unknown as LibrarySnapshot["offers"][string]) : null;
  const ad = kind === "ad" ? (item as unknown as LibrarySnapshot["ads"][string]) : null;
  const store = kind === "store" ? (item as unknown as LibrarySnapshot["stores"][string]) : null;
  return (
    <button type="button" onClick={onOpen} className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface text-start hover:border-accent/60 hover:shadow-sm">
      <span className="relative flex h-28 w-full items-center justify-center" style={{ background: tone }}>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : kind === "brand" ? (
          <span className="size-12 rounded-full" style={{ background: ink }} aria-hidden />
        ) : offer ? (
          <span className="rounded-full px-3 py-1 text-sm font-bold text-white" style={{ background: ink }} dir="auto">
            {lt(offer.displayText, locale, locale === "ar" ? "en" : "ar") || t(`offerKinds.${offer.kind}`)}
          </span>
        ) : (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ad ? <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a3 3 0 0 1 0 6" /> : store ? <path d="M4 10l2-5h12l2 5M4 10h16v9H4zM9 19v-5h6v5" /> : <path d="M6 7h12l-1 13H7zM9 7a3 3 0 0 1 6 0" />}
          </svg>
        )}
        {brand && kind !== "brand" && (
          <span className="absolute start-2 top-2 max-w-[80%] truncate rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold" style={{ color: ink }} dir="auto">
            {lt(brand.name, locale, locale === "ar" ? "en" : "ar")}
          </span>
        )}
      </span>
      <span className="flex flex-1 flex-col gap-0.5 p-3">
        <span className="font-mono text-[11px] text-muted" dir="ltr">
          {item.code}
        </span>
        <span className="font-semibold leading-snug" dir="auto">
          {primary}
        </span>
        {secondary && (
          <span className="text-sm text-muted" dir="auto" lang={locale === "ar" ? "en" : "ar"}>
            {secondary}
          </span>
        )}
        <span className="mt-auto pt-1 text-sm">
          {product && `${product.currency} ${product.basePrice.toFixed(3)}`}
          {ad && t("versionCount", { n: ad.versions.length })}
          {store && t("productCount", { n: store.productIds.length })}
        </span>
        {folder && <span className="text-xs text-muted">{folder}</span>}
      </span>
    </button>
  );
}
