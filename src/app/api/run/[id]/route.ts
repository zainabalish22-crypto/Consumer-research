import { currentUser } from "@/lib/auth";
import { draftForOwner, publishedStudy } from "@/lib/server/studies";
import { fail, ok } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * The study a participant receives: the newest published version and whether it is open.
 * With ?test=1 the owner gets their current draft, for previewing.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (new URL(req.url).searchParams.get("test") === "1") {
    const user = await currentUser().catch(() => null);
    if (!user) return fail("signIn", 401);
    const study = await draftForOwner(user.id, id);
    return study ? ok({ study, state: "open" }) : fail("notFound", 404);
  }
  const found = await publishedStudy(id);
  return found ? ok(found) : fail("notFound", 404);
}
