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

## Phase 2: experimental design engine

- **Assignment happens in the database** (`assign_design`, called inside `start_session`), never in the browser, so participants cannot choose their condition. Test links may force a condition or factor values; real participants' overrides are ignored.
- **Balanced = permuted blocks** driven by atomic per-study counters (`assignment_counters`). Within every block of size *sum of weights*, each condition appears exactly by its weight, in a seeded random order. Abandoned sessions still use their slot (standard for block randomisation).
- **Quotas count completed, non-test sessions.** A full condition stops receiving people; when all are full the study answers "full". In-progress sessions are not counted, so a condition can slightly overshoot its quota.
- **Factors**: *pick* (one level; balanced/random/fixed), *order* (all levels; balanced Latin square, full permutation, random, fixed), *mapping* (levels onto targets one-to-one, e.g. offers onto stores). Latin squares are Williams designs (n rows for even n, 2n for odd n), so positions and first-order carry-over are balanced. Balancing is per condition by default.
- **Block order groups** reuse the same methods; blocks keep their slots and are filled in the participant's order.
- **Repetition per stimulus**: a block can repeat once per level of a factor (assigned order, listed, or random). Responses are stored under `blockId#level` and exported as `variable_level`. `{{stimulus}}` and `{{factor:variable}}` are piped into text.
- **Skip/branch logic** is a small rule language (all/any of: earlier answer, condition, factor, URL parameter, current repetition × equals/in/greater-than/answered…). It is evaluated by one shared TypeScript module in the browser, preview and server route. The database still enforces token, consent-before-content and allowed variables; the full flow order is enforced by the app server (see Known limitations in the README).
- **Screening** blocks end the session politely when the eligibility rule fails; answers are kept and the session is `screened_out` with a reason.
- **Cross-study exclusion** stores only `sha256(salt + normalised identifier)` in lists private to the workspace; salts and hashes are never readable by researchers or participants. Test sessions never write to lists.
- **Unique completion codes** are generated at completion and stored with the session. Redirect URLs can contain `{code}`, `{session}` and any link parameter.
- **Events** are batched in the browser (UUID per event, so retries never duplicate), kept in localStorage while offline, and flushed on page hide. Only coarse events are allowed by the database (an allow-list); no keystrokes, pointer paths, camera, microphone or location. Withdrawal deletes a participant's events as well as answers.
- **Computed variables** (Phase 2): per media asset, seconds visible (≥50% in view), furthest progress quartile, number of plays.
- **SPSS syntax** reads the wide CSV in Unicode mode and applies variable labels, value labels, measurement levels and −98/−99 as user-missing, with English or Arabic labels.
- **Methodological warnings** never block publishing; dismissals are stored in the draft and written to the audit log.

## Phase 4: online shop and choosing research tools

- **Choosing tools at creation.** A new study starts from one or more research tools: the shopping village, the online shop and the questionnaire. With two or more, the researcher picks how they combine:
  - *Everyone uses every tool* (within-subjects). The order is the same for everyone, or counterbalanced with a Latin-square block order group (`tools`).
  - *Each participant gets one tool* (between-subjects). One condition per tool, balanced assignment, and each tool block is shown only to its condition.
  This is only a starting configuration made of normal blocks, conditions and order groups: everything stays editable in the builder, and no study is hard-coded. A demographics page is added by default and can be removed.
- **The online shop is a block** (`online_shop`), like the village. Products, offers and ads come from the library and are snapshotted at publish. Product order, offers and ad versions use the same factor machinery as the village (order factors, mapping factors, targeted AI versions and disclosure labels).
- **No payment or address details are ever collected.** Checkout shows the cart, a total and a notice that the shop is simulated, then a "Place order" button. The study records only the cart.
- **Ratings and reviews are stimuli written by the researcher** in the library. They are stored with a comment saying so, and the library tells researchers to explain fictional reviews in the debrief.
- **Sponsored products** keep their position from the product order but are lifted to the top of the default ("Featured") listing and the home page, with a "Sponsored" label. Exported positions are the product order before this lift.
- **Search queries** are logged in the event log (at most 100 characters), because search terms are a research variable. Typing itself is not logged, only submitted searches. The wide export counts searches; the queries are in the event log.
- **Scroll depth** is the highest percentage of the page scrolled, logged once when the participant leaves each shop page. Pointer movement is not recorded.
- **Answers are checked on the server** against the published version: products must belong to the shop, there are no duplicate lines, and min/max items and budget are enforced. A time-out may end with fewer items than the minimum.

