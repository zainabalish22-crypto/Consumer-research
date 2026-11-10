"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { BLOCK_TYPES, QUESTION_TYPES, newBlock, newQuestion, starterShop } from "@/lib/study/defaults";
import type { Block, BlockType, Lang, MediaRef, Question, Study } from "@/lib/study/types";
import { tx } from "@/lib/study/util";
import { QuestionEditor } from "./QuestionEditor";
import { Button, Icon, IconButton, L10nInput, MediaInput, NumberInput, Panel, Select, TextInput } from "./ui";

type Update = (fn: (s: Study) => Study) => void;

const move = <T,>(list: T[], from: number, to: number) => {
  const a = [...list];
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return a;
};

/** The study's block flow: reorder on the left, edit the selected block on the right. */
export function FlowEditor({ study, update }: { study: Study; update: Update }) {
  const t = useTranslations("studio");
  const locale = useLocale() as Lang;
  const [selected, setSelected] = useState<string | undefined>(study.blocks[0]?.id);
  const [adding, setAdding] = useState<BlockType>("questions");
  const [drag, setDrag] = useState<number | null>(null);
  const block = study.blocks.find((b) => b.id === selected) ?? study.blocks[0];

  const setBlocks = (fn: (b: Block[]) => Block[]) => update((s) => ({ ...s, blocks: fn(s.blocks) }));
  const patch = (id: string, p: Partial<Block>) => setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, ...p } as Block) : b)));

  function add() {
    const b = newBlock(adding);
    // New blocks go before the End block, if there is one.
    setBlocks((bs) => {
      const end = bs.findIndex((x) => x.type === "end");
      return end < 0 ? [...bs, b] : [...bs.slice(0, end), b, ...bs.slice(end)];
    });
    if (adding === "shop") update((s) => ({ ...s, shop: s.shop ?? starterShop() }));
    setSelected(b.id);
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3 lg:sticky lg:top-4">
        <p className="text-sm text-faint">{t("flow.hint")}</p>
        <ol className="flex flex-col gap-1.5">
          {study.blocks.map((b, i) => {
            const active = b.id === block?.id;
            return (
              <li
                key={b.id}
                draggable
                onDragStart={() => setDrag(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (drag !== null && drag !== i) setBlocks((bs) => move(bs, drag, i));
                  setDrag(null);
                }}
                onDragEnd={() => setDrag(null)}
                className={`flex items-center gap-1 rounded-md border ${active ? "border-signal bg-steel" : "border-line-2 bg-carbon"} ${drag === i ? "opacity-50" : ""}`}
              >
                <span title={t("flow.drag")} className="cursor-grab px-1 text-faint">
                  {Icon.grip}
                </span>
                <button type="button" onClick={() => setSelected(b.id)} aria-current={active} className="flex min-h-11 min-w-0 flex-1 flex-col items-start py-2 text-start">
                  <span className="font-mono text-[11px] text-faint">
                    {String(i + 1).padStart(2, "0")} · {t(`blocks.${b.type}`)}
                  </span>
                  <span className="w-full truncate text-sm">{b.type === "questions" ? `${tx(b.title, locale)} · ${t("flow.questions", { n: b.questions.length })}` : tx("title" in b ? b.title : undefined, locale)}</span>
                </button>
                <IconButton label={t("flow.up")} disabled={i === 0} onClick={() => setBlocks((bs) => move(bs, i, i - 1))}>
                  {Icon.up}
                </IconButton>
                <IconButton label={t("flow.down")} disabled={i === study.blocks.length - 1} onClick={() => setBlocks((bs) => move(bs, i, i + 1))}>
                  {Icon.down}
                </IconButton>
              </li>
            );
          })}
        </ol>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <Select label={t("flow.add")} value={adding} onChange={setAdding} options={BLOCK_TYPES.map((b) => [b, t(`blocks.${b}`)] as [BlockType, string])} />
          </div>
          <div className="self-end">
            <Button onClick={add}>
              {Icon.plus}
              {t("flow.add")}
            </Button>
          </div>
        </div>
        <p className="text-xs text-faint">{t(`blockHints.${adding}`)}</p>
      </div>

      {block && (
        <BlockEditor
          key={block.id}
          block={block}
          langs={study.languages}
          patch={(p) => patch(block.id, p)}
          remove={() => {
            setBlocks((bs) => bs.filter((b) => b.id !== block.id));
            setSelected(study.blocks.find((b) => b.id !== block.id)?.id);
          }}
          allQuestions={study.blocks.flatMap((b) => (b.type === "questions" ? b.questions : []))}
        />
      )}
    </div>
  );
}

