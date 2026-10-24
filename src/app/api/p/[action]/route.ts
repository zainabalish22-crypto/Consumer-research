/**
 * Participant endpoints. Everything a participant sends is validated here
 * against the published study version before it reaches the database, where
 * SECURITY DEFINER functions check the session token, consent and variables again.
 * The flow (order, repetition, skip logic, screening) is computed here with the
 * same engine the participant page uses. Answers are never written to logs.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { StudyConfig, isQuestionBlock } from "@/lib/study/schema";
import { validateBlockAnswers } from "@/lib/study/answers";
import { validateFeedAnswer, validateShopAnswer, validateStoreChoice, validateVillageAnswer } from "@/lib/study/envAnswers";
import { signMedia } from "@/lib/study/media";
import { contextFor, evalLogic, nextStepIndex, resolveSteps, type Assignment } from "@/lib/study/flow";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const sessionAuth = { sessionId: z.string().uuid(), token: z.string().regex(/^[a-f0-9]{64}$/) };

const bodies = {
  start: z.object({
    slug: z.string().regex(/^[a-z0-9]{8,32}$/),
    language: z.enum(["en", "ar"]),
    test: z.boolean().default(false),
    params: z.record(z.string().max(64), z.string().max(200)).default({}),
    device: z.enum(["mobile", "tablet", "desktop"]).optional(),
    overrides: z
      .object({
        condition: z.string().max(20).optional(),
        factors: z.record(z.string().max(64), z.union([z.string().max(20), z.array(z.string().max(20)).max(12)])).optional(),
      })
      .default({}),
  }),
  resume: z.object(sessionAuth),
  submit: z.object({
    ...sessionAuth,
    stepKey: z.string().min(1).max(100),
    answers: z.record(z.string(), z.unknown()).default({}),
    identifier: z.string().max(254).optional(),
    enteredAt: z.string().datetime().optional(),
  }),
  consent: z.object({ ...sessionAuth, stepKey: z.string().min(1).max(100), decision: z.enum(["given", "declined"]) }),
  complete: z.object(sessionAuth),
  withdraw: z.object(sessionAuth),
  events: z.object({
    ...sessionAuth,
    events: z
      .array(
        z.object({
          id: z.string().uuid(),
          type: z.string().regex(/^[a-z_]{2,40}$/),
          block: z.string().max(100).optional(),
          at: z.string().datetime(),
          data: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean(), z.null()])).optional(),
        }),
      )
      .max(100),
  }),
};
type Action = keyof typeof bodies;

const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, error, ...extra }, { status });

/** Map database errors to stable codes without echoing participant data. */
function dbError(message: string) {
  if (/invalid session/.test(message)) return fail(401, "invalidSession");
  if (/not available/.test(message)) return fail(404, "notAvailable");
  if (/study is full/.test(message)) return fail(409, "studyFull");
  if (/not in progress/.test(message)) return fail(409, "notInProgress");
  if (/not reached/.test(message)) return fail(409, "outOfOrder");
  if (/forbidden/.test(message)) return fail(403, "forbidden");
  if (/language/.test(message)) return fail(400, "invalidLanguage");
  return fail(400, "rejected");
}

