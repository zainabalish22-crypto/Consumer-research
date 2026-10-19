# Known issues (to review together)

## 1. Email confirmation link fails when opened in a different browser

- **Seen**: 2026-10-19. `GET /auth/callback?code=…` → redirect to `/login?error=link`.
- **Cause**: Supabase's PKCE flow stores a code verifier in the browser that signed up. Opening the email link in another browser (e.g. the mail app opens Chrome, sign-up happened elsewhere) cannot finish the exchange. The email address *is* confirmed; only the automatic sign-in fails.
- **Workaround**: sign in with email and password. The error message now says so.
- **Planned fix**: add `/auth/confirm` using `verifyOtp({ token_hash, type })` and change the Supabase "Confirm signup" email template to link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`, which works in any browser.
