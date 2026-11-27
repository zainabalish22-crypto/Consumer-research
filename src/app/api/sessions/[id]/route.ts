import { deleteSession } from "@/lib/server/studies";
import { ok, researcher } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Deletes one response of one of the researcher's studies. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await researcher();
  if (user instanceof Response) return user;
  await deleteSession(user.id, (await params).id);
  return ok({ deleted: true });
}
