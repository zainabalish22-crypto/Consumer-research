import { recordMedia } from "@/lib/server/media";
import { fail, ok, readJson, researcher } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Remembers a finished upload, so it can be removed with the researcher's account. */
export async function POST(req: Request) {
  const user = await researcher();
  if (user instanceof Response) return user;
  const m = await readJson<{ url: string; pathname: string; size: number; contentType: string }>(req, 4000);
  if (!m || !/^https:\/\//.test(m.url)) return fail("bad", 400);
  await recordMedia(user.id, { url: m.url, pathname: String(m.pathname).slice(0, 500), size: Number(m.size) || 0, contentType: String(m.contentType).slice(0, 100) });
  return ok({ saved: true });
}
