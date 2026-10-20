# Research Platform (working name)

A free, bilingual (Arabic/English) platform for consumer-behaviour research: build a study as an ordered flow of blocks, run it with participants, and export clean data. See `docs/PLATFORM_BRIEF.md` for the full product brief and `DECISIONS.md` for choices made during the build.

> Not yet open source: no licence has been chosen and the code is not published.

## Status

**Phases 1–4 built and tested locally, and all migrations are applied to the hosted database (Frankfurt).** Templates and the online shop have been checked in preview; no study has yet been published and run by real participants (see `KNOWN_ISSUES.md`).

| Area | State |
|---|---|
| Bilingual interface (AR/EN, RTL/LTR) | Done |
| Sign-up / sign-in, personal workspace | Done (see known issue 1) |
| Projects: create, edit, duplicate, archive, delete | Done |
| Studies: choose one or more research tools (shopping village, online shop, questionnaire) at creation, combined within-subjects (fixed or counterbalanced order) or between-subjects (one tool per condition); blank / media / experiment starting points; rename, duplicate, delete | Done |
| Block flow editor: add, remove, duplicate, drag-and-drop + arrow reordering, live validation | Done |
| Blocks: welcome, consent, screening, repeat-participant check, instructions, questionnaire, demographics, media, debrief, end | Done |
| 12 question types, required, randomised options, "not sure"/"prefer not to say", attention checks | Done |
| Media library: upload with progress, type/size checks, optional image compression, folders, tags | Done |
| Publish → immutable versions, lock, public link, test link, pause/close | Done |
| Conditions: balanced (permuted blocks) or random, weights, quotas | Done |
| Factors: pick / order / mapping; balanced, Latin square, full permutation, random, fixed | Done |
| Block order groups, repetition per stimulus, `{{stimulus}}` piping | Done |
| Skip/branch logic on answers, condition, factors, URL parameters | Done |
| Cross-study exclusion with salted hashes | Done |
| Unique completion codes, redirect URL placeholders | Done |
| Behavioural events (navigation, media exposure), offline-tolerant batching | Done |
| Methodological warnings (dismissible, audit-logged) | Done |
| Preview as any condition / factor level; test links with forced condition | Done |
| Exports: wide CSV, codebook, event log, SPSS syntax (EN/AR labels), config snapshot | Done |
| Account deletion | Done |
| Seed script with labelled sample data | Not yet |
| Content library: brands, stores, products, offers, ads with versions and disclosure labels | Done |
| Walkable shopping village (street / food court), store choice task, ad exposure block | Done (not yet tried end to end) |
| Village and ad export variables, target-vs-other-brand summaries | Done |
| Templates A (food court) and B (AI ads), created through the normal builder | Done |
| Online shop simulation: home, search, filters, sorting, product pages, researcher-written ratings and reviews, banner / sidebar / pop-up ads, sponsored products, cart, simulated checkout (no payment details ever asked) | Done (checked in preview) |
| Online shop export variables: per-product position, offer, views, page opens, quantity; searches, filters, sorts, checkout, scroll depth, pop-up closing time, ad exposure | Done |
| Analytics dashboard, Docker self-hosting guide (Phase 5) | Not started |

### Known limitations

- The database enforces session tokens, consent-before-content, allowed variables and assignment. The *order* of blocks (skip logic, repetition) is enforced by the app server; someone calling the database functions directly could submit blocks out of order for their own session. A stricter server-only mode (using a service key) is a possible hardening step.
- Rate limiting is per server instance (see `docs/LIMITS.md`).

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
   - paste each file into **Supabase Dashboard → SQL Editor** and run it, or
   - use the Supabase CLI: `npx supabase link --project-ref YOUR-REF` then `npx supabase db push`.

4. In **Supabase → Authentication → URL Configuration**, set the Site URL to where the app runs (e.g. `http://localhost:3000`) and add `http://localhost:3000/auth/callback` to the redirect URLs.

5. Run the app:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

### Email confirmation

Supabase cloud sends confirmation emails from a shared server limited to a few emails per hour. For real use, add your own SMTP server under **Authentication → Emails → SMTP Settings**, or (for local testing only) turn off "Confirm email".

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
