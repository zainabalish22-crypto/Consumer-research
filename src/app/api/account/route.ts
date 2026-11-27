import { del } from "@vercel/blob";
import { endSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { blobConfigured } from "@/lib/server/media";
import { fail, ok, readJson, researcher } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * Permanently deletes the signed-in researcher's account with all its studies, responses and
 * uploaded files. The request must repeat the account's email, as a confirmation.
 */
export async function DELETE(req: Request) {
  const user = await researcher();
  if (user instanceof Response) return user;
  const body = await readJson<{ email?: string }>(req, 1000);
  if (!body?.email || body.email.trim().toLowerCase() !== user.email.toLowerCase()) return fail("confirm", 400);
  const media = await sql<{ url: string }>`select url from media where owner_id = ${user.id}`;
  if (blobConfigured() && media.length) {
    // Remove files in small batches; a failure here must not keep the account alive.
    for (let i = 0; i < media.length; i += 100) await del(media.slice(i, i + 100).map((m) => m.url)).catch(() => {});
  }
  await endSession();
  await sql`delete from users where id = ${user.id}`;
  return ok({ deleted: true });
}
