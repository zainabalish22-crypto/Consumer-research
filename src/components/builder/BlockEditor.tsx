"use client";
/**
 * Block editor registry. Each block type maps to one editor component; the
 * `Record<BlockType, ...>` type makes TypeScript flag any block type that is
 * added to the schema without an editor.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Block, BlockType, Language, MediaRef, Question, QuestionType, StudyConfig } from "@/lib/study/schema";
import { QUESTION_TYPES } from "@/lib/study/schema";
import { newQuestion, nextVariable, usedVariables, shortId } from "@/lib/study/factories";
import { Button, Select } from "@/components/ui";
import { LocalizedField } from "./LocalizedField";
import { Checkbox, IconButton, NumberField, TextField, moveItem } from "./controls";
import { QuestionEditor } from "./QuestionEditor";
import { MediaPicker } from "./MediaPicker";

type EditorProps<T extends BlockType> = {
  block: Extract<Block, { type: T }>;
  config: StudyConfig;
  languages: Language[];
  onChange: (b: Extract<Block, { type: T }>) => void;
};

function WelcomeEditor({ block, languages, onChange }: EditorProps<"welcome">) {
  const t = useTranslations("builder.block");
  return (
    <>
      <LocalizedField label={t("heading")} value={block.heading} languages={languages} onChange={(v) => onChange({ ...block, heading: v })} />
      <LocalizedField label={t("body")} value={block.body} languages={languages} multiline rows={5} onChange={(v) => onChange({ ...block, body: v })} />
      <NumberField label={t("estimatedMinutes")} value={block.estimatedMinutes} optional min={1} max={600} onChange={(v) => onChange({ ...block, estimatedMinutes: v })} />
      <LocalizedField label={t("contact")} value={block.contact} languages={languages} multiline rows={2} onChange={(v) => onChange({ ...block, contact: v })} />
    </>
  );
}

function ConsentEditor({ block, languages, onChange }: EditorProps<"consent">) {
  const t = useTranslations("builder.block");
  return (
    <>
      <p className="rounded-lg bg-paper p-3 text-sm text-muted">{t("consentHint")}</p>
      <LocalizedField label={t("heading")} value={block.heading} languages={languages} onChange={(v) => onChange({ ...block, heading: v })} />
      <LocalizedField label={t("consentText")} value={block.body} languages={languages} multiline rows={10} onChange={(v) => onChange({ ...block, body: v })} />
      <TextField label={t("consentVersion")} value={block.consentVersion} dir="ltr" hint={t("consentVersionHint")} onChange={(v) => onChange({ ...block, consentVersion: v.slice(0, 40) })} />
      <LocalizedField label={t("agreeLabel")} value={block.agreeLabel} languages={languages} onChange={(v) => onChange({ ...block, agreeLabel: v })} />
      <LocalizedField label={t("declineLabel")} value={block.declineLabel} languages={languages} onChange={(v) => onChange({ ...block, declineLabel: v })} />
      <LocalizedField label={t("declinedMessage")} value={block.declinedMessage} languages={languages} multiline onChange={(v) => onChange({ ...block, declinedMessage: v })} />
    </>
  );
}

function MediaList({
  items,
  kinds,
  languages,
  onChange,
  withCaption,
}: {
  items: (MediaRef & { caption?: import("@/lib/study/schema").LocalizedText })[];
  kinds: ("image" | "video" | "audio")[];
  languages: Language[];
  onChange: (items: (MediaRef & { caption?: import("@/lib/study/schema").LocalizedText })[]) => void;
  withCaption?: boolean;
}) {
  const t = useTranslations("builder.block");
  const [picking, setPicking] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{t("mediaItems")}</p>
      {items.length === 0 && <p className="text-sm text-muted">{t("noMedia")}</p>}
      {items.map((m, i) => (
        <div key={`${m.assetId}-${i}`} className="flex flex-col gap-2 rounded-lg border border-line p-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-paper px-2 py-0.5 text-xs uppercase text-muted">{m.kind}</span>
            <span className="flex-1 truncate text-sm" dir="auto">
              {m.storagePath.split("/").pop()}
            </span>
            <IconButton label={t("moveUp")} disabled={i === 0} onClick={() => onChange(moveItem(items, i, i - 1))}>
              ↑
            </IconButton>
            <IconButton label={t("moveDown")} disabled={i === items.length - 1} onClick={() => onChange(moveItem(items, i, i + 1))}>
              ↓
            </IconButton>
            <IconButton label={t("remove")} onClick={() => onChange(items.filter((_, k) => k !== i))}>
              ✕
            </IconButton>
          </div>
          <LocalizedField label={t("altText")} hint={t("altTextHint")} value={m.alt} languages={languages} onChange={(v) => onChange(items.map((x, k) => (k === i ? { ...x, alt: v } : x)))} />
          {withCaption && (
            <LocalizedField label={t("caption")} value={m.caption} languages={languages} onChange={(v) => onChange(items.map((x, k) => (k === i ? { ...x, caption: v } : x)))} />
          )}
        </div>
      ))}
      <Button variant="secondary" size="sm" className="self-start" onClick={() => setPicking(true)}>
        {t("addMedia")}
      </Button>
      {picking && (
        <MediaPicker
          kinds={kinds}
          onClose={() => setPicking(false)}
          onPick={(ref) => {
            onChange([...items, ref]);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

function InstructionsEditor({ block, languages, onChange }: EditorProps<"instructions">) {
  const t = useTranslations("builder.block");
  return (
    <>
      <LocalizedField label={t("heading")} value={block.heading} languages={languages} onChange={(v) => onChange({ ...block, heading: v })} />
      <LocalizedField label={t("body")} hint={t("plainTextHint")} value={block.body} languages={languages} multiline rows={6} onChange={(v) => onChange({ ...block, body: v })} />
      <MediaList items={block.media} kinds={["image"]} languages={languages} onChange={(media) => onChange({ ...block, media })} />
    </>
  );
}

function MediaBlockEditor({ block, languages, onChange }: EditorProps<"media">) {
  const t = useTranslations("builder.block");
  return (
    <>
      <LocalizedField label={t("heading")} value={block.heading} languages={languages} onChange={(v) => onChange({ ...block, heading: v })} />
      <MediaList items={block.items} kinds={["image", "video", "audio"]} languages={languages} withCaption onChange={(items) => onChange({ ...block, items })} />
      <NumberField label={t("minViewSeconds")} value={block.minViewSeconds} min={0} max={3600} onChange={(v) => onChange({ ...block, minViewSeconds: v ?? 0 })} />
      <Checkbox label={t("requireVideoEnd")} checked={block.requireVideoEnd} onChange={(v) => onChange({ ...block, requireVideoEnd: v })} />
      <Checkbox label={t("autoplay")} hint={t("autoplayHint")} checked={block.autoplay} onChange={(v) => onChange({ ...block, autoplay: v })} />
      <Checkbox label={t("showControls")} checked={block.showControls} onChange={(v) => onChange({ ...block, showControls: v })} />
    </>
  );
}

function QuestionnaireEditor({ block, config, languages, onChange }: EditorProps<"questionnaire" | "demographics">) {
  const t = useTranslations("builder.block");
  const tq = useTranslations("builder.question");
  const [open, setOpen] = useState<string | null>(block.questions[0]?.id ?? null);
  const [newType, setNewType] = useState<QuestionType>("likert");
  const setQs = (questions: Question[]) => onChange({ ...block, questions });
  return (
    <>
      <LocalizedField label={t("heading")} value={block.heading} languages={languages} onChange={(v) => onChange({ ...block, heading: v })} />
      <LocalizedField label={t("intro")} value={block.intro} languages={languages} multiline onChange={(v) => onChange({ ...block, intro: v })} />
      <Checkbox label={t("randomizeQuestions")} checked={block.randomizeQuestions} onChange={(v) => onChange({ ...block, randomizeQuestions: v })} />

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t("questions", { n: block.questions.length })}</p>
        {block.questions.map((q, i) => {
          const label = q.text[languages[0]] || q.text.en || q.text.ar || tq("untitled");
          return (
            <div key={q.id} className="rounded-lg border border-line">
              <div className="flex items-center gap-1 px-2 py-1">
                <button
                  type="button"
                  className="flex flex-1 items-center gap-2 py-1.5 text-start"
                  aria-expanded={open === q.id}
                  onClick={() => setOpen(open === q.id ? null : q.id)}
                >
                  <span className="font-mono text-xs text-muted" dir="ltr">
                    {q.variable}
                  </span>
                  <span className="truncate text-sm" dir="auto">
                    {label}
                  </span>
                  <span className="ms-auto shrink-0 rounded bg-paper px-1.5 text-xs text-muted">{tq(`types.${q.type}`)}</span>
                </button>
                <IconButton label={tq("moveUp")} disabled={i === 0} onClick={() => setQs(moveItem(block.questions, i, i - 1))}>
                  ↑
                </IconButton>
                <IconButton label={tq("moveDown")} disabled={i === block.questions.length - 1} onClick={() => setQs(moveItem(block.questions, i, i + 1))}>
                  ↓
                </IconButton>
                <IconButton
                  label={tq("duplicate")}
                  onClick={() => {
                    const copy = { ...structuredClone(q), id: shortId("q"), variable: nextVariable(usedVariables(config), q.variable.replace(/\d+$/, "") || "q") };
                    const qs = [...block.questions];
                    qs.splice(i + 1, 0, copy as Question);
                    setQs(qs);
                  }}
                >
                  ⧉
                </IconButton>
                <IconButton label={tq("remove")} onClick={() => setQs(block.questions.filter((x) => x.id !== q.id))}>
                  ✕
                </IconButton>
              </div>
              {open === q.id && (
                <div className="border-t border-line p-3">
                  <QuestionEditor q={q} languages={languages} onChange={(nq) => setQs(block.questions.map((x) => (x.id === q.id ? nq : x)))} />
                </div>
              )}
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`newq-${block.id}`} className="sr-only">
            {tq("type")}
          </label>
          <Select id={`newq-${block.id}`} className="w-auto" value={newType} onChange={(e) => setNewType(e.target.value as QuestionType)}>
            {QUESTION_TYPES.map((qt) => (
              <option key={qt} value={qt}>
                {tq(`types.${qt}`)}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const q = newQuestion(newType, nextVariable(usedVariables(config)));
              setQs([...block.questions, q]);
              setOpen(q.id);
            }}
          >
            {tq("add")}
          </Button>
        </div>
      </div>
    </>
  );
}

function EndEditor({ block, languages, onChange }: EditorProps<"end">) {
  const t = useTranslations("builder.block");
  return (
    <>
      <LocalizedField label={t("heading")} value={block.heading} languages={languages} onChange={(v) => onChange({ ...block, heading: v })} />
      <LocalizedField label={t("body")} value={block.body} languages={languages} multiline rows={4} onChange={(v) => onChange({ ...block, body: v })} />
      <TextField label={t("completionCode")} hint={t("completionCodeHint")} value={block.completionCode ?? ""} dir="ltr" mono onChange={(v) => onChange({ ...block, completionCode: v.trim() ? v.slice(0, 100) : undefined })} />
      <TextField label={t("redirectUrl")} hint={t("redirectUrlHint")} value={block.redirectUrl ?? ""} dir="ltr" onChange={(v) => onChange({ ...block, redirectUrl: v.trim() || undefined })} />
    </>
  );
}

const EDITORS: { [K in BlockType]: (p: EditorProps<K>) => React.ReactNode } = {
  welcome: WelcomeEditor,
  consent: ConsentEditor,
  instructions: InstructionsEditor,
  questionnaire: QuestionnaireEditor as (p: EditorProps<"questionnaire">) => React.ReactNode,
  demographics: QuestionnaireEditor as (p: EditorProps<"demographics">) => React.ReactNode,
  media: MediaBlockEditor,
  end: EndEditor,
};

export function BlockEditor({ block, config, onChange }: { block: Block; config: StudyConfig; onChange: (b: Block) => void }) {
  const t = useTranslations("builder.block");
  const Editor = EDITORS[block.type] as (p: EditorProps<BlockType>) => React.ReactNode;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label={t("internalName")} hint={t("internalNameHint")} value={block.name} dir="auto" onChange={(v) => onChange({ ...block, name: v.slice(0, 120) })} />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("blockId")}</span>
          <code className="rounded-lg bg-paper px-3 py-2 text-sm" dir="ltr">
            {block.id}
          </code>
          <p className="text-xs text-muted">{t("blockIdHint")}</p>
        </div>
      </div>
      <Editor block={block as never} config={config} languages={config.settings.languages} onChange={onChange as never} />
    </div>
  );
}
