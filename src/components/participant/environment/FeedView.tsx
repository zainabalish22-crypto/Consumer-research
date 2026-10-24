"use client";
/**
 * Social-media style feed: organic posts written by the researcher and
 * sponsored posts that show library ads. Participants can like, save or hide
 * posts; the time each post is at least half on screen is recorded.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { FeedPost, Language, SocialFeedBlock, StudyConfig } from "@/lib/study/schema";
import type { Assignment } from "@/lib/study/flow";
import { libraryOf, orderItems, resolveAd } from "@/lib/study/environment";
import { lt } from "@/lib/study/text";
import { Alert, Button, cx } from "@/components/ui";
import type { Tr } from "../i18n";
import type { FeedAnswer } from "@/lib/study/envAnswers";
import { AdCreative, type Log } from "./shared";

export function FeedView({
  block,
  config,
  assignment,
  seed,
  lang,
  fallback,
  mediaUrls,
  tr,
  t,
  log,
  busy,
  error,
  onSubmit,
  heading,
}: {
  block: SocialFeedBlock;
  config: StudyConfig;
  assignment: Assignment;
  seed: string;
  lang: Language;
  fallback: Language;
  mediaUrls: Record<string, string>;
  tr: Tr;
  t: (x: Parameters<typeof lt>[0]) => string;
  log: Log;
  busy: boolean;
  error?: string;
  onSubmit: (value: FeedAnswer) => void;
  heading: (text: string) => React.ReactNode;
}) {
  const lib = libraryOf(config);
  const posts = useMemo(() => {
    const byId = new Map(block.posts.map((p) => [p.id, p]));
    return orderItems(block.posts.map((p) => p.id), block.postOrder, config, assignment, `${seed}:${block.id}`)
      .map((id) => byId.get(id))
      .filter((p): p is FeedPost => !!p);
  }, [block, config, assignment, seed]);
  const [liked, setLiked] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [remaining, setRemaining] = useState(block.minSeconds);

  useEffect(() => {
    log("env_enter", { posts: posts.length });
    // Once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const toggle = (list: string[], set: (v: string[]) => void, id: string, on: string, off: string, pos: number) => {
    const has = list.includes(id);
    set(has ? list.filter((x) => x !== id) : [...list, id]);
    log(has ? (off as never) : (on as never), { post: id, pos });
  };

  return (
    <section className="flex flex-col gap-4">
      {t(block.heading) ? heading(t(block.heading)) : <div className="sr-only">{heading(t(block.platformName) || tr("feedTitle"))}</div>}
      {t(block.intro) && <p className="prose-study text-sm text-muted">{t(block.intro)}</p>}
      {error && <Alert tone="danger">{tr(`err_${error}`)}</Alert>}

      <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-line bg-[#f0f2f5]">
        <div className="sticky top-0 z-10 border-b border-line bg-white px-4 py-2.5 text-lg font-bold" dir="auto">
          {t(block.platformName) || tr("feedTitle")}
        </div>
        <ul className="flex flex-col gap-2 py-2" aria-label={tr("feedPosts")}>
          {posts.map((p, i) => (
            <PostCard
              key={p.id}
              post={p}
              pos={i + 1}
              block={block}
              config={config}
              assignment={assignment}
              lib={lib}
              lang={lang}
              fallback={fallback}
              mediaUrls={mediaUrls}
              tr={tr}
              log={log}
              liked={liked.includes(p.id)}
              saved={saved.includes(p.id)}
              hidden={hidden.includes(p.id)}
              onLike={() => toggle(liked, setLiked, p.id, "feed_like", "feed_unlike", i + 1)}
              onSave={() => toggle(saved, setSaved, p.id, "feed_save", "feed_unsave", i + 1)}
              onHide={() => toggle(hidden, setHidden, p.id, "feed_hide", "feed_unhide", i + 1)}
            />
          ))}
        </ul>
        <p className="pb-4 text-center text-xs text-muted">{tr("feedEnd")}</p>
      </div>

      {remaining > 0 && (
        <p className="text-center text-sm text-muted" aria-live="polite">
          {tr("waitSeconds", { n: remaining })}
        </p>
      )}
      <div className="flex justify-end">
        <Button className="min-w-32 py-3 text-base" disabled={busy || remaining > 0} onClick={() => onSubmit({ liked, saved, hidden })}>
          {busy ? tr("saving") : tr("next")}
        </Button>
      </div>
    </section>
  );
}

function PostCard({
  post,
  pos,
  block,
  config,
  assignment,
  lib,
  lang,
  fallback,
  mediaUrls,
  tr,
  log,
  liked,
  saved,
  hidden,
  onLike,
  onSave,
  onHide,
}: {
  post: FeedPost;
  pos: number;
  block: SocialFeedBlock;
  config: StudyConfig;
  assignment: Assignment;
  lib: ReturnType<typeof libraryOf>;
  lang: Language;
  fallback: Language;
  mediaUrls: Record<string, string>;
  tr: Tr;
  log: Log;
  liked: boolean;
  saved: boolean;
  hidden: boolean;
  onLike: () => void;
  onSave: () => void;
  onHide: () => void;
}) {
  const L = (x: Parameters<typeof lt>[0]) => lt(x, lang, fallback);
  const ref = useRef<HTMLLIElement>(null);
  const ad = post.kind === "ad" && post.adId && lib.ads[post.adId] ? resolveAd(lib.ads[post.adId], block.ads, config, assignment) : null;

  // Seconds at least half on screen, reported when the post leaves the page.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let since: number | null = null;
    let total = 0;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.5) since ??= performance.now();
        else if (since !== null) {
          total += performance.now() - since;
          since = null;
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (since !== null) total += performance.now() - since;
      if (total > 0) log("post_visible", { post: post.id, pos, ad: post.adId ?? null, ms: Math.round(total) });
    };
    // Tracking is per mounted post.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  const author = L(post.author) || (ad ? L(ad.ad.name) : "");
  const count = (post.likes ?? 0) + (liked ? 1 : 0);
  const media = post.media && mediaUrls[post.media.storagePath] ? post.media : null;

  if (hidden) {
    return (
      <li ref={ref} className="mx-2 flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm text-muted">
        <span>{tr("postHidden")}</span>
        <button type="button" className="font-medium text-accent hover:underline" onClick={onHide}>
          {tr("undo")}
        </button>
      </li>
    );
  }
  return (
    <li ref={ref} className="mx-2 flex flex-col gap-2 rounded-xl bg-white py-3">
      <div className="flex items-center gap-2 px-4">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-strong">
          {author.slice(0, 1).toUpperCase() || "•"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold" dir="auto">
            {author}
          </span>
          {ad && <span className="block text-xs text-muted">{tr("sponsored")}</span>}
        </span>
      </div>
      {L(post.text) && (
        <p className="prose-study whitespace-pre-line px-4 text-sm" dir="auto">
          {L(post.text)}
        </p>
      )}
      {ad ? (
        <AdCreative shown={ad} url={ad.media ? mediaUrls[ad.media.storagePath] : undefined} lang={lang} fallback={fallback} log={log} context={{ placement: "feed", pos }} className="rounded-none" />
      ) : media?.kind === "video" ? (
        <video src={mediaUrls[media.storagePath]} controls playsInline preload="metadata" className="w-full bg-black" aria-label={L(media.alt)} />
      ) : media ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrls[media.storagePath]} alt={L(media.alt)} loading="lazy" className="w-full object-cover" />
      ) : null}
      {block.showCounts && count > 0 && <p className="px-4 text-xs text-muted">{tr("likesCount", { n: count.toLocaleString(lang) })}</p>}
      <div className="flex border-t border-line px-2 pt-1 text-sm">
        {block.actions.like && (
          <ActionButton pressed={liked} onClick={onLike} label={liked ? tr("liked") : tr("like")} icon={liked ? "♥" : "♡"} activeClass="text-[#e11d48]" />
        )}
        {block.actions.save && (
          <ActionButton pressed={saved} onClick={onSave} label={saved ? tr("saved") : tr("save")} icon={saved ? "★" : "☆"} activeClass="text-[#b45309]" />
        )}
        {block.actions.hide && <ActionButton pressed={false} onClick={onHide} label={tr("hidePost")} icon="✕" activeClass="" />}
      </div>
    </li>
  );
}

function ActionButton({ pressed, onClick, label, icon, activeClass }: { pressed: boolean; onClick: () => void; label: string; icon: string; activeClass: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cx("flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-medium text-muted hover:bg-paper", pressed && activeClass)}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  );
}
