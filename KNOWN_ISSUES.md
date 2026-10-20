# Known issues

## 1. Email links only work in the browser where they were requested (mitigated)

- **Cause**: Supabase's default email links use the PKCE flow, which needs a code stored in the browser that asked for the email. Opening the link in another browser (e.g. the mail app opens Chrome) cannot finish signing in. The email address *is* confirmed by then.
- **Now in the app**: clear messages explaining what happened; "Forgot password?" (reset by email, then set a new password); "Resend confirmation email"; a clear message when signing up with an email that already has an account.
- **Permanent fix (one-off, in Supabase)**: make the email links work in any browser. In **Authentication → Emails**, edit these templates and replace `{{ .ConfirmationURL }}` with:
  - *Confirm signup*: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`
  - *Reset password*: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery`
  The app's `/auth/callback` already handles both link styles.

## 2. Online shop categories are not translated

A product's category is one free-text field in the library, so filter chips and the category menu show the same text in both languages. Write categories in the study's main language, or in both (e.g. "Coffee / قهوة"), until categories get their own bilingual field.
