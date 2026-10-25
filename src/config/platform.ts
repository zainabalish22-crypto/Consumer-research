/**
 * The platform's name and fixed limits live here so they can be changed in one place.
 * "Why & Wren" is a brand name and is kept in English in both languages.
 */
export const PLATFORM = {
  name: { en: "Why & Wren", ar: "Why & Wren" },
  /** Shown in the footer and docs. Keep honest: no licence chosen yet. */
  repositoryUrl: "https://github.com/zainabalish22-crypto/Consumer-research" as string | null,
} as const;

/**
 * Limits exist only to keep the free hosted service stable. They are shown
 * to researchers in the interface and documented in docs/LIMITS.md.
 * Self-hosters can raise them.
 */
export const LIMITS = {
  maxUploadBytes: 50 * 1024 * 1024,
  maxBlocksPerStudy: 300,
  maxQuestionsPerBlock: 200,
} as const;

export const ACCEPTED_MEDIA: Record<string, "image" | "video" | "audio"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/x-m4a": "audio",
};
