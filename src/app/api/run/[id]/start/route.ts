import { currentUser } from "@/lib/auth";
import { alreadyTookPart, createSession, draftForOwner, publishedStudy } from "@/lib/server/studies";
import { fail, ok, readJson } from "@/lib/server/http";
import { DEFAULT_SETTINGS, type Lang, type Study } from "@/lib/study/types";

export const dynamic = "force-dynamic";

type Body = { lang?: Lang; params?: Record<string, string>; deviceKey?: string; test?: boolean };

/**
 * Starts a participant's attempt. Checks that the study is open and applies its repeat rule.
 * Returns the session and a private token; only a browser holding the token can save to it.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readJson<Body>(req, 20_000);
  if (!body) return fail("bad", 400);
  const test = body.test === true;

  let study: Study | null;
  if (test) {
    const user = await currentUser().catch(() => null);
    if (!user) return fail("signIn", 401);
    study = await draftForOwner(user.id, id);
  } else {
    const found = await publishedStudy(id);
    if (found && found.state !== "open") return fail(found.state, 409);
    study = found?.study ?? null;
  }
  if (!study) return fail("notFound", 404);

  // Link parameters are kept as given (shortened), e.g. a panel's participant ID.
  const linkParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.params ?? {}).slice(0, 20)) if (k !== "test") linkParams[k.slice(0, 60)] = String(v).slice(0, 200);
  const panelParam = study.settings?.panelParam || DEFAULT_SETTINGS.panelParam;
  const panelId = linkParams[panelParam] || null;
  const deviceKey = typeof body.deviceKey === "string" ? body.deviceKey.slice(0, 80) : null;
  if (!test && (await alreadyTookPart(study, deviceKey, panelId))) return fail("repeat", 409);

  const lang: Lang = body.lang && study.languages.includes(body.lang) ? body.lang : study.languages[0];
  const startedAt = new Date().toISOString();
  const { session, token } = await createSession(
    { studyId: study.id, version: study.version, test, lang, status: "active", startedAt, params: linkParams, answers: {}, flags: [], events: [{ t: 0, type: "session_start", data: { lang } }] },
    test ? null : deviceKey,
    test ? null : panelId,
  );
  return ok({ session, token });
}
