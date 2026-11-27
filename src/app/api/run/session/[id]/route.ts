import { MAX_SESSION_CHARS, saveSession, sessionByToken } from "@/lib/server/studies";
import { fail, ok, readJson } from "@/lib/server/http";
import type { Session } from "@/lib/study/types";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
const tokenOf = (req: Request) => req.headers.get("x-session-token") ?? "";

/** Resumes an attempt in the browser that started it. */
export async function GET(req: Request, { params }: Ctx) {
  const session = await sessionByToken((await params).id, tokenOf(req));
  return session ? ok({ session }) : fail("notFound", 404);
}

/** Saves the participant's progress: answers, events and status. */
export async function PUT(req: Request, { params }: Ctx) {
  const next = await readJson<Session>(req, MAX_SESSION_CHARS);
  if (!next) return fail("bad", 400);
  const result = await saveSession((await params).id, tokenOf(req), next);
  if (result === "notFound") return fail("notFound", 404);
  if (result === "finished") return fail("finished", 409);
  return ok({ saved: true, quotaFull: result === "quotaFull" });
}
