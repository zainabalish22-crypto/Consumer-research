# Decisions

Reasonable, reversible defaults chosen where the brief left room. Newest at the bottom of each section.

## Platform

- **Working name**: "Research Platform" / «منصة البحث», set in `src/config/platform.ts` and `messages/*.json` (`common.platformName`). Change it in those two places.
- **Next.js 15** (not 16): 15 is the mature line with known App Router behaviour; upgrading later is mechanical.
- **TypeScript 5** pinned: Next 15's type checking expects the TypeScript 5 API (TypeScript 7 is the new native compiler).
- **No shadcn/ui CLI**: a small set of accessible Tailwind components lives in `src/components/ui.tsx`. Fewer dependencies, easier to self-host; can be swapped for shadcn later.
- **next-intl without locale in the URL**: interface language is a cookie (`locale`), defaulting to the browser's language. Participant pages use the *study* language, chosen by the participant, independent of the interface language.
- **Font**: IBM Plex Sans Arabic (open licence, covers Arabic and Latin).

## Accounts and data

- **Sign-in**: email + password through Supabase Auth. Email confirmation is on by default in Supabase cloud (see README for SMTP limits).
- **Workspaces**: each researcher gets one personal workspace on sign-up. Team workspaces (free) come later; the schema already has `workspace_members.role`.
- **No service-role key needed in Phase 1**. Participants never write tables directly; they call `SECURITY DEFINER` functions that verify a per-session secret token (stored only as a SHA-256 hash) and re-check the flow. Researchers use their own session under RLS. This also makes self-hosting simpler.
- **Validation happens twice**: the Next.js route validates answers with the shared Zod/answer rules; the database functions independently check token, block existence, flow order (no skipping past consent) and allowed variable names.
- **Rate limiting** is in-memory per server instance (see `docs/LIMITS.md` for what that means on serverless hosting).
- **Withdrawal** deletes the participant's answers and keeps the session row with status `withdrawn`, so start/completion counts stay honest. Consent records are kept as the record of what was agreed.
- **Draft vs published**: drafts can be incomplete and are saved after a structural check; the full schema is enforced when publishing. Publishing an unchanged draft does not create a new version.
- **Status**: publishing a draft study makes it `active`. Researchers can pause, close and re-open. Test links work whenever a published version exists, even when paused or closed.
- **Account deletion** removes the researcher's media files, workspace, studies, participant data and auth user (`delete_my_account()`).
- **Retention defaults**: the column exists, but automatic deletion is not implemented yet, so the setting is not shown in the UI (no controls that do nothing).

## Study engine

- **Block registry**: a block type = a Zod schema entry in `src/lib/study/schema.ts` + an editor in `src/components/builder/BlockEditor.tsx` (`EDITORS` map, typed so a missing editor is a compile error) + a renderer case in `StudyRunner`. Phase 2 will move renderers into the same map pattern when more blocks arrive.
- **Text formatting**: study text is plain text with line breaks (no HTML, which avoids injection). Rich text (bold, links, lists) can be added later with a safe Markdown subset.
- **Special answer codes**: "Not sure" = −98, "Prefer not to say" = −99. They are exclusive in multiple-choice questions.
- **Randomisation** of options/questions is seeded by session ID + item ID (mulberry32), so a participant's order can be reproduced exactly from the data.
- **Ranking**: the order first shown counts as the answer unless the participant changes it.
- **Slider**: must be touched to count as answered (no default value is recorded).
- **Demographics block** is a questionnaire block with editable preset questions (age, gender with "prefer not to say", education).
- **Arabic-Indic digits** typed into number fields are converted to ASCII digits.

## Export

- **Wide CSV**: UTF-8 with BOM, CRLF line endings, one row per session, stable variable names. Multiple choice → one 0/1 column per option (`var_code`); ranking → rank per option; matrix → one column per row (`var_rowcode`). Unanswered = empty (never 0).
- **Spreadsheet-formula protection**: participant *text* answers that begin with `= + - @` get a leading `'` so they cannot run as formulas when opened in Excel. Numeric columns are never altered.
- **Columns across versions** are merged by name (newest labels win), so one file covers all versions; `study_version` says which version each row used.
- **Test sessions** are excluded unless "Include test sessions" is ticked.
- **SPSS syntax and the event log** are Phase 2 (as in the roadmap).

## Hosting region

- The hosted instance uses a Supabase project in **eu-central-1 (Frankfurt)** (`research-platform-eu`). Some ethics committees and data-protection laws (e.g. Bahrain's PDPL) care where data is stored; EU storage under GDPR is generally the easiest location to justify, and Supabase has no Gulf region. An earlier empty project in Tokyo (ap-northeast-1) is not used. This is not legal advice: check any storage-location rule your institution has.
