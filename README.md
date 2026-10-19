# Research Platform (working name)

A free, bilingual (Arabic/English) platform for consumer-behaviour research: build a study as an ordered flow of blocks, run it with participants, and export clean data. See `docs/PLATFORM_BRIEF.md` for the full product brief and `DECISIONS.md` for choices made during the build.

> Not yet open source: no licence has been chosen and the code is not published.

## Status

**Phase 1 (foundation and questionnaires): built and tested locally.**

| Area | State |
|---|---|
| Bilingual interface (AR/EN, RTL/LTR) | Done |
| Sign-up / sign-in, personal workspace | Done |
| Projects: create, edit, duplicate, archive, delete | Done |
| Studies: create from blank / questionnaire / media starting point, rename, duplicate, delete | Done |
| Block flow editor: add, remove, duplicate, drag-and-drop + arrow reordering, live validation | Done |
| Blocks: welcome, consent, instructions, questionnaire, demographics, media exposure, end | Done |
| 12 question types, required, randomised options, "not sure"/"prefer not to say", attention checks | Done |
| Media library: upload with progress, type/size checks, optional image compression, folders, tags | Done |
| Publish â†’ immutable versions, lock, public link, test link, pause/close | Done |
| Participant renderer: language choice, consent, resume after refresh, withdrawal, completion code, redirect | Done |
| Preview (draft, nothing saved) and flagged test sessions | Done |
| Wide CSV + bilingual codebook + config snapshot export; test data excluded by default | Done |
| Session list, exclusion flags, delete test sessions, basic counts | Done |
| Account deletion | Done |
| Seed script with labelled sample data | Not yet |
| Methodological warnings, conditions, factors, branching, SPSS syntax, event log | Phase 2 |
| Shopping village, online shop | Phases 3â€“4 |
| Docker self-hosting guide | Phase 5 |

## Requirements

- Node.js 20 or newer
- A Supabase project (free tier is fine), or self-hosted Supabase

## Set-up

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your Supabase URL and publishable key.

3. Apply the database migrations in `supabase/migrations/` in filename order. Either:
   - paste each file into **Supabase Dashboard â†’ SQL Editor** and run it, or
   - use the Supabase CLI: `npx supabase link --project-ref YOUR-REF` then `npx supabase db push`.

4. In **Supabase â†’ Authentication â†’ URL Configuration**, set the Site URL to where the app runs (e.g. `http://localhost:3000`) and add `http://localhost:3000/auth/callback` to the redirect URLs.

5. Run the app:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

### Email confirmation

Supabase cloud sends confirmation emails from a shared server limited to a few emails per hour. For real use, add your own SMTP server under **Authentication â†’ Emails â†’ SMTP Settings**, or (for local testing only) turn off "Confirm email".

## Tests

```bash
npm test
```

- `tests/db`: runs the real migrations in PGlite (in-process Postgres) with a small Supabase shim, and checks row-level security, researcher isolation, immutable versions, participant token checks, flow order (no skipping consent), consent snapshots, withdrawal, private media, and account deletion.
- `tests/unit`: schema validation, answer validation, CSV export (including Arabic and formula protection), codebook, seeded randomisation, and English/Arabic message parity.

```bash
npm run typecheck
npm run build
```

## Architecture

- `src/lib/study/schema.ts`: the study configuration (Zod). A study is versioned JSON: settings plus an ordered list of blocks.
- `src/components/builder/`: the researcher's editors. `src/components/participant/`: the participant renderer. They are kept separate.
- `src/app/api/p/[action]`: participant endpoints (start, resume, submit, consent, complete, withdraw). They validate input, then call database functions.
- `supabase/migrations/`: schema, RLS policies, and database functions.
- `src/lib/export/`: column definitions shared by the CSV and the codebook.

## Deploying to Vercel

Import the repository in Vercel, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and deploy. Add the deployed URL plus `/auth/callback` to Supabase's redirect URLs. (`next.config.ts` also emits a standalone build for Docker; a self-hosting guide comes in Phase 5.)