## Phase 5: analytics, templates, self-hosting

- **Analytics use the export loader and pure functions** (`src/lib/analytics/compute.ts`), so the numbers on screen and in the CSV come from the same data. Questions and blocks follow the newest version; answers from older versions count when their variable names match.
- **Test and excluded sessions are hidden by default.** Including test sessions shows a warning that they are not real participants. There is no sample or seed data.
- **Charts are HTML tables with drawn bars**, not a chart library. Every number is written out, so the charts work with screen readers, right-to-left text and printing, and the bundle stays small. A chart library can be added later if richer charts are needed.
- **Blocks shown only to some conditions export blanks for the others.** Their position, offer and ad-version columns are left empty for participants who never saw them, rather than showing assigned values that never reached the screen.
- **The analytics funnel counts consent from consent records**, because consent is not stored as a block answer. Starts per day are grouped by UTC date, and the page says so.
- **Open-text answers are not shown in analytics**, only counted. They can contain identifying details; they are in the CSV export.
- **Saved templates** (`study_templates`) are copies of a study's draft configuration, private to the workspace (row-level security like the library). Library items stay in the library and are referenced by id, so a template can only be used in its own workspace. Dismissed warnings are not copied. Ready-made templates (A and B) are still created by code through the normal builder format.
- **Self-hosting** needs Supabase (self-hosted or cloud), because the app relies on its sign-in, storage and row-level security; plain PostgreSQL on its own is not enough. The app needs only the public URL and publishable key, which are build-time values.
- **Landmarks:** the studio has one `<main>`. The participant page uses `<main>` when live, but not inside the studio preview, so landmarks never nest.

## Phase 6: extensions

- **Social feed** is a block like the village and the shop. Organic posts are written in the block; sponsored posts show library ads, so AI versions and disclosure labels work the same way as everywhere else. Like counts are stimuli set by the researcher, and the builder says so. Viewing time is recorded per post (at least half on screen). Posts appear as listed or in random order; factor-based order is not offered, because posts are not library items.
- **Constant sum** stores `{option value: points}` and must add up to the total exactly, checked on the server. Unallocated options export as 0.
- **Themes** change colours and paving only. Souq-inspired uses warm stone and arcade paving, with no figures, costumes or other stereotyped imagery.
- **Team workspaces** reuse the existing `workspace_members` roles. Invitations are matched to the invitee's signed-in email and accepted in Settings, so no mail server is needed. The database enforces every rule (owners invite and change roles, a workspace always keeps an owner, personal workspaces cannot be shared). Deleting an account now keeps shared team workspaces and hands them to the longest-standing member. Previously, deleting the creator would have deleted colleagues' work.
- **Viewers** are enforced by row-level security. The interface shows "View only", but editing controls are not yet hidden, so a viewer who tries to change something gets a save error.
- **AI assistant** is optional and off without `ANTHROPIC_API_KEY`:
  - It uses one instance-wide key, server-only. Researchers' own keys are not supported yet, because storing keys safely needs encryption at rest.
  - It runs structured (JSON schema) requests on Claude Opus 5.5 with server-side refusal fallback.
  - The system prompt forbids invented references, claims that items are validated, and guarantees of validity or ethical approval.
  - Only study text is sent. Analysis suggestions receive the design and variable names, never responses.
  - Outputs are suggestions: wording and translations are applied per item by the researcher, into the draft only. An outline becomes a new draft study only when the researcher clicks Create.
  - Each researcher gets a daily request limit, logged as counts only.

## Hosting region

- The hosted instance uses a Supabase project in **eu-central-1 (Frankfurt)** (`research-platform-eu`). Some ethics committees and data-protection laws (e.g. Bahrain's PDPL) care where data is stored; EU storage under GDPR is generally the easiest location to justify, and Supabase has no Gulf region. An earlier empty project in Tokyo (ap-northeast-1) is not used. This is not legal advice: check any storage-location rule your institution has.
