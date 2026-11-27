import { deleteStudy, getStudy, MAX_STUDY_CHARS, saveStudy } from "@/lib/server/studies";
import { fail, ok, readJson, researcher } from "@/lib/server/http";
import type { Study } from "@/lib/study/types";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const user = await researcher();
  if (user instanceof Response) return user;
  const row = await getStudy(user.id, (await params).id);
  return row ? ok(row) : fail("notFound", 404);
}

/** Creates the study if it is new, or saves the draft. */
export async function PUT(req: Request, { params }: Ctx) {
  const user = await researcher();
  if (user instanceof Response) return user;
  const { id } = await params;
  const study = await readJson<Study>(req, MAX_STUDY_CHARS);
  if (!study || study.id !== id || !Array.isArray(study.blocks)) return fail("bad", 400);
  if (!(await saveStudy(user.id, study))) return fail("forbidden", 403);
  const row = await getStudy(user.id, id);
  return ok({ meta: row?.meta });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await researcher();
  if (user instanceof Response) return user;
  await deleteStudy(user.id, (await params).id);
  return ok({ deleted: true });
}
