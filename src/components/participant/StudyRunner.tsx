"use client";
/**
 * Renders a study for participants (live / test) and for researcher preview.
 * The flow is driven entirely by the study configuration and the participant's
 * assignment (condition, factors, block orders), resolved by lib/study/flow.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StudyConfig, isQuestionBlock, type Block, type Language } from "@/lib/study/schema";
import { validateBlockAnswers, type AnswerError } from "@/lib/study/answers";
import { dirFor, lt } from "@/lib/study/text";
import {
  EMPTY_ASSIGNMENT,
  contextFor,
  evalLogic,
  nextStepIndex,
  pipe,
  previewAssignment,
  resolveSteps,
  type Assignment,
  type Step,
} from "@/lib/study/flow";
import { seededShuffle } from "@/lib/random";
import { Alert, Button, cx } from "@/components/ui";
import { QuestionView } from "./QuestionView";
import { MediaView } from "./MediaView";
import { makeTr, type ParticipantMessages, type Tr } from "./i18n";
import { EventLogger, type EventData, type EventType } from "./events";
import { AdExposureView } from "./environment/AdExposureView";
import { StoreChoiceView } from "./environment/StoreChoiceView";
import { VillageView } from "./environment/VillageView";
import { validateShopAnswer, validateStoreChoice, validateVillageAnswer } from "@/lib/study/envAnswers";
import { ShopView } from "./environment/ShopView";

type Mode = "live" | "test" | "preview";
type Phase = "loading" | "language" | "block" | "declined" | "withdrawn" | "screened" | "completed" | "error";

interface Props {
  mode: Mode;
  slug?: string;
  /** Config shown before a session starts (and the only config in preview mode). */
  config: StudyConfig;
  messages: Record<Language, ParticipantMessages>;
  params?: Record<string, string>;
  initialMediaUrls?: Record<string, string>;
  /** Test links / preview: force a condition or factor values. */
  overrides?: Partial<Assignment>;
  previewLanguage?: Language;
}

type Answers = Record<string, Record<string, unknown>>;
type ApiResult<T> = T & { ok: boolean; error?: string; errors?: Record<string, AnswerError> };

