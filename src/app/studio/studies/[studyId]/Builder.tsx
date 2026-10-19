"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { StudyConfig, isQuestionBlock, type Block, type BlockType, type Language } from "@/lib/study/schema";
import { newBlock, nextVariable, shortId, usedVariables } from "@/lib/study/factories";
import {
  deleteStudy,
  duplicateStudy,
  lockVersion,
  logWarningDismissal,
  publishStudy,
  renameStudy,
  saveDraft,
  setStudyStatus,
} from "@/lib/actions/studio";
import type { StudyStatus } from "@/lib/data";
import { Alert, Badge, Button, Card, Field, Input, Select, cx } from "@/components/ui";
import { FlowList } from "@/components/builder/FlowList";
import { BlockEditor } from "@/components/builder/BlockEditor";
import { Checkbox, moveItem } from "@/components/builder/controls";
import { DesignEditor } from "@/components/builder/DesignEditor";
import { activeWarnings } from "@/lib/study/warnings";
import { LibraryProvider } from "@/components/builder/LibraryContext";
import type { LibrarySnapshot } from "@/lib/study/library";
import { StatusBadge } from "../../StatusBadge";

const ADDABLE: BlockType[] = [
  "welcome",
  "consent",
  "screening",
  "exclusion_check",
  "instructions",
  "questionnaire",
  "media",
  "ad_exposure",
  "store_choice",
  "village",
  "demographics",
  "debrief",
  "end",
];

interface Props {
  study: { id: string; title: string; status: StudyStatus; slug: string; projectId: string; projectName: string };
  initialConfig: StudyConfig;
  versions: { id: string; version_number: number; locked: boolean; published_at: string }[];
  library: LibrarySnapshot;
}

type SaveState = "saved" | "dirty" | "saving" | "error";

export function Builder(props: Props) {
  return (
    <LibraryProvider value={props.library}>
      <BuilderInner {...props} />
    </LibraryProvider>
  );
}

