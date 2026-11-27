import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { blobConfigured, localMediaDir } from "@/lib/server/media";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };

/** Development only: serves a file from the local upload folder. */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  if (blobConfigured()) return fail("notFound", 404);
  const { file } = await params;
  const m = /^([0-9a-f-]{36})\.(\w+)$/.exec(file);
  if (!m || !TYPES[m[2]]) return fail("notFound", 404);
  try {
    const data = await readFile(join(await localMediaDir(), file));
    return new Response(new Uint8Array(data), { headers: { "Content-Type": TYPES[m[2]], "Cache-Control": "private, max-age=3600" } });
  } catch {
    return fail("notFound", 404);
  }
}
