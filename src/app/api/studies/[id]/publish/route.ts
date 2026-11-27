import { publishStudy } from "@/lib/server/studies";
import { fail, ok, researcher } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Publishes the current draft as the next locked version. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await researcher();
  if (user instanceof Response) return user;
  const row = await publishStudy(user.id, (await params).id);
  return row ? ok(row) : fail("notFound", 404);
}
