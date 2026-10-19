"use client";
/**
 * Renders a study for participants (live / test) and for researcher preview.
 * The flow is driven entirely by the study configuration.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StudyConfig, isQuestionBlock, type Block, type Language } from "@/lib/study/schema";
import { validateBlockAnswers, type AnswerError } from "@/lib/study/answers";
import { dirFor, lt } from "@/lib/study/text";
import { seededShuffle } from "@/lib/random";
import { Alert, Button, cx } from "@/components/ui";
import { QuestionView } from "./QuestionView";
import { MediaView } from "./MediaView";
import { makeTr, type ParticipantMessages } from "./i18n";

type Mode = "live" | "test" | "preview";
type Phase = "loading" | "language" | "block" | "declined" | "withdrawn" | "completed" | "error";

interface Props {
  mode: Mode;
  slug?: string;
  /** Config shown before a session starts (and the only config in preview mode). */
  config: StudyConfig;
  messages: Record<Language, ParticipantMessages>;
  params?: Record<string, string>;
  initialMediaUrls?: Record<string, string>;
  /** Preview only: start at this language/block. */
  previewLanguage?: Language;
}

type Answers = Record<string, Record<string, unknown>>;

function deviceClass(): "mobile" | "tablet" | "desktop" {
  const w = window.innerWidth;
  return w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

async function api<T>(action: string, body: unknown): Promise<T & { ok: boolean; error?: string; errors?: Record<string, AnswerError> }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`/api/p/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      return json;
    } catch {
      if (attempt === 1) return { ok: false, error: "network" } as T & { ok: boolean; error: string };
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  return { ok: false, error: "network" } as T & { ok: boolean; error: string };
}

export function StudyRunner({ mode, slug, config: initialConfig, messages, params = {}, initialMediaUrls = {}, previewLanguage }: Props) {
  const storageKey = slug ? `rp:${slug}:${mode}` : "";
  const [config, setConfig] = useState(initialConfig);
  const langs = config.settings.languages;
  const [lang, setLang] = useState<Language>(previewLanguage ?? config.settings.defaultLanguage);
  const fallback = langs.find((l) => l !== lang) ?? lang;
  const tr = useMemo(() => makeTr(messages[lang]), [messages, lang]);

  const [phase, setPhase] = useState<Phase>(mode === "preview" ? "block" : "loading");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, AnswerError>>({});
  const [session, setSession] = useState<{ id: string; token: string; isTest: boolean } | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>(initialMediaUrls);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const enteredAt = useRef<string>(new Date().toISOString());
  const completedRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const block: Block | undefined = config.blocks[index];
  const seed = session?.id ?? "preview";

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

  const startSession = useCallback(
    async (language: Language) => {
      setBusy(true);
      setProblem(null);
      const r = await api<{ sessionId: string; token: string; isTest: boolean; config: unknown; mediaUrls: Record<string, string> }>(
        "start",
        { slug, language, test: mode === "test", params, device: deviceClass() },
      );
      setBusy(false);
      if (!r.ok) {
        setProblem(r.error ?? "network");
        setPhase("error");
        return;
      }
      const parsed = StudyConfig.safeParse(r.config);
      if (parsed.success) setConfig(parsed.data);
      const s = { id: r.sessionId, token: r.token, isTest: r.isTest };
      setSession(s);
      if (parsed.success && parsed.data.settings.allowResume) save(s);
      setMediaUrls(r.mediaUrls);
      setLang(language);
      setIndex(0);
      enteredAt.current = new Date().toISOString();
      setPhase("block");
    },
    [mode, params, save, slug],
  );

  // Initial load: resume an existing session or start / ask for language.
  useEffect(() => {
    if (mode === "preview") return;
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
          responses: Answers;
          mediaUrls: Record<string, string>;
        }>("resume", { sessionId: stored.id, token: stored.token });
        if (cancelled) return;
        if (r.ok && (r.status === "in_progress" || r.status === "completed")) {
          const parsed = StudyConfig.safeParse(r.config);
          if (parsed.success) {
            setConfig(parsed.data);
            setLang(r.language);
            setSession(stored);
            setAnswers(r.responses ?? {});
            setMediaUrls(r.mediaUrls ?? {});
            if (r.status === "completed") {
              completedRef.current = true;
              setIndex(Math.max(0, parsed.data.blocks.findIndex((b) => b.type === "end")));
              setPhase("completed");
            } else {
              setIndex(Math.min(r.index, parsed.data.blocks.length - 1));
              enteredAt.current = new Date().toISOString();
              setPhase("block");
            }
            return;
          }
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

  // Move focus to the new block heading for screen-reader and keyboard users.
  useEffect(() => {
    if (phase === "block") headingRef.current?.focus();
  }, [index, phase]);

  // Completing happens when the End block is shown.
  useEffect(() => {
    if (phase !== "block" || block?.type !== "end" || completedRef.current) return;
    completedRef.current = true;
    if (mode === "preview" || !session) return;
    void (async () => {
      const r = await api("complete", { sessionId: session.id, token: session.token });
      if (!r.ok) {
        completedRef.current = false;
        setProblem(r.error ?? "network");
      }
    })();
  }, [phase, block, mode, session]);

  // Optional redirect from the End block (e.g. back to a participant panel).
  useEffect(() => {
    if (block?.type !== "end" || !block.redirectUrl || mode === "preview") return;
    if (!(phase === "block" || phase === "completed")) return;
    const t = setTimeout(() => window.location.assign(block.redirectUrl!), 4000);
    return () => clearTimeout(t);
  }, [block, phase, mode]);

  const advanceLocal = (next?: number) => {
    setErrors({});
    setIndex((i) => Math.min(next ?? i + 1, config.blocks.length - 1));
    enteredAt.current = new Date().toISOString();
    window.scrollTo({ top: 0 });
  };

  const submitBlock = async () => {
    if (!block) return;
    setProblem(null);
    let payload: Record<string, unknown> = {};
    if (isQuestionBlock(block)) {
      const v = validateBlockAnswers(block, answers[block.id] ?? {});
      if (!v.ok) {
        setErrors(v.errors);
        const first = block.questions.find((q) => v.errors[q.variable]);
        if (first) document.getElementById(`q_${first.id}`)?.scrollIntoView({ block: "center" });
        return;
      }
      payload = v.answers;
    }
    if (mode === "preview" || !session) return advanceLocal();
    setBusy(true);
    const r = await api<{ index: number }>("submit", {
      sessionId: session.id,
      token: session.token,
      blockId: block.id,
      answers: payload,
      enteredAt: enteredAt.current,
    });
    setBusy(false);
    if (!r.ok) {
      if (r.errors) setErrors(r.errors);
      else setProblem(r.error ?? "network");
      return;
    }
    advanceLocal(r.index);
  };

  const consent = async (decision: "given" | "declined") => {
    if (!block) return;
    if (mode === "preview" || !session) {
      if (decision === "declined") setPhase("declined");
      else advanceLocal();
      return;
    }
    setBusy(true);
    setProblem(null);
    const r = await api<{ index: number }>("consent", { sessionId: session.id, token: session.token, blockId: block.id, decision });
    setBusy(false);
    if (!r.ok) return setProblem(r.error ?? "network");
    if (decision === "declined") {
      save(null);
      setPhase("declined");
    } else advanceLocal(r.index);
  };

  const withdraw = async () => {
    if (mode !== "preview" && session) {
      setBusy(true);
      const r = await api("withdraw", { sessionId: session.id, token: session.token });
      setBusy(false);
      if (!r.ok) return setProblem(r.error ?? "network");
    }
    save(null);
    setConfirmWithdraw(false);
    setPhase("withdrawn");
  };

  const t = (x: Parameters<typeof lt>[0]) => lt(x, lang, fallback);
  const total = config.blocks.length;
  const consentIndex = config.blocks.findIndex((b) => b.type === "consent");
  const canWithdraw = phase === "block" && block?.type !== "end" && (consentIndex < 0 || index > consentIndex);

  // ---------------------------------------------------------------------------

  const shell = (content: React.ReactNode) => (
    <div lang={lang} dir={dirFor(lang)} className="min-h-screen bg-paper">
      {mode !== "live" && (
        <div className={cx("px-4 py-2 text-center text-sm", mode === "preview" ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent-strong")}>
          {mode === "preview" ? tr("previewBanner") : tr("testBanner")}
        </div>
      )}
      {mode === "preview" && (
        <PreviewBar
          config={config}
          lang={lang}
          index={index}
          onLang={setLang}
          onJump={(i) => {
            completedRef.current = false;
            setPhase("block");
            setErrors({});
            setIndex(i);
          }}
          tr={tr}
        />
      )}
      {config.settings.showProgress && phase === "block" && total > 1 && (
        <div className="h-1.5 w-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={total - 1} aria-valuenow={index} aria-label={tr("progress")}>
          <div className="h-full bg-accent transition-all" style={{ width: `${(index / (total - 1)) * 100}%` }} />
        </div>
      )}
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:py-12">{content}</main>
    </div>
  );

  if (phase === "loading") return shell(<p className="text-center text-muted" role="status">{tr("loading")}</p>);

  if (phase === "error") {
    return shell(
      <div className="flex flex-col gap-4">
        <Alert tone="danger">{tr(`apiError_${problem}`) === `apiError_${problem}` ? tr("apiError_network") : tr(`apiError_${problem}`)}</Alert>
        <Button onClick={() => window.location.reload()}>{tr("retry")}</Button>
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
            <span lang="ar" dir="rtl">{messages.ar.chooseLanguage}</span>
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

  if (phase === "withdrawn") {
    return shell(
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{tr("withdrawnTitle")}</h1>
        <p>{tr("withdrawnBody")}</p>
      </section>,
    );
  }

  if (!block) return shell(<Alert tone="danger">{tr("apiError_configInvalid")}</Alert>);

  const heading = (text: string) => (
    <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold leading-snug outline-none">
      {text}
    </h1>
  );

  const nextButton = (label = tr("next"), disabled = false) => (
    <div className="flex justify-end">
      <Button onClick={submitBlock} disabled={busy || disabled} className="min-w-32 py-3 text-base">
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
      body = (
        <section className="flex flex-col gap-4">
          {t(block.heading) && heading(t(block.heading))}
          <div className="prose-study text-lg">{t(block.body)}</div>
          {block.media.map((m) => (
            <MediaView key={m.assetId} item={m} url={mediaUrls[m.storagePath]} lang={lang} fallback={fallback} />
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
    case "questionnaire":
    case "demographics": {
      const qs = block.randomizeQuestions ? seededShuffle(block.questions, `${seed}:${block.id}`) : block.questions;
      const blockAnswers = answers[block.id] ?? {};
      body = (
        <section className="flex flex-col gap-6">
          {block.heading && t(block.heading) ? heading(t(block.heading)) : <h1 ref={headingRef} tabIndex={-1} className="sr-only">{tr("questions")}</h1>}
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
                  setAnswers((a) => ({ ...a, [block.id]: { ...(a[block.id] ?? {}), [q.variable]: v } }));
                  if (errors[q.variable]) setErrors(({ [q.variable]: _, ...rest }) => rest);
                }}
                error={errors[q.variable]}
                seed={seed}
                mediaUrls={mediaUrls}
                tr={tr}
              />
            </div>
          ))}
          {nextButton()}
        </section>
      );
      break;
    }
    case "media":
      body = <MediaBlockView key={block.id} block={block} lang={lang} fallback={fallback} mediaUrls={mediaUrls} tr={tr} heading={heading} nextButton={nextButton} />;
      break;
    case "end":
      body = (
        <section className="flex flex-col gap-4">
          {heading(t(block.heading))}
          <div className="prose-study text-lg">{t(block.body)}</div>
          {block.completionCode && (
            <div className="rounded-xl border border-accent/30 bg-accent-soft p-4">
              <p className="text-sm">{tr("completionCode")}</p>
              <p className="mt-1 select-all font-mono text-2xl font-semibold tracking-wider" dir="ltr">
                {block.completionCode}
              </p>
            </div>
          )}
          {block.redirectUrl && mode !== "preview" && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">{tr("redirecting")}</p>
              <a href={block.redirectUrl} className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">
                {tr("continue")}
              </a>
            </div>
          )}
          {block.redirectUrl && mode === "preview" && <p className="text-sm text-muted">{tr("previewRedirect", { url: block.redirectUrl })}</p>}
        </section>
      );
      break;
  }

  return shell(
    <>
      {problem && <Alert tone="danger">{tr(`apiError_${problem}`) === `apiError_${problem}` ? tr("apiError_network") : tr(`apiError_${problem}`)}</Alert>}
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
  lang,
  fallback,
  mediaUrls,
  tr,
  heading,
  nextButton,
}: {
  block: Extract<Block, { type: "media" }>;
  lang: Language;
  fallback: Language;
  mediaUrls: Record<string, string>;
  tr: ReturnType<typeof makeTr>;
  heading: (text: string) => React.ReactNode;
  nextButton: (label?: string, disabled?: boolean) => React.ReactNode;
}) {
  const [remaining, setRemaining] = useState(block.minViewSeconds);
  const [ended, setEnded] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);
  const playable = block.items.filter((i) => i.kind !== "image");
  const mustWatch = block.requireVideoEnd && playable.some((i) => !ended.has(i.assetId));
  const title = lt(block.heading, lang, fallback);
  return (
    <section className="flex flex-col gap-4">
      {title ? heading(title) : <h1 className="sr-only">{tr("media")}</h1>}
      {block.items.map((item) => (
        <MediaView
          key={item.assetId}
          item={item}
          url={mediaUrls[item.storagePath]}
          lang={lang}
          fallback={fallback}
          autoplay={block.autoplay}
          controls={block.showControls}
          onEnded={() => setEnded((s) => new Set(s).add(item.assetId))}
        />
      ))}
      {remaining > 0 && <p className="text-center text-sm text-muted" aria-live="polite">{tr("waitSeconds", { n: remaining })}</p>}
      {remaining <= 0 && mustWatch && <p className="text-center text-sm text-muted">{tr("watchToEnd")}</p>}
      {nextButton(tr("next"), remaining > 0 || mustWatch)}
    </section>
  );
}

function PreviewBar({
  config,
  lang,
  index,
  onLang,
  onJump,
  tr,
}: {
  config: StudyConfig;
  lang: Language;
  index: number;
  onLang: (l: Language) => void;
  onJump: (i: number) => void;
  tr: ReturnType<typeof makeTr>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-b border-line bg-surface px-4 py-2 text-sm">
      <label className="flex items-center gap-2">
        <span>{tr("previewBlock")}</span>
        <select value={index} onChange={(e) => onJump(Number(e.target.value))} className="rounded-md border border-line px-2 py-1">
          {config.blocks.map((b, i) => (
            <option key={b.id} value={i}>
              {i + 1}. {b.name || b.type}
            </option>
          ))}
        </select>
      </label>
      {config.settings.languages.length > 1 && (
        <div className="flex gap-1">
          {config.settings.languages.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onLang(l)}
              className={cx("rounded-md px-2 py-1", l === lang ? "bg-accent text-white" : "border border-line")}
            >
              {l === "ar" ? "العربية" : "English"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
