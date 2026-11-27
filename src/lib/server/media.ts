import "server-only";

import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";

/** Uploaded files go to Vercel Blob when its token is set; on a developer's computer, to a local folder. */
export const blobConfigured = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "video/mp4", "video/webm", "video/quicktime"];

export async function recordMedia(ownerId: string, m: { url: string; pathname: string; size: number; contentType: string }) {
  await sql`insert into media (id, owner_id, url, pathname, size, content_type) values (${randomUUID()}, ${ownerId}, ${m.url}, ${m.pathname}, ${m.size}, ${m.contentType})`;
}

/** Folder for local uploads (development only), outside the synced project folder. */
export async function localMediaDir() {
  const { mkdirSync } = await import("node:fs");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = join(process.env.LOCALAPPDATA || homedir(), "asdaa-lab-dev", "media");
  mkdirSync(dir, { recursive: true });
  return dir;
}
