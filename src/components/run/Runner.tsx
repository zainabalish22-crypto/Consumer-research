"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { planSteps, resolveShop } from "@/lib/study/engine";
import { attempts, returnUrl, runApi, type RunState } from "@/lib/study/runApi";
import type { Answer, Block, Lang, Session, Study, StudyEvent } from "@/lib/study/types";
import { tx } from "@/lib/study/util";
import { useMediaUrl } from "@/lib/study/useMedia";
import { Card, PrimaryButton } from "./parts";
import { QuestionsPage } from "./Questions";
import { ShopView } from "./ShopView";

/** Logs one event into the session (kept in memory; saved with the session). */
export type Log = (type: string, data?: StudyEvent["data"]) => void;

/** Screens shown instead of the study. */
type Stop = "loading" | "notFound" | "notPublished" | "closed" | "repeat" | "offline" | null;

/**
 * The participant experience, one block at a time, light and calm. The study comes from the
 * server (the newest published version; the owner's draft with ?test=1). Progress is saved as
 * the participant goes, so closing the page and opening the link again in the same browser
 * continues where they stopped. The link's language (/en or /ar) decides the study language.
 */
export function Runner({ id }: { id: string }) {
  const t = useTranslations("run");
  const locale = useLocale() as Lang;
  const [study, setStudy] = useState<Study | null>(null);
  const [stop, setStop] = useState<Stop>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [step, setStep] = useState(0);
  const sessionRef = useRef<Session | null>(null);
  const tokenRef = useRef("");
  const dirty = useRef(false);
  const blockStart = useRef(0);
  const stepRef = useRef(0);

  // Read the same way on the server and in the browser, so the first render matches.
  const params = useSearchParams();
  const test = params.get("test") === "1";

  // Load the study, then continue a saved attempt or start a new one.
  useEffect(() => {
    let live = true;
    (async () => {
      const loaded = await runApi.load(id, test);
      if (!live) return;
      if (!loaded.ok) return setStop(loaded.error === "offline" ? "offline" : "notFound");
      const s = loaded.body.study;
      setStudy(s);
      const saved = attempts.read(id, test);
      if (saved) {
        const r = await runApi.resume(saved.sid, saved.token);
        if (!live) return;
        if (r.ok && r.body.session.status === "active") {
          tokenRef.current = saved.token;
          sessionRef.current = r.body.session;
          setSession(r.body.session);
          setStep(saved.step);
          return setStop(null);
        }
        attempts.clear(id, test);
      }
      const state: RunState = loaded.body.state;
      if (state !== "open") return setStop(state);
      const lang: Lang = s.languages.includes(locale) ? locale : s.languages[0];
      const p: Record<string, string> = {};
      params.forEach((v, k) => {
        if (k !== "test") p[k] = v;
      });
      const preview: Record<string, string> = {};
      for (const pair of (params.get("cond") ?? "").split(",")) {
        const [f, l] = pair.split(":");
        if (f && l) preview[f] = l;
      }
      delete p.cond;
      const started = await runApi.start(id, lang, p, test, preview);
      if (!live) return;
      if (!started.ok) {
        const known: Stop[] = ["repeat", "closed", "notPublished", "offline"];
        return setStop(known.includes(started.error as Stop) ? (started.error as Stop) : "notFound");
      }
      tokenRef.current = started.body.token;
      sessionRef.current = started.body.session;
      attempts.write(id, test, { sid: started.body.session.id, token: started.body.token, step: 0 });
      setSession(started.body.session);
      setStop(null);
    })();
    return () => {
      live = false;
    };
  }, [id, test, locale, params]);

  const save = useCallback(async (s: Session, at: number) => {
    sessionRef.current = s;
    setSession(s);
    dirty.current = false;
    if (s.status === "active") attempts.write(s.studyId, s.test, { sid: s.id, token: tokenRef.current, step: at });
    else attempts.clear(s.studyId, s.test);
    const res = await runApi.save(s, tokenRef.current);
    // The server screened the participant out because their quota group is full.
    if (res.ok && res.body.quotaFull) {
      const full: Session = { ...s, status: "screened", flags: [...new Set([...s.flags, "quota_full"])], finishedAt: s.finishedAt ?? new Date().toISOString() };
      sessionRef.current = full;
      setSession(full);
      attempts.clear(s.studyId, s.test);
    }
  }, []);

  const log: Log = useCallback(
    (type, data) => {
      const s = sessionRef.current;
      if (!s) return;
      const block = stepsRef.current[stepRef.current]?.key;
      s.events.push({ t: Date.now() - Date.parse(s.startedAt), type, block, data });
      dirty.current = true;
    },
    [study],
  );

  // Save new events every few seconds, and when the page is hidden.
  useEffect(() => {
    const flush = (keepalive = false) => {
      const s = sessionRef.current;
      if (!s || !dirty.current || s.status !== "active") return;
      dirty.current = false;
      runApi.save(s, tokenRef.current, keepalive);
    };
    const iv = window.setInterval(() => flush(), 8000);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  // This participant's own sequence: their condition, repeated sections and shuffles.
  const steps = useMemo(() => (study && session ? planSteps(study, session.assignment, session.id) : []), [study, session?.id, session?.assignment]); // eslint-disable-line react-hooks/exhaustive-deps
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const block: Block | undefined = steps[step]?.block;
  stepRef.current = step;

  // Record entering each block.
  useEffect(() => {
    if (!session || !block) return;
    blockStart.current = Date.now();
    log("block_enter", { kind: block.type });
    window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, session?.id]);

  async function next(answers?: Record<string, Answer>, flags: string[] = []) {
    const s = sessionRef.current;
    if (!s || !study || !block) return;
    log("block_leave", { kind: block.type, ms: Date.now() - blockStart.current });
    const updated: Session = { ...s, answers: { ...s.answers, ...answers }, flags: [...new Set([...s.flags, ...flags])] };
    const n = step + 1;
    if (steps[n]?.block.type === "end" || n >= steps.length) {
      updated.status = "completed";
      updated.finishedAt = new Date().toISOString();
      updated.events.push({ t: Date.now() - Date.parse(s.startedAt), type: "completed" });
    }
    await save(updated, n);
    setStep(n);
  }

  /** An answer marked "end the study" was given: stop politely and record it. */
  async function screenOut(answers: Record<string, Answer>) {
    const s = sessionRef.current;
    if (!s) return;
    log("screened_out");
    await save({ ...s, answers: { ...s.answers, ...answers }, status: "screened", finishedAt: new Date().toISOString() }, step);
  }

  async function decline() {
    const s = sessionRef.current;
    if (!s) return;
    log("consent_declined");
    await save({ ...s, status: "declined", finishedAt: new Date().toISOString() }, step);
  }

  const accent = study?.accent || "#1F5C4E";
  const panelId = session?.params[study?.settings?.panelParam || "pid"];
  const back = (kind: "completed" | "screened" | "declined") => returnUrl(study?.settings?.returns?.[kind], panelId);

  if (stop === "loading")
    return (
      <Frame accent={accent} test={test}>
        <p className="text-[#5C6066]">{t("loading")}</p>
      </Frame>
    );
  if (stop || !study || !session)
    return (
      <Frame accent={accent} test={test}>
        <Card>
          <p className="text-lg">{t(`stop.${stop ?? "notFound"}`)}</p>
        </Card>
      </Frame>
    );

  const lang = session.lang;

  if (session.status === "declined")
    return (
      <Frame accent={accent} test={test}>
        <Card>
          <p className="text-lg">{t("declined")}</p>
          <ReturnLink href={back("declined")} />
        </Card>
      </Frame>
    );

  if (session.status === "screened")
    return (
      <Frame accent={accent} test={test}>
        <Card>
          <p className="text-lg">{session.flags.includes("quota_full") ? t("stop.full") : t("screened")}</p>
          <ReturnLink href={back("screened")} />
        </Card>
      </Frame>
    );

  if (!block)
    return (
      <Frame accent={accent} test={test}>
        <Card>
          <p>{t("finished")}</p>
          <ReturnLink href={back("completed")} />
        </Card>
      </Frame>
    );

  if (block.type === "shop" && study.shop)
    return (
      <div data-light style={{ ["--accent" as string]: study.shop.accent || accent }} className="min-h-dvh bg-white text-[#16181B]">
        {test && <TestBar />}
        <ShopView
          shop={resolveShop(study.shop, session.assignment)}
          lang={lang}
          seed={session.id}
          log={log}
          onDone={(basket) => {
            const s = sessionRef.current!;
            sessionRef.current = { ...s, basket };
            next();
          }}
        />
      </div>
    );

  // Steps before the closing message; a single-page form shows no step counter.
  const total = steps.filter((x) => x.block.type !== "end").length;
  const firstPage = steps.findIndex((x) => x.block.type === "questions") === step;
  const last = steps[step + 1]?.block.type === "end" || step + 1 >= steps.length;
  const stepKey = steps[step]?.key ?? block.id;
  return (
    <Frame accent={accent} test={test}>
      {total > 1 && block.type !== "end" && (
        <p className="mb-3 text-xs text-[#5C6066]" aria-live="polite">
          {t("progress", { n: step + 1, total })}
        </p>
      )}
      {block.type === "questions" ? (
        <QuestionsPage key={stepKey} block={block} lang={lang} seed={session.id} prior={session.answers} header={firstPage ? study.header : undefined} last={last} onNext={next} onScreenOut={screenOut} />
      ) : block.type === "end" ? (
        <EndView block={block} lang={lang} returnTo={back("completed")} />
      ) : (
        <BlockView key={stepKey} block={block} lang={lang} onNext={next} onDecline={decline} log={log} seed={session.id} />
      )}
    </Frame>
  );
}

/** Sends a panel participant back, with a short pause so they can read the page first. */
function ReturnLink({ href }: { href: string | undefined }) {
  const t = useTranslations("run");
  useEffect(() => {
    if (!href) return;
    const id = window.setTimeout(() => (window.location.href = href), 5000);
    return () => window.clearTimeout(id);
  }, [href]);
  if (!href) return null;
  return (
    <a href={href} className="mt-6 inline-flex h-[52px] items-center rounded-[14px] bg-[var(--accent)] px-6 font-semibold text-white">
      {t("returnToPanel")}
    </a>
  );
}

function TestBar() {
  const t = useTranslations("run");
  return <div className="bg-[#FFF4D6] px-4 py-2 text-center text-[13px] font-medium text-[#6B4E00]">{t("test")}</div>;
}

/** The light participant frame; the researcher's accent colour drives buttons and focus. */
function Frame({ children, accent = "#1F5C4E", test = false }: { children: React.ReactNode; accent?: string; test?: boolean }) {
  return (
    <div style={{ ["--accent" as string]: accent }} className="min-h-dvh bg-[#F7F6F2] text-[#16181B] [&_:focus-visible]:outline-[var(--accent)]" data-light>
      {test && <TestBar />}
      <main className="mx-auto flex w-full max-w-2xl flex-col px-4 py-6 sm:py-12">{children}</main>
    </div>
  );
}

function Paragraphs({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-3 text-[16px] leading-[1.7] text-[#2D3035]">
      {text.split(/\n{2,}|\n/).filter(Boolean).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

function BlockView({ block, lang, onNext, onDecline, log, seed }: { block: Block; lang: Lang; onNext: (a?: Record<string, Answer>, flags?: string[]) => void; onDecline: () => void; log: Log; seed: string }) {
  const t = useTranslations("run");
  switch (block.type) {
    case "welcome":
      return (
        <Card>
          <h1 className="text-2xl font-semibold">{tx(block.title, lang)}</h1>
          <div className="mt-4">
            <Paragraphs text={tx(block.body, lang)} />
          </div>
          {tx(block.duration, lang) && <p className="mt-3 text-sm text-[#5C6066]">{tx(block.duration, lang)}</p>}
          {block.contact && (
            <p className="mt-3 text-sm text-[#5C6066]" dir="ltr">
              {block.contact}
            </p>
          )}
          <div className="mt-6">
            <PrimaryButton onClick={() => onNext()}>{t("next")}</PrimaryButton>
          </div>
        </Card>
      );
    case "consent":
      return (
        <Card>
          <h1 className="text-2xl font-semibold">{tx(block.title, lang)}</h1>
          <div className="mt-4 max-h-[50vh] overflow-auto rounded-xl border border-[#ECEAE4] p-4">
            <Paragraphs text={tx(block.body, lang)} />
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <PrimaryButton
              onClick={() => {
                log("consent_given", { version: block.version });
                onNext({ consent_version: block.version });
              }}
            >
              {tx(block.agree, lang)}
            </PrimaryButton>
            <button type="button" onClick={onDecline} className="h-[52px] rounded-[14px] border-[1.5px] border-[#E3E0D8] px-6 font-semibold">
              {tx(block.decline, lang)}
            </button>
          </div>
        </Card>
      );
    case "instructions":
      return (
        <Card>
          <h1 className="text-2xl font-semibold">{tx(block.title, lang)}</h1>
          {block.image && <MediaItem src={block.image} className="mt-4 w-full rounded-xl" />}
          <div className="mt-4">
            <Paragraphs text={tx(block.body, lang)} />
          </div>
          <div className="mt-6">
            <PrimaryButton onClick={() => onNext()}>{t("next")}</PrimaryButton>
          </div>
        </Card>
      );
    case "media":
      return <MediaBlockView block={block} lang={lang} onNext={() => onNext()} log={log} />;
    default:
      return null;
  }
}

function MediaItem({ src, className, onSeen }: { src: string; className?: string; onSeen?: () => void }) {
  const { url, isVideo } = useMediaUrl(src);
  if (!url) return <div className={`aspect-video animate-pulse bg-[#ECEAE4] ${className}`} />;
  return isVideo ? <video src={url} controls playsInline className={className} onPlay={onSeen} /> : <img src={url} alt="" className={className} onLoad={onSeen} />;
}

function MediaBlockView({ block, lang, onNext, log }: { block: Extract<Block, { type: "media" }>; lang: Lang; onNext: () => void; log: Log }) {
  const t = useTranslations("run");
  const [left, setLeft] = useState(block.minSeconds ?? 0);
  useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left]);
  return (
    <Card>
      <h1 className="text-2xl font-semibold">{tx(block.title, lang)}</h1>
      {tx(block.body, lang) && (
        <div className="mt-3">
          <Paragraphs text={tx(block.body, lang)} />
        </div>
      )}
      <div className="mt-5 flex flex-col gap-4">
        {block.items.map((m, i) => (
          <MediaItem key={i} src={m} className="w-full rounded-xl" onSeen={() => log("media_view", { item: i + 1 })} />
        ))}
      </div>
      <div className="mt-6">
        <PrimaryButton onClick={onNext} disabled={left > 0}>
          {left > 0 ? t("wait", { s: left }) : t("next")}
        </PrimaryButton>
      </div>
    </Card>
  );
}

function EndView({ block, lang, returnTo }: { block: Extract<Block, { type: "end" }>; lang: Lang; returnTo?: string }) {
  const t = useTranslations("run");
  // The panel return link from the study's settings, or the end page's own link (older studies).
  const href = returnTo ?? (block.redirect && /^https:\/\//.test(block.redirect) ? block.redirect : undefined);
  return (
    <Card>
      <h1 className="text-2xl font-semibold">{tx(block.title, lang)}</h1>
      <div className="mt-4">
        <Paragraphs text={tx(block.body, lang)} />
      </div>
      {block.code && (
        <div className="mt-6 rounded-xl border border-[#ECEAE4] p-4">
          <p className="text-sm text-[#5C6066]">{t("code")}</p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-wider" dir="ltr">
            {block.code}
          </p>
        </div>
      )}
      {href ? <ReturnLink href={href} /> : <p className="mt-6 text-sm text-[#5C6066]">{t("finished")}</p>}
    </Card>
  );
}
