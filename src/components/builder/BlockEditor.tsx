"use client";
/**
 * Block editor registry. Each block type maps to one editor component; the
 * `Record<BlockType, ...>` type makes TypeScript flag any block type that is
 * added to the schema without an editor.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Block, BlockType, Language, Logic, MediaRef, Question, QuestionType, StudyConfig } from "@/lib/study/schema";
import { BLOCK_ROLES, QUESTION_TYPES } from "@/lib/study/schema";
import { LogicEditor } from "./LogicEditor";
import { AdExposureEditor, StoreChoiceEditor, VillageEditor } from "./EnvironmentEditors";
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

type ListItem = MediaRef & { caption?: import("@/lib/study/schema").LocalizedText; showIf?: Logic };

function MediaList({
  items,
  kinds,
  languages,
  onChange,
  withCaption,
  logicConfig,
  blockId,
}: {
  items: ListItem[];
  kinds: ("image" | "video" | "audio")[];
  languages: Language[];
  onChange: (items: ListItem[]) => void;
  withCaption?: boolean;
  /** When given, each item gets its own "show only when" rule. */
  logicConfig?: StudyConfig;
  blockId?: string;
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
          {logicConfig && (
            <LogicEditor
              label={t("itemShowIf")}
              hint={t("itemShowIfHint")}
              logic={m.showIf}
              config={logicConfig}
              beforeBlockId={blockId}
              allowIteration
              onChange={(l) => onChange(items.map((x, k) => (k === i ? { ...x, showIf: l } : x)))}
            />
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

function MediaBlockEditor({ block, config, languages, onChange }: EditorProps<"media">) {
  const t = useTranslations("builder.block");
  return (
    <>
      <LocalizedField label={t("heading")} value={block.heading} languages={languages} onChange={(v) => onChange({ ...block, heading: v })} />
      <MediaList
        items={block.items}
        kinds={["image", "video", "audio"]}
        languages={languages}
        withCaption
        logicConfig={config}
        blockId={block.id}
        onChange={(items) => onChange({ ...block, items })}
      />
      <NumberField label={t("minViewSeconds")} value={block.minViewSeconds} min={0} max={3600} onChange={(v) => onChange({ ...block, minViewSeconds: v ?? 0 })} />
      <Checkbox label={t("requireVideoEnd")} checked={block.requireVideoEnd} onChange={(v) => onChange({ ...block, requireVideoEnd: v })} />
      <Checkbox label={t("autoplay")} hint={t("autoplayHint")} checked={block.autoplay} onChange={(v) => onChange({ ...block, autoplay: v })} />
      <Checkbox label={t("showControls")} checked={block.showControls} onChange={(v) => onChange({ ...block, showControls: v })} />
    </>
  );
}

function QuestionnaireEditor({ block, config, languages, onChange }: EditorProps<"questionnaire" | "demographics" | "screening">) {
  const t = useTranslations("builder.block");
  const tq = useTranslations("builder.question");
  const [open, setOpen] = useState<string | null>(block.questions[0]?.id ?? null);
  const [newType, setNewType] = useState<QuestionType>("likert");
  const setQs = (questions: Question[]) => onChange({ ...block, questions });
  return (
    <>
      <LocalizedField label={t("heading")} value={block.heading} languages={languages} onChange={(v) => onChange({ ...block, heading: v })} />
      <LocalizedField label={t("intro")} hint={t("pipingHint")} value={block.intro} languages={languages} multiline onChange={(v) => onChange({ ...block, intro: v })} />
      <Checkbox label={t("randomizeQuestions")} checked={block.randomizeQuestions} onChange={(v) => onChange({ ...block, randomizeQuestions: v })} />
      {block.type === "questionnaire" && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`role-${block.id}`} className="text-sm font-medium">
            {t("role")}
          </label>
          <Select id={`role-${block.id}`} value={block.role} onChange={(e) => onChange({ ...block, role: e.target.value as (typeof BLOCK_ROLES)[number] })}>
            {BLOCK_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted">{t("roleHint")}</p>
        </div>
      )}

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
      <Checkbox label={t("uniqueCode")} hint={t("uniqueCodeHint")} checked={block.uniqueCode} onChange={(v) => onChange({ ...block, uniqueCode: v })} />
      {!block.uniqueCode && (
        <TextField label={t("completionCode")} hint={t("completionCodeHint")} value={block.completionCode ?? ""} dir="ltr" mono onChange={(v) => onChange({ ...block, completionCode: v.trim() ? v.slice(0, 100) : undefined })} />
      )}
      <TextField label={t("redirectUrl")} hint={t("redirectUrlHint")} value={block.redirectUrl ?? ""} dir="ltr" onChange={(v) => onChange({ ...block, redirectUrl: v.trim() || undefined })} />
    </>
  );
}

function ScreeningEditor(props: EditorProps<"screening">) {
  const t = useTranslations("builder.block");
  const { block, config, languages, onChange } = props;
  return (
    <>
      <QuestionnaireEditor {...(props as EditorProps<"questionnaire" | "demographics" | "screening">)} />
      <LogicEditor
        label={t("eligibleIf")}
        hint={t("eligibleIfHint")}
        logic={block.eligibleIf}
        config={config}
        onChange={(l) => onChange({ ...block, eligibleIf: l })}
      />
      <LocalizedField label={t("screenedOutMessage")} value={block.screenedOutMessage} languages={languages} multiline onChange={(v) => onChange({ ...block, screenedOutMessage: v })} />
    </>
  );
}

function DebriefEditor({ block, languages, onChange }: EditorProps<"debrief">) {
  const t = useTranslations("builder.block");
  return (
    <>
      <p className="rounded-lg bg-paper p-3 text-sm text-muted">{t("debriefHint")}</p>
      <LocalizedField label={t("heading")} value={block.heading} languages={languages} onChange={(v) => onChange({ ...block, heading: v })} />
      <LocalizedField label={t("body")} value={block.body} languages={languages} multiline rows={8} onChange={(v) => onChange({ ...block, body: v })} />
    </>
  );
}

const listKeys = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter((x) => /^[a-z0-9-]{3,40}$/.test(x))
    .slice(0, 10);

function ExclusionCheckEditor({ block, languages, onChange }: EditorProps<"exclusion_check">) {
  const t = useTranslations("builder.block");
  const [exclude, setExclude] = useState(block.excludeLists.join(", "));
  return (
    <>
      <p className="rounded-lg bg-paper p-3 text-sm text-muted">{t("exclusionHint")}</p>
      <LocalizedField label={t("heading")} value={block.heading} languages={languages} onChange={(v) => onChange({ ...block, heading: v })} />
      <LocalizedField label={t("prompt")} value={block.prompt} languages={languages} onChange={(v) => onChange({ ...block, prompt: v })} />
      <LocalizedField label={t("helpText")} value={block.help} languages={languages} multiline rows={2} onChange={(v) => onChange({ ...block, help: v })} />
      <div className="flex flex-col gap-1">
        <label htmlFor={`kind-${block.id}`} className="text-sm font-medium">
          {t("inputKind")}
        </label>
        <Select id={`kind-${block.id}`} value={block.inputKind} onChange={(e) => onChange({ ...block, inputKind: e.target.value as "email" | "text" })}>
          <option value="email">{t("inputKinds.email")}</option>
          <option value="text">{t("inputKinds.text")}</option>
        </Select>
      </div>
      <TextField
        label={t("recordList")}
        hint={t("recordListHint")}
        value={block.recordList ?? ""}
        dir="ltr"
        mono
        onChange={(v) => {
          const k = v.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
          onChange({ ...block, recordList: k.length >= 3 ? k : undefined });
        }}
      />
      <TextField
        label={t("excludeLists")}
        hint={t("excludeListsHint")}
        value={exclude}
        dir="ltr"
        mono
        onChange={(v) => {
          setExclude(v);
          onChange({ ...block, excludeLists: listKeys(v) });
        }}
      />
      <LocalizedField label={t("excludedMessage")} value={block.excludedMessage} languages={languages} multiline onChange={(v) => onChange({ ...block, excludedMessage: v })} />
    </>
  );
}

const EDITORS: { [K in BlockType]: (p: EditorProps<K>) => React.ReactNode } = {
  ad_exposure: AdExposureEditor,
  store_choice: StoreChoiceEditor,
  village: VillageEditor,
  welcome: WelcomeEditor,
  consent: ConsentEditor,
  screening: ScreeningEditor,
  exclusion_check: ExclusionCheckEditor,
  instructions: InstructionsEditor,
  questionnaire: QuestionnaireEditor as (p: EditorProps<"questionnaire">) => React.ReactNode,
  demographics: QuestionnaireEditor as (p: EditorProps<"demographics">) => React.ReactNode,
  media: MediaBlockEditor,
  debrief: DebriefEditor,
  end: EndEditor,
};

/** Who sees the block, when, in what order, and how often. Shared by every block type. */
function DisplayLogic({ block, config, onChange }: { block: Block; config: StudyConfig; onChange: (b: Block) => void }) {
  const t = useTranslations("builder.display");
  const d = config.design;
  const fixed = block.type === "consent" || block.type === "end" || block.type === "village" || block.type === "store_choice";
  const summary = [
    block.showTo.length ? t("summaryConditions", { list: block.showTo.join(", ") }) : null,
    block.showIf ? t("summaryRule") : null,
    block.repeat ? t("summaryRepeat") : null,
    block.orderGroup ? t("summaryGroup", { id: block.orderGroup }) : null,
  ].filter(Boolean);
  return (
    <details className="rounded-lg border border-line" open={summary.length > 0}>
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
        {t("title")}
        {summary.length > 0 && <span className="ms-2 text-xs font-normal text-muted">{summary.join(" · ")}</span>}
      </summary>
      <div className="flex flex-col gap-4 border-t border-line p-3">
        {d.conditions.length > 1 && (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium">{t("showTo")}</legend>
            <div className="flex flex-wrap gap-3">
              {d.conditions.map((c) => (
                <Checkbox
                  key={c.id}
                  label={c.label || c.id}
                  checked={block.showTo.includes(c.id)}
                  onChange={(v) => onChange({ ...block, showTo: v ? [...block.showTo, c.id] : block.showTo.filter((x) => x !== c.id) })}
                />
              ))}
            </div>
            <p className="text-xs text-muted">{t("showToHint")}</p>
          </fieldset>
        )}
        {d.conditions.length < 2 && <p className="text-xs text-muted">{t("noConditions")}</p>}

        <LogicEditor
          label={t("showIf")}
          hint={t("showIfHint")}
          logic={block.showIf}
          config={config}
          beforeBlockId={block.id}
          allowIteration={!!block.repeat}
          onChange={(l) => onChange({ ...block, showIf: l })}
        />

        {!fixed && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={`rep-${block.id}`} className="text-sm font-medium">
                {t("repeat")}
              </label>
              <Select
                id={`rep-${block.id}`}
                value={block.repeat?.factorId ?? ""}
                onChange={(e) =>
                  onChange({ ...block, repeat: e.target.value ? { factorId: e.target.value, order: block.repeat?.order ?? "assigned" } : undefined })
                }
              >
                <option value="">{t("noRepeat")}</option>
                {d.factors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name || f.variable}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted">{t("repeatHint")}</p>
            </div>
            {block.repeat && (
              <div className="flex flex-col gap-1">
                <label htmlFor={`repo-${block.id}`} className="text-sm font-medium">
                  {t("repeatOrder")}
                </label>
                <Select
                  id={`repo-${block.id}`}
                  value={block.repeat.order}
                  onChange={(e) => onChange({ ...block, repeat: { ...block.repeat!, order: e.target.value as "assigned" | "listed" | "random" } })}
                >
                  <option value="assigned">{t("orders.assigned")}</option>
                  <option value="listed">{t("orders.listed")}</option>
                  <option value="random">{t("orders.random")}</option>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label htmlFor={`grp-${block.id}`} className="text-sm font-medium">
                {t("orderGroup")}
              </label>
              <Select id={`grp-${block.id}`} value={block.orderGroup ?? ""} onChange={(e) => onChange({ ...block, orderGroup: e.target.value || undefined })}>
                <option value="">{t("noGroup")}</option>
                {d.orderGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name || g.id}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted">{t("orderGroupHint")}</p>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

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
      <DisplayLogic block={block} config={config} onChange={onChange} />
      <Editor block={block as never} config={config} languages={config.settings.languages} onChange={onChange as never} />
    </div>
  );
}
