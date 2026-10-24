import "server-only";
/**
 * Optional AI research assistant (Claude). Off unless the host sets
 * ANTHROPIC_API_KEY on the server; the key never reaches the browser.
 *
 * Only study text the researcher is editing is sent - never participant data.
 * Every suggestion is returned to the researcher, who decides what to apply.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export const AI_MODEL = "claude-opus-5-5";
/** Requests per researcher per 24 hours on this instance (AI_DAILY_LIMIT overrides). */
export const AI_DAILY_LIMIT = Math.max(1, Number(process.env.AI_DAILY_LIMIT) || 30);

export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/** Rules that apply to every task (the brief's safeguards). */
const SAFEGUARDS = `You are a research-methods assistant inside a consumer-behaviour research platform used by academic researchers in English and Arabic.

Ground rules:
- Offer suggestions, not facts. Where something is your judgement, present it as a suggestion.
- Never invent references, authors, citations, DOIs or published scale names. If an established instrument might fit, describe the construct and say the researcher should find and cite a validated scale themselves.
- Never claim that items or scales you draft are validated, reliable or standard. Drafted items are starting points that need piloting and validation.
- Never promise statistical validity, sufficient power, or ethical approval. Point to what the researcher should check with their ethics committee or a statistician instead.
- Arabic text must be Modern Standard Arabic suitable for questionnaires in the Gulf region, natural rather than word-for-word.
- Keep text concise and neutral; avoid leading or loaded wording in anything you draft.`;

export type AiResult<T> = { ok: true; data: T } | { ok: false; error: "aiDisabled" | "aiLimit" | "aiRefused" | "aiFailed" };

export async function usedToday(supabase: SupabaseClient, userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase.from("ai_requests").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
  return count ?? 0;
}

/**
 * One structured request. Checks the daily limit, calls Claude with a Zod
 * output schema, and logs only the task kind and token counts.
 */
export async function runAiTask<S extends z.ZodType>(opts: {
  supabase: SupabaseClient;
  userId: string;
  kind: string;
  schema: S;
  instructions: string;
  input: string;
  effort?: "low" | "medium" | "high";
}): Promise<AiResult<z.infer<S>>> {
  if (!aiEnabled()) return { ok: false, error: "aiDisabled" };
  if ((await usedToday(opts.supabase, opts.userId)) >= AI_DAILY_LIMIT) return { ok: false, error: "aiLimit" };
  try {
    const response = await getClient().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 16000,
      // If the model declines, the API retries on a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: `${SAFEGUARDS}\n\n${opts.instructions}`,
      output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
      messages: [{ role: "user", content: opts.input }],
    });
    await opts.supabase.from("ai_requests").insert({
      user_id: opts.userId,
      kind: opts.kind,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    });
    if (response.stop_reason === "refusal") return { ok: false, error: "aiRefused" };
    if (!response.parsed_output) return { ok: false, error: "aiFailed" };
    return { ok: true, data: response.parsed_output as z.infer<S> };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { ok: false, error: "aiLimit" };
    console.error("AI assistant request failed", error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
    return { ok: false, error: "aiFailed" };
  }
}
