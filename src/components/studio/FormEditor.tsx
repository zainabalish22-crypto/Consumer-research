"use client";

/**
 * The form editor. It works the way people know from Google Forms and SharePoint Forms (one
 * centred column of cards edited in place, a floating toolbar for adding things, the selected
 * card showing its controls) but it is drawn in Tessellum's own instrument style: dark carbon
 * cards with hairline borders, corner brackets on the selected card, mono labels, and colour
 * only where something needs attention.
 */
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { MediaView } from "@/components/run/Media";
import { QUESTION_TYPES, newBlock, newQuestion, starterShop } from "@/lib/study/defaults";
import { repo } from "@/lib/study/repo";
import type { Block, L10n, Lang, MediaRef, Option, Question, QuestionType, Study } from "@/lib/study/types";
import { uid, variableName } from "@/lib/study/util";

type Update = (fn: (s: Study) => Study) => void;
type QBlock = Extract<Block, { type: "questions" }>;

const WITH_OPTIONS = new Set<QuestionType>(["single", "multiple", "dropdown", "ranking", "image"]);
const OPTION_IMAGES = new Set<QuestionType>(["single", "multiple", "image"]);
const LOGIC_SOURCES = new Set<QuestionType>(["single", "multiple", "dropdown", "image"]);

/* ------------------------------------------------------------------ small parts */

const line = "w-full border-0 border-b border-line-2 bg-transparent px-0 py-1.5 text-[15px] text-photon placeholder:text-faint hover:border-line-3 focus:border-ice focus:outline-none";
const boxed = "min-h-11 rounded-md border border-line-2 bg-void px-3 text-[14px] text-photon focus:border-ice focus:outline-none";