interface LoadedSession {
  status: string;
  is_test: boolean;
  language: string;
  current_block_index: number;
  consent_given: boolean;
  completion_code: string | null;
  version_number: number;
  config: unknown;
  assignment: Assignment;
  params: Record<string, string>;
  responses: Record<string, Record<string, unknown>>;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!(action in bodies)) return fail(404, "unknownAction");

  const ip = clientKey(request.headers);
  const limit = action === "start" ? 20 : 300;
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

  const load = async (sessionId: string, token: string) => {
    const { data, error } = await supabase.rpc("load_session", { p_session_id: sessionId, p_token: token });
    if (error) return { error: dbError(error.message) } as const;
    const s = data as LoadedSession;
    const config = StudyConfig.safeParse(s.config);
    if (!config.success) return { error: fail(500, "configInvalid") } as const;
    const steps = resolveSteps(config.data, s.assignment, sessionId);
    return { s, config: config.data, steps } as const;
  };

  switch (action as Action) {
    case "start": {
      const b = parsed.data as z.infer<typeof bodies.start>;
      const { data, error } = await supabase.rpc("start_session", {
        p_slug: b.slug,
        p_language: b.language,
        p_is_test: b.test,
        p_recruitment: Object.fromEntries(Object.entries(b.params).slice(0, 20)),
        p_device: b.device ?? null,
        p_overrides: b.test ? b.overrides : {},
      });
      if (error) return dbError(error.message);
      const s = data as {
        session_id: string;
        resume_token: string;
        version_number: number;
        config: unknown;
        is_test: boolean;
        assignment: Assignment;
        params: Record<string, string>;
      };
      const config = StudyConfig.safeParse(s.config);
      if (!config.success) return fail(500, "configInvalid");
      const steps = resolveSteps(config.data, s.assignment, s.session_id);
      const first = nextStepIndex(config.data, steps, -1, s.assignment, {}, s.params);
      return NextResponse.json({
        ok: true,
        sessionId: s.session_id,
        token: s.resume_token,
        versionNumber: s.version_number,
        isTest: s.is_test,
        config: s.config,
        assignment: s.assignment,
        params: s.params,
        index: Math.max(0, first),
        mediaUrls: await signMedia(supabase, s.config),
      });
    }

    case "resume": {
      const b = parsed.data as z.infer<typeof bodies.resume>;
      const r = await load(b.sessionId, b.token);
      if ("error" in r) return r.error;
      const { s } = r;
      return NextResponse.json({
        ok: true,
        status: s.status,
        isTest: s.is_test,
        language: s.language,
        index: s.current_block_index,
        versionNumber: s.version_number,
        config: s.config,
        assignment: s.assignment,
        params: s.params,
        responses: s.responses,
        completionCode: s.completion_code,
        mediaUrls: s.status === "in_progress" ? await signMedia(supabase, s.config) : {},
      });
    }

    case "submit": {
      const b = parsed.data as z.infer<typeof bodies.submit>;
      const r = await load(b.sessionId, b.token);
      if ("error" in r) return r.error;
      const { s, config, steps } = r;
      const stepIndex = steps.findIndex((x) => x.key === b.stepKey);
      if (stepIndex < 0) return fail(400, "unknownBlock");
      const block = config.blocks.find((x) => x.id === steps[stepIndex].blockId)!;
      if (block.type === "consent") return fail(400, "unknownBlock");

      let answers: Record<string, unknown> = {};
      if (isQuestionBlock(block)) {
        const v = validateBlockAnswers(block, b.answers);
        if (!v.ok) return fail(422, "invalidAnswers", { errors: v.errors });
        answers = v.answers;
      } else if (block.type === "village" || block.type === "store_choice" || block.type === "online_shop" || block.type === "social_feed") {
        // Stores, products, offers and budget are checked against the published version.
        const raw = b.answers[block.variable];
        const v =
          block.type === "village"
            ? validateVillageAnswer(block, config, s.assignment, raw)
            : block.type === "online_shop"
              ? validateShopAnswer(block, config, s.assignment, raw)
              : block.type === "social_feed"
                ? validateFeedAnswer(block, raw)
                : validateStoreChoice(block, raw);
        if (!v.ok || Object.keys(b.answers).length !== 1) return fail(422, "invalidAnswers", { errors: { [block.variable]: v.ok ? "invalid" : v.error } });
        answers = { [block.variable]: v.value };
      } else if (Object.keys(b.answers).length) {
        return fail(400, "unexpectedAnswers");
      }

      // Cross-study exclusion: only a salted hash is kept, inside the database.
      if (block.type === "exclusion_check") {
        const id = (b.identifier ?? "").trim();
        const valid = block.inputKind === "email" ? z.string().email().safeParse(id).success : id.length >= 3;
        if (!valid) return fail(422, "invalidAnswers", { errors: { identifier: "invalid" } });
        const { data: excluded, error } = await supabase.rpc("check_exclusion", {
          p_session_id: b.sessionId,
          p_token: b.token,
          p_block_key: b.stepKey,
          p_identifier: id,
        });
        if (error) return dbError(error.message);
        if (excluded) return NextResponse.json({ ok: true, screenedOut: true, reason: "repeat_participant" });
      }

      const responses = { ...s.responses, [b.stepKey]: answers };
      const next = nextStepIndex(config, steps, stepIndex, s.assignment, responses, s.params);
      const { error } = await supabase.rpc("submit_block", {
        p_session_id: b.sessionId,
        p_token: b.token,
        p_block_key: b.stepKey,
        p_answers: answers,
        p_entered_at: b.enteredAt ?? null,
        p_next_index: next < 0 ? stepIndex : next,
      });
      if (error) return dbError(error.message);

      // Screening: answers are stored, then ineligible participants are thanked and the session ends.
      if (block.type === "screening" && !evalLogic(block.eligibleIf, contextFor(s.assignment, responses, s.params, steps[stepIndex]))) {
        const { error: soErr } = await supabase.rpc("screen_out_session", { p_session_id: b.sessionId, p_token: b.token, p_reason: "ineligible" });
        if (soErr) return dbError(soErr.message);
        return NextResponse.json({ ok: true, screenedOut: true, reason: "ineligible" });
      }
      return NextResponse.json({ ok: true, index: next });
    }

    case "consent": {
      const b = parsed.data as z.infer<typeof bodies.consent>;
      const r = await load(b.sessionId, b.token);
      if ("error" in r) return r.error;
      const { s, config, steps } = r;
      const stepIndex = steps.findIndex((x) => x.key === b.stepKey);
      if (stepIndex < 0) return fail(400, "unknownBlock");
      const next = nextStepIndex(config, steps, stepIndex, s.assignment, s.responses, s.params);
      const { data, error } = await supabase.rpc("record_consent", {
        p_session_id: b.sessionId,
        p_token: b.token,
        p_block_key: steps[stepIndex].blockId,
        p_decision: b.decision,
        p_next_index: next < 0 ? stepIndex : next,
      });
      if (error) return dbError(error.message);
      return NextResponse.json({ ok: true, index: b.decision === "given" ? next : data });
    }

    case "complete": {
      const b = parsed.data as z.infer<typeof bodies.complete>;
      const { data, error } = await supabase.rpc("complete_session", { p_session_id: b.sessionId, p_token: b.token });
      if (error) return dbError(error.message);
      return NextResponse.json({ ok: true, completionCode: (data as { completion_code: string | null }).completion_code });
    }

    case "withdraw": {
      const b = parsed.data as z.infer<typeof bodies.withdraw>;
      const { error } = await supabase.rpc("withdraw_session", { p_session_id: b.sessionId, p_token: b.token });
      if (error) return dbError(error.message);
      return NextResponse.json({ ok: true });
    }

    case "events": {
      const b = parsed.data as z.infer<typeof bodies.events>;
      if (!b.events.length) return NextResponse.json({ ok: true, stored: 0 });
      const { data, error } = await supabase.rpc("log_events", { p_session_id: b.sessionId, p_token: b.token, p_events: b.events });
      if (error) return dbError(error.message);
      return NextResponse.json({ ok: true, stored: data });
    }
  }
}
