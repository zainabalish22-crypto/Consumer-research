/**
 * Participant endpoints. Everything a participant sends is validated here
 * against the published study version before it reaches the database, where
 * SECURITY DEFINER functions check the session token and flow again.
 * Answers are never written to application logs.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { StudyConfig, isQuestionBlock } from "@/lib/study/schema";
import { validateBlockAnswers } from "@/lib/study/answers";
import { signMedia } from "@/lib/study/media";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const sessionAuth = { sessionId: z.string().uuid(), token: z.string().regex(/^[a-f0-9]{64}$/) };

const bodies = {
  start: z.object({
    slug: z.string().regex(/^[a-z0-9]{8,32}$/),
    language: z.enum(["en", "ar"]),
    test: z.boolean().default(false),
    params: z.record(z.string().max(64), z.string().max(200)).default({}),
    device: z.enum(["mobile", "tablet", "desktop"]).optional(),
  }),
  resume: z.object(sessionAuth),
  submit: z.object({
    ...sessionAuth,
    blockId: z.string().min(1).max(40),
    answers: z.record(z.string(), z.unknown()).default({}),
    enteredAt: z.string().datetime().optional(),
  }),
  consent: z.object({ ...sessionAuth, blockId: z.string().min(1).max(40), decision: z.enum(["given", "declined"]) }),
  complete: z.object(sessionAuth),
  withdraw: z.object(sessionAuth),
};
type Action = keyof typeof bodies;

const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, error, ...extra }, { status });

/** Map database errors to stable codes without echoing participant data. */
function dbError(message: string) {
  if (/invalid session/.test(message)) return fail(401, "invalidSession");
  if (/not available/.test(message)) return fail(404, "notAvailable");
  if (/not in progress/.test(message)) return fail(409, "notInProgress");
  if (/not reached/.test(message)) return fail(409, "outOfOrder");
  if (/forbidden/.test(message)) return fail(403, "forbidden");
  if (/language/.test(message)) return fail(400, "invalidLanguage");
  return fail(400, "rejected");
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!(action in bodies)) return fail(404, "unknownAction");

  const ip = clientKey(request.headers);
  const limit = action === "start" ? 20 : 240;
  if (!rateLimit(`${action}:${ip}`, limit, 60_000)) return fail(429, "rateLimited");

  let json: unknown;
  try {
    const text = await request.text();
    if (text.length > 200_000) return fail(413, "tooLarge");
    json = JSON.parse(text);
  } catch {
    return fail(400, "badJson");
  }
  const parsed = bodies[action as Action].safeParse(json);
  if (!parsed.success) return fail(400, "invalidRequest");

  // Uses the caller's cookies when present (researcher test sessions); anonymous otherwise.
  const supabase = await createClient();

  switch (action as Action) {
    case "start": {
      const b = parsed.data as z.infer<typeof bodies.start>;
      const { data, error } = await supabase.rpc("start_session", {
        p_slug: b.slug,
        p_language: b.language,
        p_is_test: b.test,
        p_recruitment: Object.fromEntries(Object.entries(b.params).slice(0, 20)),
        p_device: b.device ?? null,
      });
      if (error) return dbError(error.message);
      const s = data as { session_id: string; resume_token: string; version_number: number; config: unknown; is_test: boolean };
      return NextResponse.json({
        ok: true,
        sessionId: s.session_id,
        token: s.resume_token,
        versionNumber: s.version_number,
        isTest: s.is_test,
        config: s.config,
        mediaUrls: await signMedia(supabase, s.config),
      });
    }

    case "resume": {
      const b = parsed.data as z.infer<typeof bodies.resume>;
      const { data, error } = await supabase.rpc("load_session", { p_session_id: b.sessionId, p_token: b.token });
      if (error) return dbError(error.message);
      const s = data as {
        status: string;
        is_test: boolean;
        language: string;
        current_block_index: number;
        version_number: number;
        config: unknown;
        responses: Record<string, Record<string, unknown>>;
      };
      return NextResponse.json({
        ok: true,
        status: s.status,
        isTest: s.is_test,
        language: s.language,
        index: s.current_block_index,
        versionNumber: s.version_number,
        config: s.config,
        responses: s.responses,
        mediaUrls: s.status === "in_progress" ? await signMedia(supabase, s.config) : {},
      });
    }

    case "submit": {
      const b = parsed.data as z.infer<typeof bodies.submit>;
      const { data: session, error: loadErr } = await supabase.rpc("load_session", {
        p_session_id: b.sessionId,
        p_token: b.token,
      });
      if (loadErr) return dbError(loadErr.message);
      const config = StudyConfig.safeParse((session as { config: unknown }).config);
      if (!config.success) return fail(500, "configInvalid");
      const block = config.data.blocks.find((x) => x.id === b.blockId);
      if (!block) return fail(400, "unknownBlock");

      let answers: Record<string, unknown> = {};
      if (isQuestionBlock(block)) {
        const v = validateBlockAnswers(block, b.answers);
        if (!v.ok) return fail(422, "invalidAnswers", { errors: v.errors });
        answers = v.answers;
      } else if (Object.keys(b.answers).length) {
        return fail(400, "unexpectedAnswers");
      }

      const { data: next, error } = await supabase.rpc("submit_block", {
        p_session_id: b.sessionId,
        p_token: b.token,
        p_block_key: b.blockId,
        p_answers: answers,
        p_entered_at: b.enteredAt ?? null,
      });
      if (error) return dbError(error.message);
      return NextResponse.json({ ok: true, index: next });
    }

    case "consent": {
      const b = parsed.data as z.infer<typeof bodies.consent>;
      const { data: next, error } = await supabase.rpc("record_consent", {
        p_session_id: b.sessionId,
        p_token: b.token,
        p_block_key: b.blockId,
        p_decision: b.decision,
      });
      if (error) return dbError(error.message);
      return NextResponse.json({ ok: true, index: next });
    }

    case "complete": {
      const b = parsed.data as z.infer<typeof bodies.complete>;
      const { error } = await supabase.rpc("complete_session", { p_session_id: b.sessionId, p_token: b.token });
      if (error) return dbError(error.message);
      return NextResponse.json({ ok: true });
    }

    case "withdraw": {
      const b = parsed.data as z.infer<typeof bodies.withdraw>;
      const { error } = await supabase.rpc("withdraw_session", { p_session_id: b.sessionId, p_token: b.token });
      if (error) return dbError(error.message);
      return NextResponse.json({ ok: true });
    }
  }
}