function BuilderInner({ study, initialConfig, versions }: Props) {
  const t = useTranslations("builder");
  const te = useTranslations("errors");
  const locale = useLocale() as Language;
  const router = useRouter();
  const [config, setConfig] = useState<StudyConfig>(initialConfig);
  const [selectedId, setSelectedId] = useState<string | null>(initialConfig.blocks[0]?.id ?? null);
  const [tab, setTab] = useState<"flow" | "design" | "settings" | "share">("flow");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [publishMsg, setPublishMsg] = useState<{ tone: "ok" | "danger" | "neutral"; text: string; issues?: { path: string; message: string }[] } | null>(null);
  const [pending, start] = useTransition();
  const [addType, setAddType] = useState<BlockType>("questionnaire");
  const configRef = useRef(config);
  configRef.current = config;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const langs = config.settings.languages;
  const uiLang: Language = langs.includes(locale) ? locale : langs[0];

  // Live validation against the full schema (publishing requires it to pass).
  const validation = useMemo(() => StudyConfig.safeParse(config), [config]);
  // Methodological warnings use the normalised config when it is valid.
  const warnings = useMemo(() => (validation.success ? activeWarnings(validation.data) : []), [validation]);
  const dismissWarning = (id: string) => {
    update({ ...config, settings: { ...config.settings, dismissedWarnings: [...config.settings.dismissedWarnings, id] } });
    void logWarningDismissal(study.id, id);
  };
  const restoreWarnings = () => {
    for (const id of config.settings.dismissedWarnings) void logWarningDismissal(study.id, id, true);
    update({ ...config, settings: { ...config.settings, dismissedWarnings: [] } });
  };
  const issues = validation.success ? [] : validation.error.issues;
  const issuesByBlock = useMemo(() => {
    const out: Record<string, number> = {};
    for (const i of issues) {
      if (i.path[0] === "blocks" && typeof i.path[1] === "number") {
        const id = config.blocks[i.path[1]]?.id;
        if (id) out[id] = (out[id] ?? 0) + 1;
      }
    }
    return out;
  }, [issues, config.blocks]);

  const doSave = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    setSaveState("saving");
    const r = await saveDraft(study.id, configRef.current);
    setSaveState(r.ok ? "saved" : "error");
    return r.ok;
  }, [study.id]);

  const update = (next: StudyConfig) => {
    setConfig(next);
    setSaveState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void doSave(), 1500);
  };

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saveState === "dirty" || saveState === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void doSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doSave]);

  const setBlocks = (blocks: Block[]) => update({ ...config, blocks });
  const selected = config.blocks.find((b) => b.id === selectedId) ?? null;

  const duplicateBlock = (id: string) => {
    const i = config.blocks.findIndex((b) => b.id === id);
    const copy = structuredClone(config.blocks[i]);
    copy.id = shortId("b");
    if (isQuestionBlock(copy)) {
      const used = usedVariables(config);
      copy.questions = copy.questions.map((q) => {
        const variable = nextVariable(used, q.variable.replace(/\d+$/, "") || "q");
        used.add(variable.toLowerCase());
        return { ...q, id: shortId("q"), variable };
      });
    }
    const blocks = [...config.blocks];
    blocks.splice(i + 1, 0, copy);
    setBlocks(blocks);
    setSelectedId(copy.id);
  };

  const addBlock = () => {
    const b = newBlock(addType, config);
    const endIdx = config.blocks.findIndex((x) => x.type === "end");
    const blocks = [...config.blocks];
    // New blocks go before the End block by default; the researcher can move them anywhere.
    blocks.splice(endIdx >= 0 && addType !== "end" ? endIdx : blocks.length, 0, b);
    setBlocks(blocks);
    setSelectedId(b.id);
  };

  const publish = () =>
    start(async () => {
      setPublishMsg(null);
      if (saveState !== "saved" && !(await doSave())) return setPublishMsg({ tone: "danger", text: te("saveFailed") });
      const r = await publishStudy(study.id);
      if (!r.ok) {
        setPublishMsg({ tone: "danger", text: te(r.error), issues: r.issues });
        return;
      }
      setPublishMsg({
        tone: r.created ? "ok" : "neutral",
        text: r.created ? t("published", { n: r.version ?? 0 }) : t("unchanged", { n: r.version ?? 0 }),
      });
      setTab("share");
      router.refresh();
    });

  const preview = () =>
    start(async () => {
      if (saveState !== "saved") await doSave();
      router.push(`/studio/studies/${study.id}/preview?lang=${uiLang}`);
    });

  const saveLabel = { saved: t("save.saved"), dirty: t("save.dirty"), saving: t("save.saving"), error: t("save.error") }[saveState];

  return (
    <div className="flex flex-col gap-5">
      <nav className="text-sm text-muted">
        <Link href="/studio" className="hover:underline">
          {t("crumbDashboard")}
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/studio/projects/${study.projectId}`} className="hover:underline" dir="auto">
          {study.projectName}
        </Link>
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <TitleEditor studyId={study.id} title={study.title} />
          <StatusBadge status={study.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cx("text-xs", saveState === "error" ? "text-danger" : saveState === "dirty" ? "text-warn" : "text-muted")}
            role="status"
            aria-live="polite"
          >
            {saveLabel}
          </span>
          <Button variant="secondary" size="sm" onClick={() => void doSave()} disabled={saveState === "saving" || saveState === "saved"}>
            {t("saveNow")}
          </Button>
          <Button variant="secondary" size="sm" onClick={preview} disabled={pending}>
            {t("preview")}
          </Button>
          <Link href={`/studio/studies/${study.id}/data`} className="rounded-lg border border-line bg-surface px-2.5 py-1 text-sm hover:bg-paper">
            {t("data")}
          </Link>
          <Button size="sm" onClick={publish} disabled={pending}>
            {versions.length ? t("publishChanges") : t("publish")}
          </Button>
        </div>
      </header>

      {publishMsg && (
        <Alert tone={publishMsg.tone}>
          {publishMsg.text}
          {publishMsg.issues && (
            <ul className="mt-2 list-disc ps-5">
              {publishMsg.issues.slice(0, 10).map((i, n) => (
                <li key={n}>
                  <code dir="ltr">{i.path}</code>: {i.message}
                </li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      <div role="tablist" className="flex gap-1 border-b border-line">
        {(["flow", "design", "settings", "share"] as const).map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cx("-mb-px border-b-2 px-3 py-2 text-sm font-medium", tab === k ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink")}
          >
            {t(`tabs.${k}`)}
            {k === "flow" && issues.length > 0 && <span className="ms-1.5 rounded-full bg-danger-soft px-1.5 text-xs text-danger">{issues.length}</span>}
            {k === "flow" && warnings.length > 0 && <span className="ms-1 rounded-full bg-warn-soft px-1.5 text-xs text-warn">{warnings.length}</span>}
          </button>
        ))}
      </div>

      {tab === "flow" && (
        <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
          <section aria-label={t("flow.label")} className="flex flex-col gap-3">
            <p className="text-xs text-muted">{t("flow.hint")}</p>
            <FlowList
              blocks={config.blocks}
              selectedId={selectedId}
              issuesByBlock={issuesByBlock}
              lang={uiLang}
              onSelect={setSelectedId}
              onReorder={(from, to) => setBlocks(moveItem(config.blocks, from, to))}
              onDuplicate={duplicateBlock}
              onRemove={(id) => {
                setBlocks(config.blocks.filter((b) => b.id !== id));
                if (selectedId === id) setSelectedId(null);
              }}
            />
            <div className="flex items-center gap-2">
              <label htmlFor="add-block" className="sr-only">
                {t("flow.blockType")}
              </label>
              <Select id="add-block" value={addType} onChange={(e) => setAddType(e.target.value as BlockType)} className="flex-1">
                {ADDABLE.map((bt) => (
                  <option key={bt} value={bt}>
                    {t(`blockTypes.${bt}`)}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" onClick={addBlock}>
                {t("flow.add")}
              </Button>
            </div>
            <p className="text-xs text-muted">{t("flow.moreBlocksLater")}</p>
            {issues.length > 0 && (
              <Card className="p-3">
                <p className="mb-2 text-sm font-medium text-danger">{t("issuesTitle", { n: issues.length })}</p>
                <ul className="flex flex-col gap-1 text-xs">
                  {issues.slice(0, 12).map((i, n) => {
                    const b = i.path[0] === "blocks" && typeof i.path[1] === "number" ? config.blocks[i.path[1]] : null;
                    return (
                      <li key={n}>
                        {b ? (
                          <button type="button" className="text-start underline" onClick={() => setSelectedId(b.id)}>
                            {(i.path[1] as number) + 1}. {t(`blockTypes.${b.type}`)}
                          </button>
                        ) : (
                          <code dir="ltr">{i.path.join(".") || "study"}</code>
                        )}
                        : {i.message}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
            {(warnings.length > 0 || config.settings.dismissedWarnings.length > 0) && (
              <Card className="p-3">
                <p className="mb-1 text-sm font-medium text-warn">{t("warnings.title", { n: warnings.length })}</p>
                <p className="mb-2 text-xs text-muted">{t("warnings.hint")}</p>
                <ul className="flex flex-col gap-2 text-xs">
                  {warnings.map((w) => (
                    <li key={w.id} className="rounded-md bg-warn-soft p-2">
                      <p className="font-medium text-warn">{t(`warnings.rules.${w.rule}.title`, w.params ?? {})}</p>
                      <p className="mt-0.5 text-ink">{t(`warnings.rules.${w.rule}.why`, w.params ?? {})}</p>
                      <div className="mt-1 flex gap-3">
                        {w.blockId && (
                          <button type="button" className="underline" onClick={() => setSelectedId(w.blockId!)}>
                            {t("warnings.show")}
                          </button>
                        )}
                        <button type="button" className="underline" onClick={() => dismissWarning(w.id)}>
                          {t("warnings.dismiss")}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                {config.settings.dismissedWarnings.length > 0 && (
                  <button type="button" className="mt-2 text-xs underline" onClick={restoreWarnings}>
                    {t("warnings.restore", { n: config.settings.dismissedWarnings.length })}
                  </button>
                )}
              </Card>
            )}
          </section>
          <section aria-label={t("editor")} className="min-w-0">
            {selected ? (
              <Card>
                <h2 className="mb-4 font-semibold">{t(`blockTypes.${selected.type}`)}</h2>
                <BlockEditor
                  key={selected.id}
                  block={selected}
                  config={config}
                  onChange={(b) => setBlocks(config.blocks.map((x) => (x.id === b.id ? b : x)))}
                />
              </Card>
            ) : (
              <Card>
                <p className="text-sm text-muted">{t("selectBlock")}</p>
              </Card>
            )}
          </section>
        </div>
      )}

      {tab === "design" && <DesignEditor config={config} onChange={update} />}

      {tab === "settings" && <SettingsTab config={config} onChange={update} />}

      {tab === "share" && <ShareTab study={study} versions={versions} conditions={config.design.conditions.map((c) => ({ id: c.id, label: c.label }))} />}
    </div>
  );
}

function TitleEditor({ studyId, title }: { studyId: string; title: string }) {
  const t = useTranslations("builder");
  const [value, setValue] = useState(title);
  const [editing, setEditing] = useState(false);
  const [, start] = useTransition();
  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="truncate text-start text-2xl font-semibold hover:underline" title={t("rename")} dir="auto">
        {value}
      </button>
    );
  }
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await renameStudy(studyId, value);
          if (r.ok) setEditing(false);
        });
      }}
    >
      <label htmlFor="study-title" className="sr-only">
        {t("rename")}
      </label>
      <Input id="study-title" value={value} onChange={(e) => setValue(e.target.value)} maxLength={200} autoFocus dir="auto" />
      <Button type="submit" size="sm">
        {t("saveNow")}
      </Button>
    </form>
  );
}

function SettingsTab({ config, onChange }: { config: StudyConfig; onChange: (c: StudyConfig) => void }) {
  const t = useTranslations("builder.settings");
  const s = config.settings;
  const set = (patch: Partial<StudyConfig["settings"]>) => onChange({ ...config, settings: { ...s, ...patch } });
  const langValue = s.languages.length === 2 ? "both" : s.languages[0];
  return (
    <Card className="flex max-w-2xl flex-col gap-5">
      <Field label={t("languages")} htmlFor="st-langs" hint={t("languagesHint")}>
        <Select
          id="st-langs"
          value={langValue}
          onChange={(e) => {
            const v = e.target.value;
            const languages: Language[] = v === "both" ? (s.defaultLanguage === "ar" ? ["ar", "en"] : ["en", "ar"]) : [v as Language];
            set({ languages, defaultLanguage: languages.includes(s.defaultLanguage) ? s.defaultLanguage : languages[0] });
          }}
        >
          <option value="both">{t("both")}</option>
          <option value="en">{t("en")}</option>
          <option value="ar">{t("ar")}</option>
        </Select>
      </Field>
      {s.languages.length > 1 && (
        <Field label={t("defaultLanguage")} htmlFor="st-default">
          <Select id="st-default" value={s.defaultLanguage} onChange={(e) => set({ defaultLanguage: e.target.value as Language })}>
            {s.languages.map((l) => (
              <option key={l} value={l}>
                {t(l)}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Checkbox label={t("showProgress")} checked={s.showProgress} onChange={(v) => set({ showProgress: v })} />
      <Checkbox label={t("allowResume")} hint={t("allowResumeHint")} checked={s.allowResume} onChange={(v) => set({ allowResume: v })} />
      <Checkbox label={t("usesDeception")} hint={t("usesDeceptionHint")} checked={s.usesDeception} onChange={(v) => set({ usesDeception: v })} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("events")}</legend>
        <Checkbox label={t("eventsNavigation")} hint={t("eventsNavigationHint")} checked={s.events.navigation} onChange={(v) => set({ events: { ...s.events, navigation: v } })} />
        <Checkbox label={t("eventsMedia")} hint={t("eventsMediaHint")} checked={s.events.media} onChange={(v) => set({ events: { ...s.events, media: v } })} />
        <Checkbox label={t("eventsEnvironment")} hint={t("eventsEnvironmentHint")} checked={s.events.environment} onChange={(v) => set({ events: { ...s.events, environment: v } })} />
        <p className="text-xs text-muted">{t("eventsNever")}</p>
      </fieldset>
      <p className="text-xs text-muted">{t("themeNote")}</p>
    </Card>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const t = useTranslations("builder.share");
  const [copied, setCopied] = useState(false);
  return (
    <Field label={label} htmlFor={`copy-${label}`}>
      <div className="flex gap-2">
        <Input id={`copy-${label}`} readOnly value={value} dir="ltr" onFocus={(e) => e.target.select()} />
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? t("copied") : t("copy")}
        </Button>
      </div>
    </Field>
  );
}

function ShareTab({
  study,
  versions,
  conditions,
}: {
  study: Props["study"];
  versions: Props["versions"];
  conditions: { id: string; label: string }[];
}) {
  const t = useTranslations("builder.share");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [origin, setOrigin] = useState("");
  const [testCondition, setTestCondition] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/s/${study.slug}`;
  const run = (fn: () => Promise<{ ok: boolean; error?: string } | void>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r && !r.ok && r.error) setError(te(r.error));
    });
  const published = versions.length > 0;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold">{t("links")}</h2>
        {!published ? (
          <p className="text-sm text-muted">{t("notPublished")}</p>
        ) : (
          <>
            <CopyField label={t("publicLink")} value={url} />
            <p className="text-xs text-muted">{t("paramsHint")}</p>
            {conditions.length > 1 && (
              <Field label={t("testCondition")} htmlFor="test-cond">
                <Select id="test-cond" value={testCondition} onChange={(e) => setTestCondition(e.target.value)}>
                  <option value="">{t("testConditionRandom")}</option>
                  {conditions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label || c.id}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <CopyField label={t("testLink")} value={`${url}?test=1${testCondition ? `&condition=${testCondition}` : ""}`} />
            <p className="text-xs text-muted">{t("testHint")}</p>
          </>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold">{t("status")}</h2>
        <div className="flex items-center gap-2">
          <StatusBadge status={study.status} />
          <span className="text-sm text-muted">{t(`statusHelp.${study.status}`)}</span>
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex flex-wrap gap-2">
          {study.status === "active" && (
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => setStudyStatus(study.id, "paused"))}>
              {t("pause")}
            </Button>
          )}
          {(study.status === "paused" || study.status === "closed") && (
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => setStudyStatus(study.id, "active"))}>
              {t("activate")}
            </Button>
          )}
          {study.status !== "closed" && study.status !== "draft" && (
            <Button variant="danger" size="sm" disabled={pending} onClick={() => run(() => setStudyStatus(study.id, "closed"))}>
              {t("close")}
            </Button>
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("versions")}</h2>
        {versions.length === 0 ? (
          <p className="text-sm text-muted">{t("noVersions")}</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {t("version", { n: v.version_number })}
                  <span className="ms-2 text-xs text-muted">{new Date(v.published_at).toLocaleString(locale)}</span>
                </span>
                {v.locked ? (
                  <Badge tone="accent">{t("locked")}</Badge>
                ) : (
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => lockVersion(study.id, v.id))} title={t("lockHint")}>
                    {t("lock")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">{t("versionsHint")}</p>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("manage")}</h2>
        <Button variant="secondary" size="sm" className="self-start" disabled={pending} onClick={() => run(() => duplicateStudy(study.id, `${study.title} ${t("copySuffix")}`))}>
          {t("duplicate")}
        </Button>
        <div className="flex flex-col gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3">
          <p className="text-sm text-danger">{t("deleteWarning")}</p>
          <Field label={t("typeTitle", { title: study.title })} htmlFor="del-study">
            <Input id="del-study" value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} dir="auto" />
          </Field>
          <Button variant="danger" size="sm" className="self-start" disabled={pending || confirmDelete.trim() !== study.title} onClick={() => run(() => deleteStudy(study.id, confirmDelete))}>
            {t("delete")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