function BlockEditor({ block, langs, patch, remove, allQuestions }: { block: Block; langs: Lang[]; patch: (p: Partial<Block>) => void; remove: () => void; allQuestions: Question[] }) {
  const t = useTranslations("studio");
  const f = useTranslations("studio.fields");
  const title = "title" in block ? <L10nInput label={f("title")} value={block.title} onChange={(v) => patch({ title: v })} langs={langs} /> : null;
  return (
    <Panel
      title={t(`blocks.${block.type}`)}
      actions={
        <Button kind="danger" onClick={remove}>
          {t("flow.remove")}
        </Button>
      }
    >
      <p className="-mt-2 text-sm text-faint">{t(`blockHints.${block.type}`)}</p>
      {title}
      {block.type === "welcome" && (
        <>
          <L10nInput label={f("body")} value={block.body} onChange={(v) => patch({ body: v })} langs={langs} multiline />
          <L10nInput label={f("duration")} value={block.duration ?? {}} onChange={(v) => patch({ duration: v })} langs={langs} />
          <TextInput label={f("contact")} value={block.contact} onChange={(v) => patch({ contact: v })} dir="ltr" />
        </>
      )}
      {block.type === "consent" && (
        <>
          <L10nInput label={f("body")} value={block.body} onChange={(v) => patch({ body: v })} langs={langs} multiline />
          <L10nInput label={f("agree")} value={block.agree} onChange={(v) => patch({ agree: v })} langs={langs} />
          <L10nInput label={f("decline")} value={block.decline} onChange={(v) => patch({ decline: v })} langs={langs} />
          <TextInput label={f("consentVersion")} value={block.version} onChange={(v) => patch({ version: v })} dir="ltr" />
        </>
      )}
      {block.type === "instructions" && (
        <>
          <L10nInput label={f("body")} value={block.body} onChange={(v) => patch({ body: v })} langs={langs} multiline />
          <MediaInput label={f("image")} value={block.image} onChange={(v) => patch({ image: v })} />
        </>
      )}
      {block.type === "media" && <MediaItems block={block} langs={langs} patch={patch} />}
      {block.type === "shop" && <L10nInput label={f("body")} value={block.body} onChange={(v) => patch({ body: v })} langs={langs} multiline />}
      {block.type === "end" && (
        <>
          <L10nInput label={f("body")} value={block.body} onChange={(v) => patch({ body: v })} langs={langs} multiline />
          <TextInput label={f("code")} value={block.code} onChange={(v) => patch({ code: v })} dir="ltr" />
          <TextInput label={f("redirect")} value={block.redirect} onChange={(v) => patch({ redirect: v })} dir="ltr" placeholder="https://" />
        </>
      )}
      {block.type === "questions" && <QuestionList block={block} langs={langs} patch={patch} allQuestions={allQuestions} />}
    </Panel>
  );
}

function MediaItems({ block, langs, patch }: { block: Extract<Block, { type: "media" }>; langs: Lang[]; patch: (p: Partial<Block>) => void }) {
  const f = useTranslations("studio.fields");
  const items: (MediaRef | undefined)[] = [...block.items, undefined];
  return (
    <>
      <L10nInput label={f("body")} value={block.body} onChange={(v) => patch({ body: v })} langs={langs} multiline />
      <div className="flex flex-col gap-4">
        <span className="text-[13px] font-medium text-mist">{f("media")}</span>
        {items.map((m, i) => (
          <MediaInput
            key={`${i}-${m ?? "new"}`}
            label={`${i + 1}`}
            value={m}
            accept="image/*,video/mp4,video/webm"
            onChange={(v) => {
              const next = [...block.items];
              if (v) next[i] = v;
              else next.splice(i, 1);
              patch({ items: next.filter(Boolean) as MediaRef[] });
            }}
          />
        ))}
      </div>
      <NumberInput label={f("minSeconds")} value={block.minSeconds} onChange={(v) => patch({ minSeconds: v })} step="1" />
    </>
  );
}

function QuestionList({ block, langs, patch, allQuestions }: { block: Extract<Block, { type: "questions" }>; langs: Lang[]; patch: (p: Partial<Block>) => void; allQuestions: Question[] }) {
  const [type, setType] = useState<Question["type"]>("single");
  const [open, setOpen] = useState<string | null>(block.questions[0]?.id ?? null);
  const set = (qs: Question[]) => patch({ questions: qs });
  // Variable names must be unique across the whole study.
  const taken = new Set(allQuestions.map((q) => q.variable));
  const nextVar = () => {
    let n = allQuestions.length + 1;
    while (taken.has(`q${n}`)) n++;
    return n;
  };
  return (
    <div className="flex flex-col gap-3">
      {block.questions.map((q, i) => (
        <QuestionEditor
          key={q.id}
          q={q}
          index={i}
          count={block.questions.length}
          langs={langs}
          open={open === q.id}
          toggle={() => setOpen(open === q.id ? null : q.id)}
          duplicateVar={allQuestions.filter((x) => x.variable === q.variable).length > 1}
          change={(nq) => set(block.questions.map((x) => (x.id === q.id ? nq : x)))}
          remove={() => set(block.questions.filter((x) => x.id !== q.id))}
          moveBy={(d) => set(move(block.questions, i, i + d))}
          duplicate={() => {
            const copy = { ...structuredClone(q), id: `${q.id}c${Date.now() % 1000}`, variable: `q${nextVar()}` };
            set([...block.questions.slice(0, i + 1), copy, ...block.questions.slice(i + 1)]);
            setOpen(copy.id);
          }}
        />
      ))}
      <AddQuestion
        onAdd={(ty) => {
          const q = newQuestion(ty, nextVar());
          set([...block.questions, q]);
          setOpen(q.id);
        }}
        type={type}
        setType={setType}
      />
    </div>
  );
}

function AddQuestion({ onAdd, type, setType }: { onAdd: (t: Question["type"]) => void; type: Question["type"]; setType: (t: Question["type"]) => void }) {
  const t = useTranslations("studio.q");
  const qt = useTranslations("studio.qtypes");
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-line-3 p-3">
      <div className="min-w-[200px] flex-1">
        <Select label={t("type")} value={type} onChange={setType} options={QUESTION_TYPES.map((k) => [k, qt(k)] as [Question["type"], string])} />
      </div>
      <Button onClick={() => onAdd(type)}>
        {Icon.plus}
        {t("add")}
      </Button>
    </div>
  );
}
