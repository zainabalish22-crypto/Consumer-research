import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { RESET_COOKIE } from "@/lib/auth-constants";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Email links (confirmation, password reset) land here. Supports both
 * `?code=` (PKCE, needs the same browser) and `?token_hash=&type=`
 * (works in any browser, if the Supabase email templates link that way).
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const supabase = await createClient();
  const code = p.get("code");
  const tokenHash = p.get("token_hash");
  const type = p.get("type") as EmailOtpType | null;
  const resetPending = request.cookies.get(RESET_COOKIE)?.value === "1";

  let ok = false;
  let recovery = type === "recovery";
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
    recovery = recovery || resetPending;
  }

  if (ok) {
    const res = NextResponse.redirect(new URL(recovery ? "/login/reset" : "/studio", request.url));
    if (recovery) res.cookies.delete(RESET_COOKIE);
    return res;
  }

  // Supabase passes its own reason (e.g. "Email link is invalid or has expired") when a link fails.
  const reason = p.get("error_code") ?? (code ? "pkce" : "link");
  const target = new URL("/login", request.url);
  target.searchParams.set("error", "link");
  target.searchParams.set("reason", reason.slice(0, 40));
  return NextResponse.redirect(target);
}