function deviceClass(): "mobile" | "tablet" | "desktop" {
  const w = window.innerWidth;
  return w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

async function api<T>(action: string, body: unknown): Promise<ApiResult<T>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`/api/p/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return await res.json();
    } catch {
      if (attempt === 1) break;
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  return { ok: false, error: "network" } as ApiResult<T>;
}

function fillRedirect(url: string, vars: Record<string, string>) {
  return url.replace(/\{([A-Za-z0-9_]+)\}/g, (m, k: string) => (k in vars ? encodeURIComponent(vars[k]) : m));
}

export function StudyRunner({ mode, slug, config: initialConfig, messages, params: initialParams = {}, initialMediaUrls = {}, overrides, previewLanguage }: Props) {
  const storageKey = slug ? `rp:${slug}:${mode}` : "";
  const isPreview = mode === "preview";
  const [config, setConfig] = useState(initialConfig);
  const langs = config.settings.languages;
  const [lang, setLang] = useState<Language>(previewLanguage ?? config.settings.defaultLanguage);
  const fallback = langs.find((l) => l !== lang) ?? lang;
  const tr = useMemo(() => makeTr(messages[lang]), [messages, lang]);

  const [previewOverrides, setPreviewOverrides] = useState<Partial<Assignment>>({});
  const [assignment, setAssignment] = useState<Assignment>(() =>
    isPreview ? previewAssignment(initialConfig, "preview") : EMPTY_ASSIGNMENT,
  );
  const [params, setParams] = useState<Record<string, string>>(initialParams);
  const [session, setSession] = useState<{ id: string; token: string; isTest: boolean } | null>(null);
  const seed = session?.id ?? "preview";
  const steps = useMemo(() => resolveSteps(config, assignment, seed), [config, assignment, seed]);

  const [phase, setPhase] = useState<Phase>(isPreview ? "block" : "loading");
  const [index, setIndex] = useState(() => (isPreview ? Math.max(0, nextStepIndex(initialConfig, resolveSteps(initialConfig, previewAssignment(initialConfig, "preview"), "preview"), -1, previewAssignment(initialConfig, "preview"), {}, initialParams)) : 0));
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, AnswerError>>({});
  const [identifier, setIdentifier] = useState("");
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>(initialMediaUrls);
  const [completionCode, setCompletionCode] = useState<string | null>(null);
  const [screenMessage, setScreenMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const enteredAt = useRef<string>(new Date().toISOString());
  const enteredPerf = useRef<number>(0);
  const completedRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const logger = useRef<EventLogger | null>(null);

  const step: Step | undefined = steps[index];
  const block: Block | undefined = step ? config.blocks.find((b) => b.id === step.blockId) : undefined;
  const ctx = useMemo(() => contextFor(assignment, answers, params, step), [assignment, answers, params, step]);
  const t = useCallback((x: Parameters<typeof lt>[0]) => pipe(lt(x, lang, fallback), config, assignment, step, lang, fallback), [lang, fallback, config, assignment, step]);

  const logEvent = useCallback(
    (type: EventType, data?: EventData) => logger.current?.log(type, step?.key, data),
    [step?.key],
  );

  const save = useCallback(
    (s: { id: string; token: string; isTest: boolean } | null) => {
      if (!storageKey) return;
      try {
        if (s) localStorage.setItem(storageKey, JSON.stringify(s));
        else localStorage.removeItem(storageKey);
      } catch {
        // Private browsing: resume after refresh is simply unavailable.
      }
    },
    [storageKey],
  );

  const attachLogger = (s: { id: string; token: string }, cfg: StudyConfig) => {
    logger.current?.stop();
    logger.current = new EventLogger(s, cfg.settings.events);
    logger.current.start();
  };
  useEffect(() => () => logger.current?.stop(), []);

  const startSession = useCallback(
    async (language: Language) => {
      setBusy(true);
      setProblem(null);
      const r = await api<{
        sessionId: string;
        token: string;
        isTest: boolean;
        config: unknown;
        assignment: Assignment;
        params: Record<string, string>;
        index: number;
        mediaUrls: Record<string, string>;
      }>("start", { slug, language, test: mode === "test", params: initialParams, device: deviceClass(), overrides: overrides ?? {} });
      setBusy(false);
      if (!r.ok) {
        setProblem(r.error ?? "network");
        setPhase("error");
        return;
      }
      const parsed = StudyConfig.safeParse(r.config);
      const cfg = parsed.success ? parsed.data : initialConfig;
      setConfig(cfg);
      const s = { id: r.sessionId, token: r.token, isTest: r.isTest };
      setSession(s);
      setAssignment(r.assignment);
      setParams(r.params ?? {});
      if (cfg.settings.allowResume) save(s);
      attachLogger(s, cfg);
      setMediaUrls(r.mediaUrls);
      setLang(language);
      setIndex(r.index);
      enteredAt.current = new Date().toISOString();
      setPhase("block");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, initialParams, overrides, save, slug, initialConfig],
  );

  // Initial load: resume an existing session or start / ask for language.
  useEffect(() => {
    if (isPreview) return;
    let cancelled = false;
    (async () => {
      let stored: { id: string; token: string; isTest: boolean } | null = null;
      try {
        stored = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      } catch {
        stored = null;
      }
      if (stored && initialConfig.settings.allowResume) {
        const r = await api<{
          status: string;
          language: Language;
          index: number;
          config: unknown;
          assignment: Assignment;
          params: Record<string, string>;
          responses: Answers;
          completionCode: string | null;
          mediaUrls: Record<string, string>;
        }>("resume", { sessionId: stored.id, token: stored.token });
        if (cancelled) return;
        const parsed = r.ok ? StudyConfig.safeParse(r.config) : null;
        if (parsed?.success && (r.status === "in_progress" || r.status === "completed")) {
          setConfig(parsed.data);
          setLang(r.language);
          setSession(stored);
          setAssignment(r.assignment);
          setParams(r.params ?? {});
          setAnswers(r.responses ?? {});
          setMediaUrls(r.mediaUrls ?? {});
          const st = resolveSteps(parsed.data, r.assignment, stored.id);
          if (r.status === "completed") {
            completedRef.current = true;
            setCompletionCode(r.completionCode);
            setIndex(Math.max(0, st.findIndex((x) => parsed.data.blocks.find((b) => b.id === x.blockId)?.type === "end")));
            setPhase("completed");
          } else {
            attachLogger(stored, parsed.data);
            setIndex(Math.min(r.index, st.length - 1));
            enteredAt.current = new Date().toISOString();
            setPhase("block");
          }
          return;
        }
        save(null);
      }
      if (cancelled) return;
      if (initialConfig.settings.languages.length > 1) setPhase("language");
      else void startSession(initialConfig.settings.languages[0]);
    })();
    return () => {
      cancelled = true;
    };
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each new step: focus its heading, note the time, log block_enter.
  useEffect(() => {
    if (phase !== "block" || !step) return;
    headingRef.current?.focus();
    enteredPerf.current = performance.now();
    logger.current?.log("block_enter", step.key, { index });
  }, [index, phase, step]);

  // Completing happens when the End block is shown.
  useEffect(() => {
    if (phase !== "block" || block?.type !== "end" || completedRef.current) return;
    completedRef.current = true;
    if (isPreview || !session) return;
    void (async () => {
      const r = await api<{ completionCode: string | null }>("complete", { sessionId: session.id, token: session.token });
      if (!r.ok) {
        completedRef.current = false;
        setProblem(r.error ?? "network");
        return;
      }
      setCompletionCode(r.completionCode);
      await logger.current?.flush();
    })();
  }, [phase, block, isPreview, session]);

  const code = block?.type === "end" ? (block.uniqueCode ? completionCode : (block.completionCode ?? null)) : null;

  // Optional redirect from the End block (e.g. back to a participant panel).
  useEffect(() => {
    if (block?.type !== "end" || !block.redirectUrl || isPreview) return;
    if (!(phase === "block" || phase === "completed")) return;
    if (block.uniqueCode && !completionCode) return;
    const url = fillRedirect(block.redirectUrl, { ...params, session: session?.id ?? "", code: code ?? "" });
    const timer = setTimeout(() => window.location.assign(url), 4000);
    return () => clearTimeout(timer);
  }, [block, phase, isPreview, params, session, code, completionCode]);

  const goTo = (next: number) => {
    setErrors({});
    setIdentifier("");
    setIndex(next < 0 ? Math.max(0, steps.length - 1) : next);
    enteredAt.current = new Date().toISOString();
    window.scrollTo({ top: 0 });
  };

  const leave = () => logger.current?.log("block_leave", step?.key, { ms: Math.round(performance.now() - enteredPerf.current) });

  const screenOut = (b: Block) => {
    setScreenMessage(b.type === "screening" ? t(b.screenedOutMessage) : b.type === "exclusion_check" ? t(b.excludedMessage) : "");
    save(null);
    void logger.current?.flush();
    setPhase("screened");
  };

  const submitBlock = async (envValue?: unknown) => {
    if (!block || !step) return;
    setProblem(null);
    let payload: Record<string, unknown> = {};
    if (block.type === "village" || block.type === "store_choice" || block.type === "online_shop") {
      const v =
        block.type === "village"
          ? validateVillageAnswer(block, config, assignment, envValue)
          : block.type === "online_shop"
            ? validateShopAnswer(block, config, assignment, envValue)
            : validateStoreChoice(block, envValue);
      if (!v.ok) return setErrors({ [block.variable]: v.error as AnswerError });
      payload = { [block.variable]: v.value };
    }
    if (isQuestionBlock(block)) {
      const v = validateBlockAnswers(block, answers[step.key] ?? {});
      if (!v.ok) {
        setErrors(v.errors);
        const first = block.questions.find((q) => v.errors[q.variable]);
        if (first) document.getElementById(`q_${first.id}`)?.scrollIntoView({ block: "center" });
        return;
      }
      payload = v.answers;
    }
    if (block.type === "exclusion_check") {
      const ok = block.inputKind === "email" ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim()) : identifier.trim().length >= 3;
      if (!ok) return setErrors({ identifier: "invalid" });
    }
    const nextAnswers = { ...answers, [step.key]: payload };

    if (isPreview || !session) {
      if (block.type === "screening" && !evalLogic(block.eligibleIf, contextFor(assignment, nextAnswers, params, step))) return screenOut(block);
      setAnswers(nextAnswers);
      return goTo(nextStepIndex(config, steps, index, assignment, nextAnswers, params));
    }
    setBusy(true);
    leave();
    const r = await api<{ index: number; screenedOut?: boolean }>("submit", {
      sessionId: session.id,
      token: session.token,
      stepKey: step.key,
      answers: payload,
      identifier: block.type === "exclusion_check" ? identifier.trim() : undefined,
      enteredAt: enteredAt.current,
    });
    setBusy(false);
    if (!r.ok) {
      if (r.errors) setErrors(r.errors);
      else setProblem(r.error ?? "network");
      return;
    }
    setAnswers(nextAnswers);
    if (r.screenedOut) return screenOut(block);
    goTo(r.index);
  };

  const consent = async (decision: "given" | "declined") => {
    if (!block || !step) return;
    if (isPreview || !session) {
      if (decision === "declined") setPhase("declined");
      else goTo(nextStepIndex(config, steps, index, assignment, answers, params));
      return;
    }
    setBusy(true);
    setProblem(null);
    leave();
    const r = await api<{ index: number }>("consent", { sessionId: session.id, token: session.token, stepKey: step.key, decision });
    setBusy(false);
    if (!r.ok) return setProblem(r.error ?? "network");
    if (decision === "declined") {
      save(null);
      void logger.current?.flush();
      setPhase("declined");
    } else goTo(r.index);
  };

  const withdraw = async () => {
    if (!isPreview && session) {
      setBusy(true);
      const r = await api("withdraw", { sessionId: session.id, token: session.token });
      setBusy(false);
      if (!r.ok) return setProblem(r.error ?? "network");
      logger.current?.stop();
      logger.current = null;
    }
    save(null);
    setConfirmWithdraw(false);
    setPhase("withdrawn");
  };

  const [previewSeed, setPreviewSeed] = useState("preview");
  const applyPreview = (o: Partial<Assignment>, newSeed?: string) => {
    const merged = { ...previewOverrides, ...o, factors: { ...previewOverrides.factors, ...o.factors } };
    setPreviewOverrides(merged);
    const a = previewAssignment(config, newSeed ?? previewSeed, merged);
    setAssignment(a);
    setAnswers({});
    completedRef.current = false;
    setPhase("block");
    setIndex(Math.max(0, nextStepIndex(config, resolveSteps(config, a, "preview"), -1, a, {}, params)));
  };

  const total = steps.length;
  const consentIndex = steps.findIndex((s) => config.blocks.find((b) => b.id === s.blockId)?.type === "consent");
  const canWithdraw = phase === "block" && block?.type !== "end" && (consentIndex < 0 || index > consentIndex);

  // ---------------------------------------------------------------------------

  // In preview the studio layout already provides <main>; landmarks must not nest.
  const Main = isPreview ? "div" : "main";
  const shell = (content: React.ReactNode) => (
    <div lang={lang} dir={dirFor(lang)} className="min-h-screen bg-paper">
      {mode !== "live" && (
        <section aria-label={tr(isPreview ? "previewBanner" : "testBanner")}>
          <div className={cx("px-4 py-2 text-center text-sm", isPreview ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent-strong")}>
            {isPreview ? tr("previewBanner") : tr("testBanner")}
          </div>
      {isPreview && (
        <PreviewBar
          config={config}
          steps={steps}
          assignment={assignment}
          lang={lang}
          index={index}
          onLang={setLang}
          onAssign={applyPreview}
          onReshuffle={() => {
            const s = crypto.randomUUID();
            setPreviewSeed(s);
            applyPreview({}, s);
          }}
          onJump={(i) => {
            completedRef.current = false;
            setPhase("block");
            setErrors({});
            setIndex(i);
          }}
          tr={tr}
        />
      )}
        </section>
      )}
      <Main>
      {config.settings.showProgress && phase === "block" && total > 1 && (
        <div className="h-1.5 w-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={total - 1} aria-valuenow={index} aria-label={tr("progress")}>
          <div className="h-full bg-accent transition-all" style={{ width: `${(index / (total - 1)) * 100}%` }} />
        </div>
      )}
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:py-12">{content}</div>
      </Main>
    </div>
  );

  const apiMessage = (p: string | null) => (tr(`apiError_${p}`) === `apiError_${p}` ? tr("apiError_network") : tr(`apiError_${p}`));

  if (phase === "loading") return shell(<p className="text-center text-muted" role="status">{tr("loading")}</p>);

  if (phase === "error") {
    return shell(
      <div className="flex flex-col gap-4">
        <Alert tone="danger">{apiMessage(problem)}</Alert>
        {problem !== "studyFull" && <Button onClick={() => window.location.reload()}>{tr("retry")}</Button>}
      </div>,
    );
  }

  if (phase === "language") {
    return (
      <div className="min-h-screen bg-paper">
        <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-16">
          <h1 className="text-center text-xl font-semibold">
            <span lang="en">{messages.en.chooseLanguage}</span>
            <span className="mx-2 text-muted">·</span>
            <span lang="ar" dir="rtl">
              {messages.ar.chooseLanguage}
            </span>
          </h1>
          {langs.map((l) => (
            <Button key={l} disabled={busy} onClick={() => startSession(l)} className="py-3 text-base" lang={l}>
              {l === "ar" ? "العربية" : "English"}
            </Button>
          ))}
          {mode === "test" && <p className="text-center text-sm text-accent-strong">{messages[lang].testBanner}</p>}
        </main>
      </div>
    );
  }

  if (phase === "declined") {
    const c = config.blocks.find((b) => b.type === "consent");
    return shell(
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{tr("thankYou")}</h1>
        <p className="prose-study">{c && c.type === "consent" ? t(c.declinedMessage) : tr("declined")}</p>
      </section>,
    );
  }

  if (phase === "screened") {
    return shell(
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{tr("thankYou")}</h1>
        <p className="prose-study">{screenMessage || tr("screenedOut")}</p>
        {isPreview && (
          <Button variant="secondary" className="self-start" onClick={() => applyPreview({})}>
            {tr("previewRestart")}
          </Button>
        )}
      </section>,
    );
  }

  if (phase === "withdrawn") {
    return shell(
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{tr("withdrawnTitle")}</h1>
        <p>{tr("withdrawnBody")}</p>
      </section>,
    );
  }

  if (!block || !step) return shell(<Alert tone="danger">{tr("apiError_configInvalid")}</Alert>);

  const heading = (text: string) => (
    <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold leading-snug outline-none">
      {text}
    </h1>
  );
  const srHeading = (text: string) => (
    <h1 ref={headingRef} tabIndex={-1} className="sr-only">
      {text}
    </h1>
  );

  const nextButton = (label = tr("next"), disabled = false) => (
    <div className="flex justify-end">
      <Button onClick={() => void submitBlock()} disabled={busy || disabled} className="min-w-32 py-3 text-base">
        {busy ? tr("saving") : label}
      </Button>
    </div>
  );

  let body: React.ReactNode;
  switch (block.type) {
    case "welcome":
      body = (
        <section className="flex flex-col gap-4">
          {heading(t(block.heading))}
          <div className="prose-study text-lg">{t(block.body)}</div>
          {block.estimatedMinutes && <p className="text-sm text-muted">{tr("estimatedMinutes", { n: block.estimatedMinutes })}</p>}
          {block.contact && t(block.contact) && (
            <p className="prose-study text-sm text-muted">
              <span className="font-medium">{tr("contact")}: </span>
              {t(block.contact)}
            </p>
          )}
          {nextButton(tr("start"))}
        </section>
      );
      break;
    case "instructions":
    case "debrief":
      body = (
        <section className="flex flex-col gap-4">
          {t(block.heading) ? heading(t(block.heading)) : srHeading(tr("questions"))}
          <div className="prose-study text-lg">{t(block.body)}</div>
          {block.type === "instructions" &&
            block.media.map((m) => (
              <MediaView key={m.assetId} item={m} url={mediaUrls[m.storagePath]} lang={lang} fallback={fallback} onEvent={logEvent} />
            ))}
          {nextButton()}
        </section>
      );
      break;
    case "consent":
      body = (
        <section className="flex flex-col gap-4">
          {heading(t(block.heading))}
          <div className="prose-study max-h-[60vh] overflow-y-auto rounded-lg border border-line bg-surface p-4">{t(block.body)}</div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" disabled={busy} onClick={() => consent("declined")} className="py-3">
              {t(block.declineLabel)}
            </Button>
            <Button disabled={busy} onClick={() => consent("given")} className="py-3">
              {t(block.agreeLabel)}
            </Button>
          </div>
        </section>
      );
      break;
    case "exclusion_check":
      body = (
        <section className="flex flex-col gap-4">
          {block.heading && t(block.heading) ? heading(t(block.heading)) : srHeading(t(block.prompt))}
          <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
            <label htmlFor="identifier" className="mb-1 block text-lg font-medium">
              {t(block.prompt)}
            </label>
            {block.help && t(block.help) && <p className="mb-2 text-sm text-muted">{t(block.help)}</p>}
            <input
              id="identifier"
              type={block.inputKind === "email" ? "email" : "text"}
              autoComplete={block.inputKind === "email" ? "email" : "off"}
              dir="ltr"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              aria-invalid={!!errors.identifier}
              className="w-full rounded-lg border border-line bg-surface px-3 py-3 text-base"
            />
            <p className="mt-2 text-xs text-muted">{tr("identifierPrivacy")}</p>
            {errors.identifier && (
              <p role="alert" className="mt-2 text-sm text-danger">
                {tr("err_invalid")}
              </p>
            )}
            {isPreview && <p className="mt-2 text-xs text-warn">{tr("previewExclusion")}</p>}
          </div>
          {nextButton()}
        </section>
      );
      break;
    case "questionnaire":
    case "demographics":
    case "screening": {
      const qs = block.randomizeQuestions ? seededShuffle(block.questions, `${seed}:${step.key}`) : block.questions;
      const blockAnswers = answers[step.key] ?? {};
      body = (
        <section className="flex flex-col gap-6">
          {block.heading && t(block.heading) ? heading(t(block.heading)) : srHeading(tr("questions"))}
          {block.intro && t(block.intro) && <p className="prose-study text-muted">{t(block.intro)}</p>}
          {Object.keys(errors).length > 0 && <Alert tone="danger">{tr("fixErrors")}</Alert>}
          {qs.map((q) => (
            <div key={q.id} id={`q_${q.id}`} className="rounded-xl border border-line bg-surface p-4 sm:p-5">
              <QuestionView
                q={q}
                lang={lang}
                fallback={fallback}
                value={blockAnswers[q.variable]}
                onChange={(v) => {
                  setAnswers((a) => ({ ...a, [step.key]: { ...(a[step.key] ?? {}), [q.variable]: v } }));
                  if (errors[q.variable]) setErrors(({ [q.variable]: _, ...rest }) => rest);
                }}
                error={errors[q.variable]}
                seed={seed}
                mediaUrls={mediaUrls}
                tr={tr}
                pipeText={(s) => pipe(s, config, assignment, step, lang, fallback)}
              />
            </div>
          ))}
          {nextButton()}
        </section>
      );
      break;
    }
    case "media": {
      const items = block.items.filter((item) => evalLogic(item.showIf, ctx));
      body = (
        <MediaBlockView
          key={step.key}
          block={block}
          items={items}
          title={t(block.heading)}
          lang={lang}
          fallback={fallback}
          mediaUrls={mediaUrls}
          tr={tr}
          heading={heading}
          srHeading={srHeading}
          nextButton={nextButton}
          onEvent={logEvent}
        />
      );
      break;
    }
    case "ad_exposure":
      body = (
        <AdExposureView
          key={step.key}
          block={block}
          config={config}
          assignment={assignment}
          seed={seed}
          lang={lang}
          fallback={fallback}
          mediaUrls={mediaUrls}
          tr={tr}
          t={t}
          log={logEvent}
          busy={busy}
          onDone={() => void submitBlock()}
          heading={heading}
        />
      );
      break;
    case "store_choice":
      body = (
        <StoreChoiceView
          key={step.key}
          block={block}
          config={config}
          assignment={assignment}
          seed={seed}
          lang={lang}
          fallback={fallback}
          mediaUrls={mediaUrls}
          tr={tr}
          t={t}
          log={logEvent}
          busy={busy}
          error={errors[block.variable]}
          onSubmit={(v) => void submitBlock(v)}
          heading={heading}
        />
      );
      break;
    case "online_shop":
      body = (
        <ShopView
          key={step.key}
          block={block}
          config={config}
          assignment={assignment}
          seed={seed}
          lang={lang}
          fallback={fallback}
          mediaUrls={mediaUrls}
          tr={tr}
          t={t}
          log={logEvent}
          busy={busy}
          error={errors[block.variable]}
          onSubmit={(v) => void submitBlock(v)}
          heading={heading}
        />
      );
      break;
    case "village":
      body = (
        <VillageView
          key={step.key}
          block={block}
          config={config}
          assignment={assignment}
          seed={seed}
          lang={lang}
          fallback={fallback}
          mediaUrls={mediaUrls}
          tr={tr}
          t={t}
          log={logEvent}
          busy={busy}
          error={errors[block.variable]}
          onSubmit={(v) => void submitBlock(v)}
          heading={heading}
        />
      );
      break;
    case "end":
      body = (
        <section className="flex flex-col gap-4">
          {heading(t(block.heading))}
          <div className="prose-study text-lg">{t(block.body)}</div>
          {(code || (block.uniqueCode && !isPreview)) && (
            <div className="rounded-xl border border-accent/30 bg-accent-soft p-4">
              <p className="text-sm">{tr("completionCode")}</p>
              <p className="mt-1 select-all font-mono text-2xl font-semibold tracking-wider" dir="ltr">
                {code ?? "…"}
              </p>
            </div>
          )}
          {block.uniqueCode && isPreview && <p className="text-sm text-muted">{tr("previewUniqueCode")}</p>}
          {block.redirectUrl && !isPreview && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">{tr("redirecting")}</p>
              <a
                href={fillRedirect(block.redirectUrl, { ...params, session: session?.id ?? "", code: code ?? "" })}
                className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
              >
                {tr("continue")}
              </a>
            </div>
          )}
          {block.redirectUrl && isPreview && <p className="text-sm text-muted">{tr("previewRedirect", { url: block.redirectUrl })}</p>}
        </section>
      );
      break;
  }

  return shell(
    <>
      {problem && <Alert tone="danger">{apiMessage(problem)}</Alert>}
      {body}
      {canWithdraw && (
        <footer className="mt-8 border-t border-line pt-4 text-sm">
          {!confirmWithdraw ? (
            <button type="button" className="text-muted underline hover:text-ink" onClick={() => setConfirmWithdraw(true)}>
              {tr("withdraw")}
            </button>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
              <p>{tr("withdrawConfirm")}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="danger" size="sm" disabled={busy} onClick={withdraw}>
                  {tr("withdrawYes")}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setConfirmWithdraw(false)}>
                  {tr("withdrawNo")}
                </Button>
              </div>
            </div>
          )}
        </footer>
      )}
    </>,
  );
}

function MediaBlockView({
  block,
  items,
  title,
  lang,
  fallback,
  mediaUrls,
  tr,
  heading,
  srHeading,
  nextButton,
  onEvent,
}: {
  block: Extract<Block, { type: "media" }>;
  items: Extract<Block, { type: "media" }>["items"];
  title: string;
  lang: Language;
  fallback: Language;
  mediaUrls: Record<string, string>;
  tr: Tr;
  heading: (text: string) => React.ReactNode;
  srHeading: (text: string) => React.ReactNode;
  nextButton: (label?: string, disabled?: boolean) => React.ReactNode;
  onEvent: (type: EventType, data?: EventData) => void;
}) {
  const [remaining, setRemaining] = useState(block.minViewSeconds);
  const [ended, setEnded] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);
  const playable = items.filter((i) => i.kind !== "image");
  const mustWatch = block.requireVideoEnd && playable.some((i) => !ended.has(i.assetId));
  return (
    <section className="flex flex-col gap-4">
      {title ? heading(title) : srHeading(tr("media"))}
      {items.map((item) => (
        <MediaView
          key={item.assetId}
          item={item}
          url={mediaUrls[item.storagePath]}
          lang={lang}
          fallback={fallback}
          autoplay={block.autoplay}
          controls={block.showControls}
          onEnded={() => setEnded((s) => new Set(s).add(item.assetId))}
          onEvent={onEvent}
        />
      ))}
      {remaining > 0 && (
        <p className="text-center text-sm text-muted" aria-live="polite">
          {tr("waitSeconds", { n: remaining })}
        </p>
      )}
      {remaining <= 0 && mustWatch && <p className="text-center text-sm text-muted">{tr("watchToEnd")}</p>}
      {nextButton(tr("next"), remaining > 0 || mustWatch)}
    </section>
  );
}

function PreviewBar({
  config,
  steps,
  assignment,
  lang,
  index,
  onLang,
  onJump,
  onAssign,
  onReshuffle,
  tr,
}: {
  config: StudyConfig;
  steps: Step[];
  assignment: Assignment;
  lang: Language;
  index: number;
  onLang: (l: Language) => void;
  onJump: (i: number) => void;
  onAssign: (o: Partial<Assignment>) => void;
  onReshuffle: () => void;
  tr: Tr;
}) {
  const d = config.design;
  const label = (s: Step) => {
    const b = config.blocks.find((x) => x.id === s.blockId);
    const heading = b && "heading" in b ? lt(b.heading, lang) : "";
    const name = b?.name || heading || b?.type || s.blockId;
    return s.iteration ? `${name} · ${lt(s.iteration.label, lang)}` : name;
  };
  const sel = "rounded-md border border-line bg-surface px-2 py-1";
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-b border-line bg-surface px-4 py-2 text-sm">
      <label className="flex items-center gap-2">
        <span>{tr("previewBlock")}</span>
        <select value={index} onChange={(e) => onJump(Number(e.target.value))} className={sel}>
          {steps.map((s, i) => (
            <option key={s.key} value={i}>
              {i + 1}. {label(s)}
            </option>
          ))}
        </select>
      </label>
      {d.conditions.length > 1 && (
        <label className="flex items-center gap-2">
          <span>{tr("previewCondition")}</span>
          <select value={assignment.condition ?? ""} onChange={(e) => onAssign({ condition: e.target.value })} className={sel}>
            {d.conditions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label || c.id}
              </option>
            ))}
          </select>
        </label>
      )}
      {d.factors
        .filter((f) => f.kind === "pick")
        .map((f) => (
          <label key={f.id} className="flex items-center gap-2">
            <span dir="ltr">{f.variable}</span>
            <select
              value={String(assignment.factors[f.variable] ?? "")}
              onChange={(e) => onAssign({ factors: { [f.variable]: e.target.value } })}
              className={sel}
            >
              {f.levels.map((l) => (
                <option key={l.id} value={l.value}>
                  {lt(l.label, lang) || l.value}
                </option>
              ))}
            </select>
          </label>
        ))}
      {(d.factors.some((f) => f.kind !== "pick") || d.orderGroups.length > 0) && (
        <button type="button" className={sel} onClick={onReshuffle}>
          {tr("previewReshuffle")}
        </button>
      )}
      {config.settings.languages.length > 1 && (
        <div className="flex gap-1">
          {config.settings.languages.map((l) => (
            <button key={l} type="button" onClick={() => onLang(l)} className={cx("rounded-md px-2 py-1", l === lang ? "bg-accent text-white" : "border border-line")}>
              {l === "ar" ? "العربية" : "English"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
