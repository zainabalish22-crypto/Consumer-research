"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { repo } from "@/lib/study/repo";
import type { Answer, Block, Lang, Session, Study, StudyEvent } from "@/lib/study/types";
import { tx, uid } from "@/lib/study/util";
import { useMediaUrl } from "@/lib/study/useMedia";
import { Card, PrimaryButton } from "./parts";
import { QuestionsPage } from "./Questions";
import { ShopView } from "./ShopView";

/** Logs one event into the session (kept in memory; saved with the session). */
export type Log = (type: string, data?: StudyEvent["data"]) => void;

const key = (studyId: string, test: boolean) => `tess-session-${studyId}${test ? "-test" : ""}`;

/**
 * The participant experience: one block at a time, light and calm. Sessions resume after an
 * accidental refresh; preview sessions (?test=1) are flagged and never mixed with real data.
 */
export function Runner({ id }: { id: string }) {
  const t = useTranslations("run");
  const locale = useLocale() as Lang;
  const router = useRouter();
  const pathname = usePathname();
  const [study, setStudy] = useState<Study | null | undefined>(undefined);
  const [session, setSession] = useState<Session | null>(null);
  const [step, setStep] = useState(0);
  const sessionRef = useRef<Session | null>(null);
  const blockStart = useRef(0);
  const stepRef = useRef(0);

  const params = useMemo(() => (typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search)), []);
  const test = params.get("test") === "1";

  useEffect(() => {
    repo.getStudy(id).then(async (s) => {
      setStudy(s ?? null);
      if (!s) return;
      // Resume a session started in this tab (also survives switching language).
      const saved = sessionStorage.getItem(key(id, test));
      if (saved) {
        const [sid, st] = saved.split(":");
        const sess = await repo.getSession(sid);
        if (sess && sess.status === "active") {
          sessionRef.current = sess;
          setSession(sess);
          setStep(Number(st) || 0);
        }
      }
    });
  }, [id, test]);

  const save = useCallback(async (s: Session, at: number) => {
    sessionRef.current = s;
    setSession(s);
    sessionStorage.setItem(key(s.studyId, s.test), `${s.id}:${at}`);
    await repo.saveSession(s);
  }, []);

  const log: Log = useCallback((type, data) => {
    const s = sessionRef.current;
    if (!s) return;
    const block = study?.blocks[stepRef.current]?.id;
    s.events.push({ t: Date.now() - Date.parse(s.startedAt), type, block, data });
  }, [study]);

  // Persist events every few seconds, and when the page is hidden.
  useEffect(() => {
    const flush = () => sessionRef.current && repo.saveSession(sessionRef.current);
    const iv = window.setInterval(flush, 4000);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", flush);
    };
  }, []);

  function start(lang: Lang) {
    if (!study) return;
    const p: Record<string, string> = {};
    params.forEach((v, k) => {
      if (k !== "test") p[k] = v.slice(0, 200);
    });
    const s: Session = { id: uid(), studyId: study.id, version: study.version, test, lang, status: "active", startedAt: new Date().toISOString(), params: p, answers: {}, flags: [], events: [] };
    s.events.push({ t: 0, type: "session_start", data: { lang } });
    save(s, 0).then(() => {
      if (lang !== locale) router.replace(`${pathname}${window.location.search}`, { locale: lang });
    });
  }

  // A form in one language starts straight away, with no language question.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!study || session || autoStarted.current || study.languages.length !== 1) return;
    if (study.status !== "published" && !test) return;
    // Give a saved session a moment to resume first.
    const id = window.setTimeout(() => {
      if (sessionRef.current || autoStarted.current) return;
      autoStarted.current = true;
      start(study.languages[0]);
    }, 150);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [study, session]);

  const block: Block | undefined = study?.blocks[step];
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
    if (study.blocks[n]?.type === "end" || n >= study.blocks.length) {
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
    sessionStorage.removeItem(key(s.studyId, s.test));
    setStep(-2);
  }

  async function decline() {
    const s = sessionRef.current;
    if (!s) return;
    log("consent_declined");
    await save({ ...s, status: "declined", finishedAt: new Date().toISOString() }, step);
    sessionStorage.removeItem(key(s.studyId, s.test));
    setStep(-1);
  }

  if (study === undefined) return <Frame><p className="text-[#5C6066]">{t("loading")}</p></Frame>;
  if (study === null) return <Frame><p>{t("notFound")}</p></Frame>;
  if (study.status !== "published" && !test) return <Frame><p>{t("notPublished")}</p></Frame>;

  const accent = study.accent || "#1F5C4E";
  const lang = (session?.lang ?? (study.languages.includes(locale) ? locale : study.languages[0])) as Lang;

  // Language choice before anything else, when the study has both.
  if (!session) {
    if (study.languages.length === 1) return <Frame accent={accent} test={test}><p className="text-[#5C6066]">{t("loading")}</p></Frame>;
    return (
      <Frame accent={accent} test={test}>
        <Card>
          <h1 className="text-xl font-semibold">
            <span lang="en">Choose your language</span> · <span lang="ar">اختر لغتك</span>
          </h1>
          <div className="mt-5 flex flex-col gap-3">
            <button type="button" lang="ar" onClick={() => start("ar")} className="h-[52px] rounded-[14px] border-[1.5px] border-[#E3E0D8] px-4 text-start text-base font-medium hover:border-[var(--accent)]" dir="rtl">
              العربية
            </button>
            <button type="button" lang="en" onClick={() => start("en")} className="h-[52px] rounded-[14px] border-[1.5px] border-[#E3E0D8] px-4 text-start text-base font-medium hover:border-[var(--accent)]">
              English
            </button>
          </div>
        </Card>
      </Frame>
    );
  }

  if (step === -1 || session.status === "declined")
    return (
      <Frame accent={accent} test={test}>
        <Card>
          <p className="text-lg">{t("declined")}</p>
        </Card>
      </Frame>
    );

  if (step === -2 || session.status === "screened")
    return (
      <Frame accent={accent} test={test}>
        <Card>
          <p className="text-lg">{t("screened")}</p>
        </Card>
      </Frame>
    );

  if (!block) return <Frame accent={accent} test={test}><Card><p>{t("finished")}</p></Card></Frame>;

  if (block.type === "shop" && study.shop)
    return (
      <div data-light style={{ ["--accent" as string]: study.shop.accent || accent }} className="min-h-dvh bg-white text-[#16181B]">
        {test && <TestBar />}
        <ShopView shop={study.shop} lang={lang} seed={session.id} log={log} onDone={(basket) => {
          const s = sessionRef.current!;
          sessionRef.current = { ...s, basket };
          next();
        }} />
      </div>
    );

  // Steps before the closing message; a single-page form shows no step counter.
  const total = study.blocks.filter((x) => x.type !== "end").length;
  const firstPage = study.blocks.findIndex((x) => x.type === "questions") === step;
  const last = study.blocks[step + 1]?.type === "end" || step + 1 >= study.blocks.length;
  return (
    <Frame accent={accent} test={test}>
      {total > 1 && block.type !== "end" && (
        <p className="mb-3 text-xs text-[#5C6066]" aria-live="polite">
          {t("progress", { n: step + 1, total })}
        </p>
      )}
      {block.type === "questions" ? (
        <QuestionsPage key={block.id} block={block} lang={lang} seed={session.id} prior={session.answers} header={firstPage ? study.header : undefined} last={last} onNext={next} onScreenOut={screenOut} />
      ) : (
        <BlockView key={block.id} block={block} lang={lang} onNext={next} onDecline={decline} log={log} seed={session.id} />
      )}
    </Frame>
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
    case "end":
      return <EndView block={block} lang={lang} />;
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

function EndView({ block, lang }: { block: Extract<Block, { type: "end" }>; lang: Lang }) {
  const t = useTranslations("run");
  useEffect(() => {
    if (!block.redirect) return;
    const id = window.setTimeout(() => {
      if (/^https?:\/\//.test(block.redirect!)) window.location.href = block.redirect!;
    }, 4000);
    return () => window.clearTimeout(id);
  }, [block.redirect]);
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
      <p className="mt-6 text-sm text-[#5C6066]">{t("finished")}</p>
    </Card>
  );
}
