# Research Platform (working name)

A free, bilingual (Arabic/English) platform for consumer-behaviour research: build a study as an ordered flow of blocks, run it with participants, and export clean data. See `docs/PLATFORM_BRIEF.md` for the full product brief and `DECISIONS.md` for choices made during the build.

> Not yet open source: the code is visible on GitHub, but no licence has been chosen, so others may read it but not reuse it until one is added.

## Status

**Phases 1–5 built and tested locally, and all migrations are applied to the hosted database (Frankfurt).** Templates, the online shop and the analytics page's empty state have been checked in preview. No study has yet been published and run by real participants, so the analytics charts have only been tested with unit-test data (see `KNOWN_ISSUES.md`).

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
| Analytics: starts, completions, completion rate, starts per day, conditions, devices and languages, drop-off by block, time per block, question distributions, village / store choice / shop results; test and excluded sessions hidden unless included | Done (charts not yet seen with real data) |
| Templates gallery: ready-made templates plus “Save as a template” for any study; use, rename, duplicate, delete | Done |
| Self-hosting guide, Dockerfile and Compose file | Done (standalone Node server tested; Docker image not yet built) |
| Running costs and limits documentation | Done ([`docs/LIMITS.md`](docs/LIMITS.md)) |
| Accessibility check: axe on participant pages (both languages, village, shop with pop-up) and all studio pages | No violations left in what was checked; a manual screen-reader test is still to do |
| AI features and other extensions (Phase 6) | Not started |

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

**Live instance:** https://consumer-research-sigma.vercel.app (Vercel project , deployed from the  branch of GitHub ). Every push to  redeploys automatically.

To set up your own:

1. Import the GitHub repository in Vercel.  runs the server functions in Frankfurt (), next to the database.
2. Add two environment variables, both of type **Config** (not Secret; Vercel refuses Secret for  names, and these values are public by design):
   -    -    Redeploy after changing them; they are built into the browser code.
3. In **Supabase → Authentication → URL Configuration**, set the Site URL to the Vercel address and add  to the redirect URLs (keep  for local work).
4. Before real participants: add your own SMTP server in Supabase (**Authentication → Emails → SMTP Settings**). The built-in sender only sends a few emails per hour, and the email templates (needed for the any-browser link fix in ) can only be edited once SMTP is set.

To run it on your own servers instead, see [](docs/SELF_HOSTING.md) (Docker or plain Node).
