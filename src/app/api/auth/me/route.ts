import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Who is signed in, for the header. Returns only the email. */
export async function GET() {
  try {
    const user = await currentUser();
    return NextResponse.json({ user: user ? { email: user.email } : null }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