/** A text area that grows with its content, like the fields in Google Forms. */
function Grow({ value, onChange, placeholder, className, label, focus }: { value: string; onChange: (v: string) => void; placeholder: string; className: string; label?: string; focus?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // A card that was just selected or added puts the cursor in its title.
  useEffect(() => {
    if (focus) ref.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} placeholder={placeholder} aria-label={label ?? placeholder} onChange={(e) => onChange(e.target.value)} className={`resize-none overflow-hidden ${className}`} />;
}

const I = {
  plus: "M12 5v14M5 12h14",
  text: "M4 6V4h16v2M12 4v16M8 20h8",
  image: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9.5a1 1 0 1 0 0 .01",
  video: "M4 6h12v12H4zM16 10l4-2v8l-4-2",
  section: "M4 7h16v4H4zM4 15h16v4H4z",
  consent: "M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3zM8.5 12l2.5 2.5 4.5-5",
  shop: "M3 4h2l2.4 11h10.2L20 7H6.2M9 19.5a.5.5 0 1 0 0 .01M17 19.5a.5.5 0 1 0 0 .01",
  copy: "M8 8h12v12H8zM16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3",
  trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
  up: "M6 15l6-6 6 6",
  down: "M6 9l6 6 6-6",
  x: "M6 6l12 12M18 6L6 18",
  more: "M12 6v.01M12 12v.01M12 18v.01",
};
function Ico({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={d === I.more ? 3 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function IconBtn({ label, d, onClick, disabled, active }: { label: string; d: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={active} onClick={onClick} disabled={disabled} className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-mist hover:bg-steel hover:text-photon disabled:opacity-30 ${active ? "bg-raised text-photon" : ""}`}>
      <Ico d={d} />
    </button>
  );
}

/** Picks an image or video file and stores it; shows a clear message when a file is too large. */
function useUpload(onError: (msg: string) => void, tooBig: string) {
  const input = useRef<HTMLInputElement>(null);
  const cb = useRef<(ref: MediaRef) => void>(() => {});
  const pick = (accept: string, then: (ref: MediaRef) => void) => {
    cb.current = then;
    if (input.current) {
      input.current.accept = accept;
      input.current.click();
    }
  };
  const el = (
    <input
      ref={input}
      type="file"
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        const limit = f.type.startsWith("video") ? 100 : 10;
        if (f.size > limit * 1024 * 1024) return onError(tooBig);
        onError("");
        cb.current(await repo.putMedia(f, f.name));
      }}
    />
  );
  return { pick, el };
}

/** Corner brackets on the selected card, echoing the brackets of the Tessellum mark. */
function Brackets() {
  return (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute -start-px -top-px h-3.5 w-3.5 border-s-2 border-t-2 border-photon" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-px -end-px h-3.5 w-3.5 border-b-2 border-e-2 border-photon" />
    </>
  );
}

/* ------------------------------------------------------------------ editor */

export function FormEditor({ study, update, openShop }: { study: Study; update: Update; openShop: () => void }) {
  const t = useTranslations("studio.form");
  const b = useTranslations("studio.blocks");
  const L: Lang = study.languages[0] ?? "en";
  const g = (v?: L10n) => v?.[L] ?? "";
  const s = (v: L10n | undefined, text: string): L10n => ({ ...(v ?? {}), [L]: text });
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState("");
  const upload = useUpload(setError, t("tooBig"));

  const setBlocks = (fn: (bs: Block[]) => Block[]) => update((st) => ({ ...st, blocks: fn(st.blocks) }));
  const patchBlock = (id: string, p: Partial<Block>) => setBlocks((bs) => bs.map((x) => (x.id === id ? ({ ...x, ...p } as Block) : x)));
  const setQs = (blockId: string, fn: (qs: Question[]) => Question[]) => setBlocks((bs) => bs.map((x) => (x.id === blockId && x.type === "questions" ? { ...x, questions: fn(x.questions) } : x)));

  const pages = study.blocks.filter((x): x is QBlock => x.type === "questions");
  const allQs = pages.flatMap((p) => p.questions);
  const nextVar = () => {
    const taken = new Set(allQs.map((q) => q.variable));
    let n = allQs.filter((q) => q.type !== "info").length + 1;
    while (taken.has(`q${n}`)) n++;
    return n;
  };

  /** Adds an item after the selected question, or at the end of the last page. */
  function addItem(make: () => Question) {
    const q = make();
    setBlocks((bs) => {
      let target = bs.find((x) => x.type === "questions" && (x.id === active || x.questions.some((y) => y.id === active))) as QBlock | undefined;
      if (!target) target = [...bs].reverse().find((x) => x.type === "questions") as QBlock | undefined;
      if (!target) {
        const page = { ...(newBlock("questions") as QBlock), title: {}, questions: [q] };
        const end = bs.findIndex((x) => x.type === "end");
        return end < 0 ? [...bs, page] : [...bs.slice(0, end), page, ...bs.slice(end)];
      }
      const at = target.questions.findIndex((y) => y.id === active);
      const qs = at < 0 ? [...target.questions, q] : [...target.questions.slice(0, at + 1), q, ...target.questions.slice(at + 1)];
      return bs.map((x) => (x.id === target!.id ? { ...target!, questions: qs } : x));
    });
    setActive(q.id);
  }
  const blank = (type: QuestionType): Question => {
    const q = newQuestion(type, nextVar());
    // One language per form: keep only that language's starting text.
    const one = (v?: L10n) => (v ? { [L]: v[L] ?? "" } : v);
    return { ...q, text: { [L]: "" }, help: undefined, options: q.options?.map((o) => ({ ...o, label: one(o.label)! })), rows: q.rows?.map((o) => ({ ...o, label: one(o.label)! })), scale: q.scale && { ...q.scale, left: one(q.scale.left)!, right: one(q.scale.right)! }, range: q.range && { ...q.range, left: one(q.range.left)!, right: one(q.range.right)! } };
  };
  function addBlockBeforeEnd(blk: Block) {
    setBlocks((bs) => {
      const end = bs.findIndex((x) => x.type === "end");
      return end < 0 ? [...bs, blk] : [...bs.slice(0, end), blk, ...bs.slice(end)];
    });
    setActive(blk.id);
  }
  const oneLang = <T,>(v: T): T => JSON.parse(JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) && Object.keys(x).length > 0 && Object.keys(x).every((k) => k === "en" || k === "ar") ? { [L]: x[L] ?? "" } : x)));

  const hasConsent = study.blocks.some((x) => x.type === "consent");
  const hasShop = study.blocks.some((x) => x.type === "shop");
  let pageNo = 0;

  return (
    <div lang={L} dir={L === "ar" ? "rtl" : "ltr"} style={{ ["--accent" as string]: study.accent }} className="text-photon">
      {upload.el}
      <div className="mx-auto flex max-w-[840px] items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-3 pb-24 md:pb-0">
          {study.header && <MediaView src={study.header} className="!rounded-lg" />}

          {study.blocks.map((blk) => {
            if (blk.type === "questions") {
              pageNo += 1;
              const first = pageNo === 1;
              return (
                <div key={blk.id} className="flex flex-col gap-3">
                  {/* Title card (first page) or page header */}
                  <section onFocus={() => setActive(blk.id)} className={`relative rounded-lg border bg-carbon ${active === blk.id ? "border-line-3" : "border-line-2"}`}>
                    {active === blk.id && <Brackets />}
                    {!first && (
                      <div className="flex items-center justify-between gap-2 border-b border-line-2 px-6 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                        <span>{t("section", { n: pageNo, total: pages.length })}</span>
                        <button type="button" onClick={() => window.confirm(t("removeSection")) && setBlocks((bs) => bs.filter((x) => x.id !== blk.id))} aria-label={t("removeSection")} title={t("removeSection")} className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-steel hover:text-photon">
                          <Ico d={I.trash} size={18} />
                        </button>
                      </div>
                    )}
                    <div className="flex flex-col gap-2 px-6 pb-5 pt-5">
                      {first && (
                        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                          <span aria-hidden="true" className="h-2.5 w-2.5" style={{ background: "var(--accent)" }} />
                          {t("formTitle")}
                        </span>
                      )}
                      <Grow value={g(blk.title)} onChange={(v) => patchBlock(blk.id, { title: s(blk.title, v) })} placeholder={first ? t("formTitle") : t("sectionTitle")} className={`${line} font-display font-light ${first ? "text-[32px] leading-tight" : "text-[22px]"}`} />
                      <Grow value={g(blk.description)} onChange={(v) => patchBlock(blk.id, { description: s(blk.description, v) })} placeholder={first ? t("formDescription") : t("sectionDescription")} className={`${line} text-[14px]`} />
                      {!first && <p className="text-xs text-faint">{t("pageBreak")}</p>}
                    </div>
                  </section>

                  {blk.questions.map((q, i) => (
                    <QuestionCard
                      key={q.id}
                      q={q}
                      L={L}
                      active={active === q.id}
                      activate={() => setActive(q.id)}
                      change={(nq) => setQs(blk.id, (qs) => qs.map((x) => (x.id === q.id ? nq : x)))}
                      remove={() => {
                        setQs(blk.id, (qs) => qs.filter((x) => x.id !== q.id));
                        setActive(blk.questions[i - 1]?.id ?? blk.id);
                      }}
                      duplicate={() => {
                        const copy: Question = { ...structuredClone(q), id: uid("q"), variable: q.type === "info" ? uid("i") : `q${nextVar()}` };
                        setQs(blk.id, (qs) => [...qs.slice(0, i + 1), copy, ...qs.slice(i + 1)]);
                        setActive(copy.id);
                      }}
                      move={(d) => setQs(blk.id, (qs) => {
                        const a = [...qs];
                        const j = i + d;
                        if (j < 0 || j >= a.length) return qs;
                        [a[i], a[j]] = [a[j], a[i]];
                        return a;
                      })}
                      canUp={i > 0}
                      canDown={i < blk.questions.length - 1}
                      earlier={allQs.slice(0, allQs.indexOf(q)).filter((x) => LOGIC_SOURCES.has(x.type))}
                      duplicateVar={q.type !== "info" && allQs.filter((x) => x.variable === q.variable).length > 1}
                      pick={upload.pick}
                    />
                  ))}
                </div>
              );
            }

            // Steps that are not question pages: consent, the shop, the closing message.
            const removable = blk.type !== "end";
            return (
              <section key={blk.id} onFocus={() => setActive(blk.id)} className={`relative rounded-lg border bg-carbon ${active === blk.id ? "border-line-3" : "border-line-2"}`}>
                {active === blk.id && <Brackets />}
                <div className="flex min-h-11 items-center justify-between gap-2 border-b border-line-2 px-6 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                  <span>
                    {t("step")} · {b(blk.type)}
                  </span>
                  {removable && (
                    <button type="button" onClick={() => setBlocks((bs) => bs.filter((x) => x.id !== blk.id))} aria-label={t("removeStep")} title={t("removeStep")} className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-steel hover:text-photon">
                      <Ico d={I.trash} size={18} />
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-3 px-6 pb-5 pt-4">
                  <Grow value={g(blk.title)} onChange={(v) => patchBlock(blk.id, { title: s(blk.title, v) })} placeholder={t("sectionTitle")} className={`${line} font-display text-[20px]`} />
                  {"body" in blk && <Grow value={g(blk.body)} onChange={(v) => patchBlock(blk.id, { body: s(blk.body, v) })} placeholder={blk.type === "consent" ? t("consentText") : blk.type === "end" ? t("endMessage") : t("description")} className={`${line} text-[14px]`} />}
                  {blk.type === "consent" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input aria-label="✓" value={g(blk.agree)} onChange={(e) => patchBlock(blk.id, { agree: s(blk.agree, e.target.value) })} className={boxed} />
                      <input aria-label="✗" value={g(blk.decline)} onChange={(e) => patchBlock(blk.id, { decline: s(blk.decline, e.target.value) })} className={boxed} />
                    </div>
                  )}
                  {blk.type === "shop" && (
                    <button type="button" onClick={openShop} className="min-h-11 self-start rounded-md border border-line-3 px-4 text-sm font-semibold hover:border-photon">
                      {t("editShop")}
                    </button>
                  )}
                </div>
              </section>
            );
          })}
          {error && (
            <p role="alert" className="rounded-md border border-danger px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        {/* Floating toolbar: at the side on wide screens, along the bottom on phones */}
        <div role="toolbar" aria-label={t("toolbar")} className="fixed inset-x-0 bottom-0 z-20 flex justify-center gap-1 border-t border-line-2 bg-carbon p-1 md:sticky md:inset-auto md:top-4 md:flex-col md:rounded-lg md:border">
          <IconBtn label={t("addQuestion")} d={I.plus} onClick={() => addItem(() => blank("single"))} />
          <IconBtn label={t("addText")} d={I.text} onClick={() => addItem(() => ({ ...blank("info"), variable: uid("i") }))} />
          <IconBtn label={t("addPhoto")} d={I.image} onClick={() => upload.pick("image/*", (ref) => addItem(() => ({ ...blank("info"), variable: uid("i"), media: ref })))} />
          <IconBtn label={t("addVideo")} d={I.video} onClick={() => upload.pick("video/mp4,video/webm", (ref) => addItem(() => ({ ...blank("info"), variable: uid("i"), media: ref })))} />
          <IconBtn label={t("addSection")} d={I.section} onClick={() => addBlockBeforeEnd({ ...(newBlock("questions") as QBlock), title: {}, description: {}, questions: [] })} />
          {!hasConsent && <IconBtn label={t("addConsent")} d={I.consent} onClick={() => { const c = oneLang(newBlock("consent")); setBlocks((bs) => [c, ...bs]); setActive(c.id); }} />}
          {!hasShop && (
            <IconBtn
              label={t("addShop")}
              d={I.shop}
              onClick={() => {
                update((st) => ({ ...st, shop: st.shop ?? oneLang(starterShop()) }));
                addBlockBeforeEnd(oneLang(newBlock("shop")));
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ question card */

function QuestionCard({ q, L, active, activate, change, remove, duplicate, move, canUp, canDown, earlier, duplicateVar, pick }: { q: Question; L: Lang; active: boolean; activate: () => void; change: (q: Question) => void; remove: () => void; duplicate: () => void; move: (d: number) => void; canUp: boolean; canDown: boolean; earlier: Question[]; duplicateVar: boolean; pick: (accept: string, then: (ref: MediaRef) => void) => void }) {
  const t = useTranslations("studio.form");
  const qt = useTranslations("studio.qtypes");
  const ex = useTranslations("studio.extras");
  const [more, setMore] = useState(false);
  const g = (v?: L10n) => v?.[L] ?? "";
  const s = (v: L10n | undefined, text: string): L10n => ({ ...(v ?? {}), [L]: text });
  const set = (p: Partial<Question>) => change({ ...q, ...p });
  const info = q.type === "info";

  if (!active)
    return (
      <button type="button" onClick={activate} className="flex flex-col gap-3 rounded-lg border border-line-2 bg-carbon px-6 py-5 text-start hover:border-line-3">
        {!info && (
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint" dir="ltr">
            {q.variable} · {qt(q.type)}
          </span>
        )}
        <span className={info ? "text-[20px]" : "text-[16px]"}>
          {g(q.text) || <span className="text-faint">{info ? t("addText") : t("untitled")}</span>}
          {q.required && !info && <span className="ms-1 text-signal">*</span>}
        </span>
        {g(q.help) && <span className="text-[13px] text-dim">{g(q.help)}</span>}
        {q.media && (
          <span className="block">
            <MediaView src={q.media} plain />
          </span>
        )}
        {!info && <Preview q={q} L={L} />}
        {q.showIf && <span className="text-xs text-ice">↳ {t("logic")}: {q.showIf.variable} {q.showIf.op === "is" ? t("is") : t("isNot")} {q.showIf.value}</span>}
      </button>
    );

  const typeChange = (ty: QuestionType) => {
    const fresh = newQuestion(ty, 0);
    const one = (v?: L10n) => (v ? { [L]: v[L] ?? "" } : v);
    // Keep the wording, and the options when both types have options.
    const keepOptions = WITH_OPTIONS.has(q.type) && WITH_OPTIONS.has(ty) && q.options?.length;
    change({
      ...fresh,
      id: q.id,
      variable: q.variable,
      text: q.text,
      help: q.help,
      media: q.media,
      required: q.required,
      showIf: q.showIf,
      options: keepOptions ? q.options : fresh.options?.map((o) => ({ ...o, label: one(o.label)! })),
      rows: fresh.rows?.map((o) => ({ ...o, label: one(o.label)! })),
      scale: fresh.scale && { ...fresh.scale, left: one(fresh.scale.left)!, right: one(fresh.scale.right)! },
      range: fresh.range && { ...fresh.range, left: one(fresh.range.left)!, right: one(fresh.range.right)! },
    });
  };
  const source = q.showIf ? earlier.find((x) => x.variable === q.showIf!.variable) : undefined;

  return (
    <section className="relative rounded-lg border border-line-3 bg-carbon">
      <Brackets />
      <div className="flex flex-col gap-4 px-6 pb-2 pt-5">
        {!info && (
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint" dir="ltr">
            {q.variable} · {qt(q.type)}
          </span>
        )}
        <div className="flex flex-wrap items-start gap-3">
          <Grow focus value={g(q.text)} onChange={(v) => set({ text: s(q.text, v) })} placeholder={info ? t("sectionTitle") : t("question")} className={`min-w-[200px] flex-1 rounded-t border-0 border-b border-line-3 bg-steel px-4 py-3 text-photon placeholder:text-faint focus:border-ice focus:outline-none ${info ? "font-display text-[20px]" : "text-[16px]"}`} />
          <IconBtn label={q.media ? t("removeMedia") : t("addImage")} d={q.media ? I.x : I.image} onClick={() => (q.media ? set({ media: undefined }) : pick("image/*,video/mp4,video/webm", (ref) => set({ media: ref })))} />
          {!info && (
            <select aria-label={t("type")} value={q.type} onChange={(e) => typeChange(e.target.value as QuestionType)} className={`${boxed} w-full sm:w-56`}>
              {QUESTION_TYPES.map((k) => (
                <option key={k} value={k}>
                  {qt(k)}
                </option>
              ))}
            </select>
          )}
        </div>
        {(info || q.help !== undefined) && <Grow value={g(q.help)} onChange={(v) => set({ help: s(q.help, v) })} placeholder={t("description")} className={`${line} text-[14px]`} />}
        {q.media && <MediaView src={q.media} />}

        {/* Answer area, by type */}
        {WITH_OPTIONS.has(q.type) && <OptionList L={L} items={q.options ?? []} onChange={(options) => set({ options })} glyph={q.type === "multiple" ? "square" : q.type === "single" || q.type === "image" ? "circle" : "number"} images={OPTION_IMAGES.has(q.type)} pick={pick} placeholder={(n) => t("option", { n })} addLabel={t("addOption")} />}
        {q.type === "matrix" && (
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-medium text-dim">{t("rows")}</span>
              <OptionList L={L} items={q.rows ?? []} onChange={(rows) => set({ rows })} glyph="number" placeholder={(n) => t("row", { n })} addLabel={t("addRow")} pick={pick} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-medium text-dim">{t("columns")}</span>
              <OptionList L={L} items={q.options ?? []} onChange={(options) => set({ options })} glyph="circle" placeholder={(n) => t("column", { n })} addLabel={t("addColumn")} pick={pick} />
            </div>
          </div>
        )}
        {(q.type === "likert" || q.type === "semantic") && q.scale && (
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3 text-[14px]">
              1 {t("to")}
              <select value={q.scale.points} onChange={(e) => set({ scale: { ...q.scale!, points: Number(e.target.value) } })} className={boxed} aria-label={t("points")}>
                {[2, 3, 4, 5, 6, 7, 9, 10, 11].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-3 text-[14px]">
              <span className="w-6 text-dim">1</span>
              <input value={g(q.scale.left)} onChange={(e) => set({ scale: { ...q.scale!, left: s(q.scale!.left, e.target.value) } })} placeholder={t("leftLabel")} aria-label={t("leftLabel")} className={line} />
            </label>
            <label className="flex items-center gap-3 text-[14px]">
              <span className="w-6 text-dim">{q.scale.points}</span>
              <input value={g(q.scale.right)} onChange={(e) => set({ scale: { ...q.scale!, right: s(q.scale!.right, e.target.value) } })} placeholder={t("rightLabel")} aria-label={t("rightLabel")} className={line} />
            </label>
          </div>
        )}
        {q.type === "slider" && q.range && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              {(["min", "max", "step"] as const).map((k) => (
                <label key={k} className="flex flex-col gap-1 text-[13px] text-dim">
                  {t(k)}
                  <input type="number" dir="ltr" value={q.range![k]} onChange={(e) => set({ range: { ...q.range!, [k]: Number(e.target.value) } })} className={boxed} />
                </label>
              ))}
            </div>
            <input value={g(q.range.left)} onChange={(e) => set({ range: { ...q.range!, left: s(q.range!.left, e.target.value) } })} placeholder={t("minLabel")} aria-label={t("minLabel")} className={line} />
            <input value={g(q.range.right)} onChange={(e) => set({ range: { ...q.range!, right: s(q.range!.right, e.target.value) } })} placeholder={t("maxLabel")} aria-label={t("maxLabel")} className={line} />
          </div>
        )}
        {q.type === "numeric" && (
          <div className="grid grid-cols-2 gap-3">
            {(["min", "max"] as const).map((k) => (
              <label key={k} className="flex flex-col gap-1 text-[13px] text-dim">
                {t(k)}
                <input type="number" dir="ltr" value={q.limits?.[k] ?? ""} onChange={(e) => set({ limits: { ...q.limits, [k]: e.target.value === "" ? undefined : Number(e.target.value) } })} className={boxed} />
              </label>
            ))}
          </div>
        )}
        {(q.type === "short" || q.type === "long" || q.type === "date") && <p className={`border-b border-dotted border-line-2 pb-2 text-[14px] text-faint ${q.type === "long" ? "w-4/5" : "w-1/2"}`}>{t(q.type === "short" ? "shortAnswer" : q.type === "long" ? "longAnswer" : "dateAnswer")}</p>}

        {/* More options: description, shuffle, logic, attention check, variable name */}
        {more && !info && (
          <div className="flex flex-col gap-4 rounded-md border border-line-2 bg-void p-4 text-[14px]">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <Check label={t("showDescription")} checked={q.help !== undefined} onChange={(v) => set({ help: v ? {} : undefined })} />
              {WITH_OPTIONS.has(q.type) && <Check label={t("shuffle")} checked={!!q.randomize} onChange={(v) => set({ randomize: v })} />}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-dim">{t("logic")}</span>
              <div className="flex flex-wrap gap-2">
                <select aria-label={t("logic")} value={q.showIf?.variable ?? ""} onChange={(e) => { const src = earlier.find((x) => x.variable === e.target.value); set({ showIf: src ? { variable: src.variable, op: "is", value: src.options?.[0]?.value ?? "" } : undefined }); }} className={`${boxed} min-w-0 max-w-full flex-1`}>
                  <option value="">{t("logicAlways")}</option>
                  {earlier.map((x) => (
                    <option key={x.id} value={x.variable}>
                      {g(x.text) || x.variable}
                    </option>
                  ))}
                </select>
                {q.showIf && source && (
                  <>
                    <select aria-label={t("is")} value={q.showIf.op} onChange={(e) => set({ showIf: { ...q.showIf!, op: e.target.value as "is" | "is_not" } })} className={boxed}>
                      <option value="is">{t("is")}</option>
                      <option value="is_not">{t("isNot")}</option>
                    </select>
                    <select aria-label={t("option", { n: "" })} value={q.showIf.value} onChange={(e) => set({ showIf: { ...q.showIf!, value: e.target.value } })} className={`${boxed} min-w-0 max-w-full flex-1`}>
                      {(source.options ?? []).map((o) => (
                        <option key={o.id} value={o.value}>
                          {g(o.label) || o.value}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            </div>
            {(q.type === "single" || q.type === "dropdown") && (
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1 text-[13px] font-medium text-dim">{t("endIf")}</legend>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {(q.options ?? []).map((o) => (
                    <Check key={o.id} label={g(o.label) || o.value} checked={!!q.endIf?.includes(o.value)} onChange={(v) => { const cur = new Set(q.endIf ?? []); if (v) cur.add(o.value); else cur.delete(o.value); set({ endIf: cur.size ? [...cur] : undefined }); }} />
                  ))}
                </div>
              </fieldset>
            )}
            {(q.type === "single" || q.type === "dropdown" || q.type === "image" || q.type === "likert" || q.type === "semantic") && (
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-dim">{t("attention")}</span>
                <select value={q.attention ?? ""} onChange={(e) => set({ attention: e.target.value || undefined })} className={boxed}>
                  <option value="">{t("noAttention")}</option>
                  {(q.scale ? Array.from({ length: q.scale.points }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })) : (q.options ?? []).map((o) => ({ value: o.value, label: g(o.label) || o.value }))).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-dim">{t("attentionHint")}</span>
              </label>
            )}
            {(q.type === "single" || q.type === "multiple" || q.type === "dropdown" || q.type === "likert" || q.type === "semantic" || q.type === "image") && (
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-dim">{t("extra")}</span>
                <select value={q.extra ?? ""} onChange={(e) => set({ extra: (e.target.value || undefined) as Question["extra"] })} className={boxed}>
                  <option value="">—</option>
                  {(["none", "not_sure", "prefer_not"] as const).map((k) => (
                    <option key={k} value={k}>
                      {ex(k)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-dim">
                {t("variable")}
                {duplicateVar && <span className="ms-2 text-signal">⚠</span>}
              </span>
              <input dir="ltr" value={q.variable} onChange={(e) => set({ variable: variableName(e.target.value) })} className={`${boxed} font-mono`} />
            </label>
          </div>
        )}
      </div>

      {/* Card footer, as in Google Forms */}
      <div className="mx-6 flex flex-wrap items-center justify-end gap-1 border-t border-line-2 py-1.5">
        <IconBtn label={t("moveUp")} d={I.up} onClick={() => move(-1)} disabled={!canUp} />
        <IconBtn label={t("moveDown")} d={I.down} onClick={() => move(1)} disabled={!canDown} />
        <IconBtn label={t("duplicate")} d={I.copy} onClick={duplicate} />
        <IconBtn label={t("delete")} d={I.trash} onClick={remove} />
        {!info && (
          <>
            <span aria-hidden="true" className="mx-2 h-8 w-px bg-line-2" />
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px]">
              {t("required")}
              <input type="checkbox" role="switch" checked={q.required} onChange={(e) => set({ required: e.target.checked })} className="peer sr-only" />
              <span aria-hidden="true" className="relative h-5 w-9 rounded-full bg-line-3 transition-colors after:absolute after:start-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-void after:transition-transform peer-checked:bg-photon peer-checked:after:translate-x-4 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-signal rtl:peer-checked:after:-translate-x-4" />
            </label>
            <IconBtn label={t("more")} d={I.more} onClick={() => setMore((m) => !m)} active={more} />
          </>
        )}
      </div>
    </section>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-[18px] w-[18px] accent-[#F2F4F5]" />
      {label}
    </label>
  );
}

function Glyph({ kind, n }: { kind: "circle" | "square" | "number"; n: number }) {
  if (kind === "number") return <span className="w-5 shrink-0 text-center text-[14px] text-dim">{n}.</span>;
  return <span aria-hidden="true" className={`h-[18px] w-[18px] shrink-0 border-2 border-line-3 ${kind === "circle" ? "rounded-full" : "rounded-sm"}`} />;
}

/** Options edited in place: a glyph, the text, an optional image, and remove. */
function OptionList({ L, items, onChange, glyph, images = false, pick, placeholder, addLabel }: { L: Lang; items: Option[]; onChange: (o: Option[]) => void; glyph: "circle" | "square" | "number"; images?: boolean; pick: (accept: string, then: (ref: MediaRef) => void) => void; placeholder: (n: number) => string; addLabel: string }) {
  const t = useTranslations("studio.form");
  const set = (i: number, p: Partial<Option>) => onChange(items.map((o, j) => (j === i ? { ...o, ...p } : o)));
  const add = () => {
    const used = new Set(items.map((o) => o.value));
    let n = items.length + 1;
    while (used.has(String(n))) n++;
    onChange([...items, { id: uid("o"), value: String(n), label: { [L]: "" } }]);
  };
  return (
    <div className="flex flex-col">
      {items.map((o, i) => (
        <div key={o.id} className="flex flex-col gap-2 py-0.5">
          <div className="flex items-center gap-3">
            <Glyph kind={glyph} n={i + 1} />
            <input
              value={o.label[L] ?? ""}
              onChange={(e) => set(i, { label: { ...o.label, [L]: e.target.value } })}
              onKeyDown={(e) => e.key === "Enter" && i === items.length - 1 && add()}
              placeholder={placeholder(i + 1)}
              aria-label={placeholder(i + 1)}
              className={`${line} border-transparent hover:border-line-2`}
            />
            {images && <IconBtn label={o.image ? t("removeMedia") : t("optionImage")} d={o.image ? I.x : I.image} onClick={() => (o.image ? set(i, { image: undefined }) : pick("image/*", (ref) => set(i, { image: ref })))} />}
            <IconBtn label={`${t("removeOption")} ${i + 1}`} d={I.x} onClick={() => onChange(items.filter((_, j) => j !== i))} disabled={items.length <= 1} />
          </div>
          {o.image && (
            <div className="ms-8 max-w-[220px]">
              <MediaView src={o.image} />
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={add} className="flex min-h-11 items-center gap-3 self-start text-[14px] text-dim hover:text-photon">
        <Glyph kind={glyph} n={items.length + 1} />
        <span className="border-b border-transparent hover:border-line-2">{addLabel}</span>
      </button>
    </div>
  );
}

/** A static preview of the answer area for cards that are not being edited. */
function Preview({ q, L }: { q: Question; L: Lang }) {
  const t = useTranslations("studio.form");
  const g = (v?: L10n) => v?.[L] ?? "";
  if (WITH_OPTIONS.has(q.type))
    return (
      <span className="flex flex-col gap-2.5">
        {(q.options ?? []).map((o, i) => (
          <span key={o.id} className="flex items-center gap-3 text-[14px]">
            <Glyph kind={q.type === "multiple" ? "square" : q.type === "single" || q.type === "image" ? "circle" : "number"} n={i + 1} />
            {g(o.label) || t("option", { n: i + 1 })}
          </span>
        ))}
      </span>
    );
  if ((q.type === "likert" || q.type === "semantic") && q.scale)
    return (
      <span className="flex items-end justify-between gap-2 text-[13px] text-dim">
        <span className="max-w-[25%]">{g(q.scale.left)}</span>
        <span className="flex flex-1 justify-around">
          {Array.from({ length: q.scale.points }, (_, i) => (
            <span key={i} className="flex flex-col items-center gap-1.5">
              <span dir="ltr">{i + 1}</span>
              <Glyph kind="circle" n={i} />
            </span>
          ))}
        </span>
        <span className="max-w-[25%] text-end">{g(q.scale.right)}</span>
      </span>
    );
  if (q.type === "matrix")
    return (
      <span className="flex flex-col gap-1 text-[13px] text-dim">
        <span>{(q.options ?? []).map((o) => g(o.label)).join(" · ")}</span>
        {(q.rows ?? []).map((r) => (
          <span key={r.id} className="text-[14px] text-photon">
            {g(r.label)}
          </span>
        ))}
      </span>
    );
  if (q.type === "slider" && q.range)
    return (
      <span className="flex items-center gap-3 text-[13px] text-dim">
        <span>{g(q.range.left) || q.range.min}</span>
        <span className="h-1 flex-1 rounded bg-line-2" />
        <span>{g(q.range.right) || q.range.max}</span>
      </span>
    );
  return <span className={`border-b border-dotted border-line-2 pb-2 text-[14px] text-faint ${q.type === "long" ? "w-4/5" : "w-1/2"}`}>{t(q.type === "short" ? "shortAnswer" : q.type === "long" ? "longAnswer" : q.type === "date" ? "dateAnswer" : "numberAnswer")}</span>;
}
