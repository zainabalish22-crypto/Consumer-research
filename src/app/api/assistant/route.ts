import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/assistant/guide";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-opus-5-5";
/** Questions per researcher per day on the host's key. A researcher's own key has no limit here. */
const DAILY_LIMIT = Number(process.env.ASSISTANT_DAILY_LIMIT || 30);
const MAX_TURNS = 20;
const MAX_TURN_CHARS = 8000;
const MAX_CONTEXT_CHARS = 30000;

type Turn = { role: "user" | "assistant"; text: string };
type Body = { messages?: Turn[]; context?: { page?: string; locale?: string; title?: string; detail?: string } };
/** One line of the reply stream: a piece of text, or the end (with an error code when it failed). */
type Line = { t: string } | { done: true; error?: string };

const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * The research assistant. Signed-in researchers only. The host's key (ANTHROPIC_API_KEY) is used
 * up to a daily limit per researcher; a researcher may send their own key instead, which is used
 * for that request only and never stored. Only what the page sends is passed on: the researcher's
 * own study text, never participant answers.
 */
export async function POST(req: Request) {
  let user;
  try {
    user = await currentUser();
  } catch {
    return fail("unavailable", 503);
  }
  if (!user) return fail("signIn", 401);

  const ownKey = req.headers.get("x-anthropic-key")?.trim() ?? "";
  if (ownKey && !/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(ownKey)) return fail("badKey", 400);
  const apiKey = ownKey || process.env.ANTHROPIC_API_KEY || "";
  if (!apiKey) return fail("notSetUp", 503);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return fail("bad", 400);
  }
  const turns = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, text: m.text.slice(0, MAX_TURN_CHARS) }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== "user") return fail("bad", 400);

  if (!ownKey) {
    const rows = await sql<{ requests: number }>`select requests from assistant_usage where user_id = ${user.id} and day = current_date`;
    if ((rows[0]?.requests ?? 0) >= DAILY_LIMIT) return fail("limit", 429);
  }

  // The page and open study go with the newest question, after the cached instructions.
  const c = body.context ?? {};
  const pageContext = [
    `Page: ${String(c.page ?? "unknown").slice(0, 200)}`,
    `Interface language: ${c.locale === "ar" ? "Arabic" : "English"}`,
    c.title ? `On screen: ${String(c.title).slice(0, 300)}` : "",
    c.detail ? `What the researcher has open:\n${String(c.detail).slice(0, MAX_CONTEXT_CHARS)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((m, i) =>
    i === turns.length - 1
      ? { role: "user", content: [{ type: "text", text: `<page_context>\n${pageContext}\n</page_context>` }, { type: "text", text: m.text }] }
      : { role: m.role, content: m.text },
  );

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();
  const userId = user.id;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (line: Line) => controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
      try {
        const reply = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 4000,
          // Short, practical answers: low effort keeps them quick and inexpensive.
          output_config: { effort: "low" },
          // If a safety check declines the request, the API retries it on a fallback model.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          messages,
        });
        reply.on("text", (t) => send({ t }));
        const final = await reply.finalMessage();
        if (!ownKey) {
          const u = final.usage;
          const input = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
          // A failed count must not turn a delivered answer into an error.
          await sql`insert into assistant_usage (user_id, day, requests, input_tokens, output_tokens)
            values (${userId}, current_date, 1, ${input}, ${u.output_tokens ?? 0})
            on conflict (user_id, day) do update set
              requests = assistant_usage.requests + 1,
              input_tokens = assistant_usage.input_tokens + excluded.input_tokens,
              output_tokens = assistant_usage.output_tokens + excluded.output_tokens`.catch(() => {});
        }
        send(final.stop_reason === "refusal" ? { done: true, error: "declined" } : { done: true });
      } catch (e) {
        const code =
          e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError
            ? ownKey
              ? "badKey"
              : "notSetUp"
            : e instanceof Anthropic.RateLimitError
              ? "busy"
              : "failed";
        send({ done: true, error: code });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
