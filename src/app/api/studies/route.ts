import { listStudies } from "@/lib/server/studies";
import { ok, researcher } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** The signed-in researcher's studies, newest first, with response counts. */
export async function GET() {
  const user = await researcher();
  if (user instanceof Response) return user;
  return ok({ studies: await listStudies(user.id) });
}
