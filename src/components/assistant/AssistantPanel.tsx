"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { getPageContext, usePageContext } from "@/lib/assistant/context";

type Turn = { role: "user" | "assistant"; text: string; error?: string };

const KEY_STORE = "asdaa-anthropic-key";
const readKey = () => {
  try {
    return localStorage.getItem(KEY_STORE) ?? "";
  } catch {
    return "";
  }
};
const writeKey = (v: string) => {
  try {
    if (v) localStorage.setItem(KEY_STORE, v);
    else localStorage.removeItem(KEY_STORE);
  } catch {}
};

/** The conversation survives moving between pages (until the tab is reloaded). */
let kept: Turn[] = [];

/* ------------------------------------------------------------------ small Markdown */

function Inline({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={m.index}>{m[1]}</strong>);
    else if (m[2]) parts.push(<code key={m.index} className="rounded bg-steel px-1 font-mono text-[13px]">{m[2]}</code>);
    else {
      const [label, href] = [m[3], m[4]];
      if (href.startsWith("/") && !href.startsWith("//"))
        parts.push(<Link key={m.index} href={href} className="text-ice underline underline-offset-4 hover:text-photon">{label}</Link>);
      else if (/^https:\/\//.test(href))
        parts.push(<a key={m.index} href={href} target="_blank" rel="noopener noreferrer" className="text-ice underline underline-offset-4 hover:text-photon">{label}</a>);
      else parts.push(label);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** Paragraphs, headings and lists only: enough for short answers, with no raw HTML. */
function Markdown({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    out.push(
      <Tag key={out.length} className={`flex flex-col gap-1 ps-5 ${list.ordered ? "list-decimal" : "list-disc"}`}>
        {list.items.map((it, i) => (
          <li key={i}><Inline text={it} /></li>
        ))}
      </Tag>,
    );
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)/.exec(line);
    const num = /^\s*\d+[.)]\s+(.*)/.exec(line);
    if (bullet || num) {
      const ordered = !!num;
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? num)![1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const h = /^#{1,4}\s+(.*)/.exec(line);
    out.push(h ? <p key={out.length} className="font-semibold"><Inline text={h[1]} /></p> : <p key={out.length}><Inline text={line} /></p>);
  }
  flush();
  return <div className="flex flex-col gap-2">{out}</div>;
}

/* ------------------------------------------------------------------ panel */

/**
 * The research assistant: a button in the corner and a side panel. It reads only what the page
 * offers (the open study's wording and structure), helps design and improve studies, and
 * explains the platform. Answers stream in as they are written.
 */
export function AssistantPanel() {
  const t = useTranslations("assistant");
  const locale = useLocale();
  const path = usePathname();
  const context = usePageContext();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>(kept);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [key, setKey] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setKey(readKey()), []);
  useEffect(() => {
    kept = turns;
    end.current?.scrollIntoView({ block: "end" });
  }, [turns]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history: Turn[] = [...turns.filter((x) => !x.error), { role: "user", text: q }];
    setTurns([...turns, { role: "user", text: q }, { role: "assistant", text: "" }]);
    setDraft("");
    setBusy(true);
    const patch = (fn: (last: Turn) => Turn) => setTurns((all) => [...all.slice(0, -1), fn(all[all.length - 1])]);
    try {
      const ctx = getPageContext();
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(key ? { "x-anthropic-key": key } : {}) },
        body: JSON.stringify({ messages: history.map(({ role, text }) => ({ role, text })), context: { page: path, locale, title: ctx.title, detail: ctx.detail } }),
      });
      if (!res.ok || !res.body) {
        const code = (await res.json().catch(() => ({}))).error ?? "failed";
        patch((l) => ({ ...l, error: code }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const msg = JSON.parse(line) as { t?: string; done?: boolean; error?: string };
          if (msg.t) patch((l) => ({ ...l, text: l.text + msg.t }));
          if (msg.error) patch((l) => ({ ...l, error: msg.error }));
        }
      }
    } catch {
      patch((l) => ({ ...l, error: "failed" }));
    } finally {
      setBusy(false);
    }
  }

  const suggestions = context.detail ? (["s1", "s2", "s3"] as const).map((k) => t(`study.${k}`)) : (["s1", "s2", "s3"] as const).map((k) => t(`general.${k}`));

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 end-5 z-40 flex min-h-12 items-center gap-2 rounded-full border border-line-3 bg-carbon px-5 text-sm font-semibold text-photon shadow-[0_0_0_1px_#050506] hover:border-signal"
        >
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-signal" />
          {t("open")}
        </button>
      )}
      {open && (
        <aside role="dialog" aria-modal="false" aria-label={t("title")} className="fixed inset-y-0 end-0 z-50 flex w-full flex-col border-s border-line-2 bg-void text-photon sm:w-[420px]">
          <header className="flex flex-col gap-2 border-b border-line-2 px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg">{t("title")}</h2>
              <button type="button" onClick={() => setShowKey((v) => !v)} className="ms-auto min-h-10 px-2 text-xs text-mist hover:text-photon" aria-expanded={showKey}>
                {t("keyButton")}
              </button>
              {turns.length > 0 && (
                <button type="button" onClick={() => setTurns([])} disabled={busy} className="min-h-10 px-2 text-xs text-mist hover:text-photon disabled:opacity-40">
                  {t("clear")}
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label={t("close")} className="flex h-10 w-10 items-center justify-center text-mist hover:text-photon">
                ✕
              </button>
            </div>
            <p className="text-xs text-faint">{context.title ? t("reading", { title: context.title }) : t("readingNothing")}</p>
            {showKey && (
              <form
                className="flex flex-col gap-2 rounded-md border border-line-2 bg-carbon p-3 text-xs text-dim"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = keyDraft.trim();
                  writeKey(v);
                  setKey(v);
                  setKeyDraft("");
                  setShowKey(false);
                }}
              >
                <p>{key ? t("keyUsing") : t("keyHint")}</p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    autoComplete="off"
                    value={keyDraft}
                    onChange={(e) => setKeyDraft(e.target.value)}
                    placeholder="sk-ant-…"
                    dir="ltr"
                    aria-label={t("keyLabel")}
                    className="min-h-10 flex-1 rounded-md border border-line-2 bg-void px-2 text-sm text-photon focus:border-ice focus:outline-none"
                  />
                  <button type="submit" disabled={!keyDraft.trim()} className="min-h-10 rounded-md bg-photon px-3 font-semibold text-void disabled:opacity-40">
                    {t("keySave")}
                  </button>
                </div>
                {key && (
                  <button
                    type="button"
                    onClick={() => {
                      writeKey("");
                      setKey("");
                    }}
                    className="self-start text-mist underline underline-offset-4 hover:text-photon"
                  >
                    {t("keyRemove")}
                  </button>
                )}
                <p className="text-faint">{t("keyPrivacy")}</p>
              </form>
            )}
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
            {turns.length === 0 ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm leading-relaxed text-dim">{t("intro")}</p>
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => ask(s)} className="min-h-11 rounded-md border border-line-2 px-3 py-2 text-start text-sm text-mist hover:border-photon hover:text-photon">
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <ol className="flex flex-col gap-4">
                {turns.map((m, i) => (
                  <li key={i} className={m.role === "user" ? "self-end max-w-[85%] rounded-lg bg-steel px-3 py-2 text-sm" : "text-[15px] leading-relaxed text-mist"}>
                    {m.role === "user" ? (
                      <p className="whitespace-pre-wrap" dir="auto">{m.text}</p>
                    ) : (
                      <div dir="auto">
                        {m.text ? <Markdown text={m.text} /> : !m.error && <p className="text-faint">{t("thinking")}</p>}
                        {m.error && (
                          <p role="alert" className="mt-2 text-sm text-warn">
                            {m.error === "signIn" ? (
                              <Link href={`/sign-in?next=${encodeURIComponent(`/${locale}${path}`)}`} className="underline underline-offset-4 hover:text-photon">
                                {t("errors.signIn")}
                              </Link>
                            ) : (
                              t(`errors.${m.error}`)
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <div ref={end} />
          </div>

          <form
            className="flex flex-col gap-2 border-t border-line-2 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={input}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask(draft);
                  }
                }}
                rows={2}
                dir="auto"
                aria-label={t("placeholder")}
                placeholder={t("placeholder")}
                className="min-h-11 flex-1 resize-none rounded-md border border-line-2 bg-carbon px-3 py-2 text-[15px] text-photon focus:border-ice focus:outline-none"
              />
              <button type="submit" disabled={busy || !draft.trim()} className="min-h-11 rounded-md bg-photon px-4 font-semibold text-void hover:bg-white disabled:opacity-40">
                {t("send")}
              </button>
            </div>
            <p className="text-[11px] text-faint">{t("disclaimer")}</p>
          </form>
        </aside>
      )}
    </>
  );
}
