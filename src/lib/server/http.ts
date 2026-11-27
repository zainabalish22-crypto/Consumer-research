import "server-only";

import { NextResponse } from "next/server";
import { currentUser, type User } from "@/lib/auth";

export const noStore = { "Cache-Control": "no-store" };
export const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });
export const ok = (body: unknown) => NextResponse.json(body, { headers: noStore });

/** The signed-in researcher, or a 401 response to return as is. */
export async function researcher(): Promise<User | Response> {
  try {
    return (await currentUser()) ?? fail("signIn", 401);
  } catch {
    return fail("unavailable", 503);
  }
}

/** Reads a JSON body no longer than the limit (in characters). */
export async function readJson<T>(req: Request, max: number): Promise<T | null> {
  const text = await req.text();
  if (text.length > max) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
