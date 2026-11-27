import { deleteSessions, listSessions } from "@/lib/server/studies";
import { fail, ok, researcher } from "@/lib/server/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** All responses of a study, including unfinished and test ones (the screen filters them). */
export async function GET(_req: Request, { params }: Ctx) {
  const user = await researcher();
  if (user instanceof Response) return user;
  const sessions = await listSessions(user.id, (await params).id);
  return sessions ? ok({ sessions }) : fail("notFound", 404);
}

/** Deletes all responses of a study; ?test=1 also deletes test responses. */
export async function DELETE(req: Request, { params }: Ctx) {
  const user = await researcher();
  if (user instanceof Response) return user;
  const includeTest = new URL(req.url).searchParams.get("test") === "1";
  await deleteSessions(user.id, (await params).id, includeTest);
  return ok({ deleted: true });
}
