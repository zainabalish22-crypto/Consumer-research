/** Primitives shared by the study schema and the content library. */
import { z } from "zod";

export const LANGUAGES = ["en", "ar"] as const;
export type Language = (typeof LANGUAGES)[number];

const MAX_TEXT = 20_000;

export const LocalizedText = z.object({
  en: z.string().max(MAX_TEXT).optional(),
  ar: z.string().max(MAX_TEXT).optional(),
});
export type LocalizedText = z.infer<typeof LocalizedText>;

export const MediaRef = z.object({
  assetId: z.string().uuid(),
  storagePath: z.string().min(1).max(400),
  kind: z.enum(["image", "video", "audio"]),
  mimeType: z.string().max(100),
  alt: LocalizedText.default({}),
});
export type MediaRef = z.infer<typeof MediaRef>;
