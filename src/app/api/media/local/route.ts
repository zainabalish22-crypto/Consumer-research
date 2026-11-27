import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ALLOWED_TYPES, blobConfigured, localMediaDir, MAX_UPLOAD_BYTES } from "@/lib/server/media";
import { fail, ok, researcher } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

/** Development only: keeps an upload in a local folder when Vercel Blob is not configured. */
export async function POST(req: Request) {
  if (blobConfigured()) return fail("notFound", 404);
  const user = await researcher();
  if (user instanceof Response) return user;
  const file = (await req.formData()).get("file");
  if (!(file instanceof File) || !ALLOWED_TYPES.includes(file.type) || file.size > MAX_UPLOAD_BYTES) return fail("uploadRefused", 400);
  const name = `${randomUUID()}.${EXT[file.type]}`;
  await writeFile(join(await localMediaDir(), name), Buffer.from(await file.arrayBuffer()));
  return ok({ url: `/api/media/local/${name}`, pathname: name, contentType: file.type, size: file.size });
}
