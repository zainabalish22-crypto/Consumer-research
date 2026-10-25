import type { BlockType } from "@/lib/study/schema";
import { cx } from "@/components/ui";

/** Block families share a colour so long flows are easy to scan. */
const FAMILY: Record<BlockType, "flow" | "questions" | "media" | "shop"> = {
  welcome: "flow",
  consent: "flow",
  instructions: "flow",
  exclusion_check: "flow",
  debrief: "flow",
  end: "flow",
  questionnaire: "questions",
  demographics: "questions",
  screening: "questions",
  media: "media",
  ad_exposure: "media",
  village: "shop",
  store_choice: "shop",
  online_shop: "shop",
  social_feed: "shop",
};

const STYLE = {
  flow: "bg-flow-soft text-flow",
  questions: "bg-accent-soft text-accent",
  media: "bg-media-soft text-media",
  shop: "bg-shop-soft text-shop",
};

const PATHS: Record<BlockType, React.ReactNode> = {
  welcome: <path d="M4 12h12M12 6l6 6-6 6" />,
  consent: <path d="M5 12l5 5 9-10" />,
  instructions: <path d="M12 8h.01M11 12h1v5h1M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0z" />,
  exclusion_check: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />,
  debrief: <path d="M5 5h14v14H5zM9 9h6M9 13h6" />,
  end: <path d="M5 21V4h11l-2 4 2 4H5" />,
  questionnaire: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  demographics: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />,
  screening: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
  media: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M10 9l5 3-5 3z" />
    </>
  ),
  ad_exposure: <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12" />,
  village: <path d="M4 10l2-5h12l2 5M4 10h16v9H4zM9 19v-5h6v5" />,
  store_choice: <path d="M4 10l2-5h12l2 5M4 10h16v9H4zM9 14l2 2 4-4" />,
  online_shop: (
    <>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M3 4h2l2.5 11h11L21 8H7" />
    </>
  ),
  social_feed: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
};

export function BlockIcon({ type, size = 28, className }: { type: BlockType; size?: number; className?: string }) {
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded-lg", STYLE[FAMILY[type]], className)} style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {PATHS[type]}
      </svg>
    </span>
  );
}
