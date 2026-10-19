# PRODUCT BRIEF: A FREE, BILINGUAL PLATFORM FOR CONSUMER BEHAVIOUR RESEARCH

Working name: **[Platform]** (final name to be decided; use a single constant so it can be changed in one place).

This is the single source of truth for the project. It replaces all earlier briefs. Where anything here conflicts with an earlier document, this brief wins.

---

## 0. How to use this brief (for Claude Code)

Act as a senior full-stack engineer and product architect.

1. Read the whole brief before writing code.
2. Inspect the repository. If it is empty, create the application structure. If it already contains code, understand it before changing it.
3. Present a concise implementation plan for **Phase 1 only**: architecture, assumptions, external services, environment variables.
4. Then build Phase 1, test it, and continue phase by phase. Do not stop after writing a plan.
5. Complete and test each phase before starting the next. Never mark a placeholder as finished.
6. If a requirement is ambiguous, choose a reasonable, reversible default, document it in `DECISIONS.md`, and continue.

---

## 1. Mission

[Platform] is a **free, open, bilingual (Arabic and English) platform for consumer behaviour research**. It lets any researcher, student or institution build anything from a plain questionnaire to an interactive shopping experiment, run it with participants, and export clean data for analysis, without paying, without an institutional licence, and without writing code.

The platform succeeds when more people can do better research with it. Revenue is not a measure of success.

---

## 2. Non-negotiable principles

### 2.1 Free and accessible

- No subscription, premium tier, paid feature gate, billing page, payment integration or upgrade prompt. Do not build any of these, now or as "future-ready" scaffolding.
- No payment to create, publish or run a study, or to export data.
- No institutional affiliation required. Individual students and researchers must be able to use everything independently.
- Participants complete public studies without paying and without creating an account by default.
- Never make access to a researcher's projects, data or exports depend on payment.
- No participant data is sold or used for advertising.
- AI is never required to create or run a study.
- Any technical limit (storage, file size, number of studies) must exist only to protect the stability of the free service, must be equitable, and must be explained clearly in the interface and in the documentation.

### 2.2 Self-hostable and open-source ready

- Prefer open-source dependencies and open standards.
- Design the codebase so it can be published under an open-source licence and **self-hosted** by a university or researcher with their own infrastructure (documented Docker set-up plus a self-hosted Supabase or plain PostgreSQL). Self-hosting is how the platform scales to everyone without one central budget.
- Do not claim the project is open source until a licence has been chosen and the code is actually published.
- Keep secrets, credentials, participant data and production configuration out of the repository.

### 2.3 Sustainability without paywalls

The hosted service may eventually be supported by donations, grants, university partnerships or non-exclusive sponsorships. These must stay separate from research data and from the participant experience, and are not part of the initial build. Document expected running costs, free-tier limits and operational requirements before any public launch.

---

## 3. What the platform is

A general-purpose research platform for consumer behaviour, advertising, marketing, digital media and decision-making research.

The researcher chooses what they want to do. The same study can be:

- **only a questionnaire**;
- a **media experiment** (show ads, images, videos and measure responses);
- a **choice experiment** (choose between products, offers or ads);
- an **interactive environment**: a walkable **shopping village/street** or a realistic **online shop**;
- or **any combination** of these, in **any order the researcher chooses**.

The first two studies run on the platform (Section 15) are templates and test cases. They must not be hard-coded into the core.

---

## 4. Core concept: a study is an ordered flow of blocks

A study is a **versioned configuration** (validated JSON) that the participant renderer reads. It is never a set of hard-coded pages.

### 4.1 The flow

- A study's flow is an **ordered list of blocks** that the researcher arranges freely (drag and drop, plus move up/down buttons for accessibility).
- Any block can be:
  - shown to all participants or only to selected **conditions**;
  - placed inside a **randomised group** (blocks shown in random or counterbalanced order);
  - **repeated per stimulus** (for example "ask these 5 questions about each brand the participant saw", in a fixed or random order);
  - skipped by **branching/skip logic** based on earlier answers or on assigned variables.

### 4.2 Block library (initial)

| Block | Purpose |
|---|---|
| Welcome | Neutral introduction, duration, researcher contact |
| Consent | Approved consent text, affirmative action required, versioned |
| Eligibility / screening | Questions that end the session politely if criteria are not met |
| Instructions | Free-form rich text, images |
| Questionnaire page | One or more questions (Section 7.1) |
| Media exposure | Show one or more images, videos or audio, with exposure control |
| Ad gallery / feed | A set of ads in a grid or scrolling feed (feed theme in a later phase) |
| Choice task | Pick one / several / none from alternatives |
| Shopping village | Interactive walkable street of stores (Section 5.1) |
| Online shop | Realistic e-commerce site (Section 5.2) |
| Judgement / detection task | Per-stimulus judgement, e.g. "real / AI-generated / not sure" plus confidence |
| Manipulation check | Questions verifying participants noticed the manipulation |
| Attention check | Instructed-response items, flagged in the export |
| Demographics | Standard optional questions |
| Debrief | Required when the study uses deception; configurable text |
| End | Completion message, optional completion code, optional redirect URL |

New block types must be addable later without changing the study engine (plugin-style registry with a schema, an editor component and a renderer component per block type).

### 4.3 Methodological guardrails (warnings, never blocks)

The researcher has full control of the order. The builder shows **non-blocking warnings** when a design choice commonly harms data quality, with a short reason. Examples:

- A detection or "was this AI?" question appears **before** attitude or trust measures (primes suspicion).
- Questions appear **before** an interactive environment whose behaviour is a dependent variable (behaviour is then no longer spontaneous).
- The study uses deception (e.g. an undisclosed manipulated ad) but has no debrief block.
- No attention check in a long questionnaire.
- Conditions have very different numbers of blocks or durations.
- A manipulation exists but no manipulation check is configured.

The researcher can dismiss each warning. Dismissals are recorded in the audit log.

---

## 5. Interactive environments

Both environments are built from the same reusable **content library** (Section 6) and log behaviour through the same event system (Section 7.2). Visual themes are separate from experimental logic.

### 5.1 Shopping village / street

A walkable, illustrated **2D** environment (not 3D, no headset) that works on phones.

- The researcher can add **as many stores as they want**. Layout extends automatically (a longer street, several streets, or a map/grid layout). The UI may recommend a sensible number for mobile performance but must not hard-cap it below a generous limit.
- Each store has: name, brand, façade/sign, an ad placement on the façade (image or video), an interior with shelves, **any number of products**, in-store ads, and optional offers/promotions.
- Participants can walk along the street, approach stores, enter, browse products, open product details, see in-store ads, choose/buy (simulated), indicate purchase consideration, carry a basket/bag, and leave.
- Configurable: what counts as "approaching" a store (distance/time), whether participants must visit before finishing, a time limit, minimum/maximum purchases, a budget (optional, simulated currency, configurable currency code such as BHD).
- Themes (Section 9): start with **one polished minimal village theme** and **one neutral research theme**. A food-court arrangement is a layout of the same village, not a separate engine.

### 5.2 Online shop (normal e-commerce page)

A realistic, configurable online store that looks like a real shopping website.

- Home page with banners (ad placements), featured products and categories.
- Category and product listing pages with **search, filters and sorting**.
- Product detail page: images, video, description, price, original price and offer, attributes, optional researcher-written reviews/ratings (must be labelled in the builder as researcher-created stimuli).
- Cart (add, remove, change quantity) and a **simulated checkout** that ends the shopping block. **No real payment, no real orders, no collection of payment details.**
- Ad placements throughout (banner, sidebar, in-listing sponsored product, pop-in), each assignable to conditions.
- The researcher controls product order: fixed, random per participant, or by condition.
- Logged behaviour includes searches, filter use, products viewed, time on page, scroll depth, add/remove from cart, final basket and simulated spend.

### 5.3 Ad gallery / social feed (later phase)

A scrolling feed of posts/ads with like/skip/save interactions and viewability tracking. Plan the architecture for it; build it after the village and the online shop.

---

## 6. Content library

Reusable, researcher-owned objects, organised by project and folder, with names, tags and preview:

- **Media assets**: JPG, PNG, WebP, MP4, WebM, MP3/M4A. Type and size validation, upload progress, clear errors, optional in-browser compression before upload.
- **Brands**: name (AR/EN), logo, colours.
- **Stores**: brand, façade, interior settings, product list, ad placements.
- **Products**: name, description (AR/EN), images, base price, currency, attributes, category.
- **Offers / promotions**: type (percentage, fixed amount, buy-X-get-Y, bundle, free shipping, none), display text, effective unit price computed and stored.
- **Ads**: one or more versions per ad (e.g. *authentic* and *AI-generated*), with an optional **disclosure label** (text, position, style) that can be switched on per condition.

Every object has a stable ID that is written into the data whenever it is shown to a participant.

---

## 7. Measurement

### 7.1 Question types

Single choice, multiple choice, Likert (configurable points and anchors), semantic differential, slider/rating, matrix/grid, ranking, numeric, short and long text, dropdown, date, image choice, constant sum (later). Per question: required/optional, randomised options, "not sure"/"prefer not to say" options, piping of earlier answers (later), and stable variable names for export.

Scale library: researchers can save and reuse their own scales. The platform must **never label a scale as validated** unless the researcher supplies a source; the source citation is stored with the scale.

### 7.2 Behavioural event tracking

All interactive blocks emit structured events with timestamp, session, block, and the IDs of the store/product/ad/offer involved. Initial catalogue:

- Session: start, consent given/declined, block entered/left, completed, withdrawn, abandoned (last activity).
- Exposure: ad impression (with visible duration), video play / pause / seek / progress quartiles / complete, image view.
- Village: enter environment, approach store, pass store, enter store, leave store, product view, product detail open, add to bag, remove, purchase/choice, purchase-consideration answer.
- Online shop: page view, search query, filter applied, sort changed, product view, add/remove cart, checkout start, checkout complete, scroll depth.
- Judgement tasks: answer, confidence, response time.

The researcher chooses which events to record. Do not record unnecessary or invasive data (no keystroke logging, no mouse-movement streams, no camera, microphone or location by default).

### 7.3 Computed variables

From the event log, compute participant-level variables automatically and include them in the export, for example: entered store X (0/1), dwell time in store X (seconds), stopped at store X (0/1), number of products viewed, chosen product/store/offer, basket value, ad X visible time, video X percentage watched. The rules for each computed variable are listed in the codebook.

---

## 8. Experimental design engine

This is the heart of the platform. It must support between-subject, within-subject and mixed designs.

### 8.1 Conditions (between-subject)

- Create any number of conditions (groups).
- Assignment: simple random, **balanced/block randomisation** (keeps group sizes equal), or weighted.
- Optional **quotas** per condition (stop assigning when full).
- Any block, media version, label, price, offer or question can differ by condition.

### 8.2 Assigned variables (within-subject and counterbalancing)

The researcher defines **factors** whose values are assigned to each participant and then referenced anywhere in the study. Examples:

- `target_brand` ∈ {Brand A, Brand B, Brand C}: one brand is randomly chosen per participant; that brand's ad shows the *AI-generated* version and the others show the *authentic* version.
- `offer_for_store`: offers {BOGO, 50% off, 1 BHD off, none} are randomly **mapped** one-to-one onto 4 stores per participant.
- `store_order`, `ad_order`, `question_block_order`.

Assignment methods: random, balanced across participants, full permutation, **Latin square**, fixed. Every assigned value is stored per session and appears as its own column in the export.

### 8.3 Versioning and integrity

- Published study versions are **immutable**. Material changes create a new version.
- Each session stores the study version, its condition and every assigned variable.
- **Test/preview sessions** are flagged and never mixed with real data.
- Researchers can **lock** a version (for example, the version validated in a pilot study) so it can be re-used unchanged in a later study.

### 8.4 Cross-study exclusion

Optional per study: ask "Have you taken part in [study X]?" and/or check a pseudonymous hash (salted, of an identifier the participant enters, such as email) against another study's list, to exclude repeat participants without storing the identifier itself.

---

## 9. Themes and visual customisation

- Themes change appearance only, never experimental logic.
- Researchers can customise colours, typography, backgrounds, layout options, product card style, ad placements, button styles, logos and instructions.
- Initial themes: **minimal contemporary village**, **neutral research**, **modern online shop**. Later: playful/game-like, luxury district, souq-inspired (designed with cultural sensitivity, no stereotypes), social feed.
- The participant experience must be able to look like a real website or shopping street, not an admin dashboard.

---

## 10. Researcher Studio

Private workspace with:

- **Dashboard**: projects and studies by status (draft, published, active, paused, closed), recruitment and completion counts, recent items.
- **Projects**: create, edit, duplicate, archive, delete; store objectives, questions, hypotheses, notes.
- **Study builder**: choose a starting point (blank, questionnaire, media experiment, choice experiment, shopping village, online shop, or a template), then edit the block flow, conditions, factors, branching and settings. Progressive disclosure: essentials first, advanced settings when needed.
- **Environment builder**: stores, products, offers, ads and placements for the village and the online shop, with desktop and mobile preview.
- **Media library**.
- **Preview and test**: preview as any condition and with any assigned-variable values; run full test sessions (flagged).
- **Participants & data**: links, recruitment status, session list (complete / incomplete / excluded / test), exclusion flags, exports.
- **Analytics** (basic): starts, completions, completion rate, condition counts, question distributions, store visits, choices, time per block. Only from real recorded data; sample data always labelled.
- **Templates**: save any study as a template; duplicate templates.
- **Settings**: language, profile, data retention defaults.

Team workspaces and shared projects are a later phase (free, not paid).

---

## 11. Participant experience

- Mobile-first; works on phones, tablets and desktops; fast on slow connections.
- Arabic and English; full, correct RTL and LTR (not merely mirrored).
- No account by default; pseudonymous session ID.
- Clear loading, error, completion and withdrawal states; progress indicator optional.
- Resume after accidental refresh where the study allows it.
- **Recruitment integration**: accept URL parameters (e.g. panel participant ID), pass them into the data, show a completion code and/or redirect to a configurable URL at the end (compatible with panels such as Prolific and with university participant pools).
- Researchers can preview exactly what participants see.

---

## 12. Data and export

- **Participant-level file (wide CSV)**: one row per session; condition, assigned variables, every answer, computed behavioural variables, flags (attention, test, excluded, completed), timings.
- **Event log (long CSV)**: one row per event with all IDs and timestamps.
- **Codebook**: variable name, label (AR/EN), type, value labels, source block, computation rule for computed variables.
- **SPSS syntax file (.sps)** that applies variable and value labels to the CSV. Also export-friendly for R and Python (UTF-8, stable names, no merged headers).
- Exports include the study version and a snapshot of the study configuration.
- Unicode-safe for Arabic throughout.

---

## 13. Privacy, security and research ethics

- Row Level Security on every table; server-side permission checks for sensitive actions; one researcher can never see another's private projects or data.
- Signed URLs for private media; unpublished materials never public.
- Server-side validation of every write; rate limiting on public endpoints.
- No sensitive participant answers in application logs.
- Minimum necessary participant data; no names or emails unless a study explicitly requires them, stored separately from responses.
- Consent text versioned and stored with each session; withdrawal supported.
- Researcher-configurable retention and deletion; full export and deletion of a researcher's own data.
- Configurable debrief for studies using AI-generated or manipulated stimuli.
- Allow choice of hosting region where the infrastructure supports it, and document it, because some ethics committees and data protection laws (e.g. Bahrain's Personal Data Protection Law) care about where data is stored.
- Never claim legal compliance, guaranteed anonymity or ethical approval without evidence.

---

## 14. AI research assistant (optional, last phase)

- Off by default. The platform must be fully usable without it.
- Server-side integration only; configurable provider; keys never in browser code. Support an instance-wide key set by the host and/or a researcher's own key; if none is configured, show a clear set-up message.
- Capabilities: turn a research idea into a draft study outline; suggest variables, conditions, confounds, manipulation checks and counterbalancing; draft and critique questions (leading, double-barrelled, ambiguous); Arabic–English translation of study text; suggest a codebook and suitable analyses.
- Safeguards: must not fabricate references; must not claim a scale is validated without evidence; must not guarantee statistical validity or ethical approval; must separate suggestions from facts; must never change a published study; researchers approve every AI-generated change; no participant-level data sent to an AI service by default.
- Clear usage limits if the hosted instance pays for the AI service.

---

## 15. First two studies (templates and acceptance tests)

Build these as **templates created through the normal builder**, not as special code. If the builder cannot express them, the engine is incomplete.

### 15.1 Template A: validation study (runs first)

Purpose: test whether the shopping environment measures purchase behaviour as validly as an online questionnaire.

- **Conditions (between-subject, balanced)**: (1) shopping village; (2) online questionnaire showing the same outlet images.
- **Setting**: a campus food court with **4 fictional beverage outlets**, same product type, base price **2.000 BHD**.
- **Assigned variable**: offers {buy one get one free, 50% off, 1 BHD off, no offer} randomly mapped one-to-one to the 4 outlets per participant; outlet order randomised.
- **Flow**: welcome → consent → screening (18+, university student, prior participation question) → background → purchase task ("You have a break between classes; choose where to buy your drink") in the assigned tool → purchase intention per outlet (Likert) with attention check 1 → presence scale, behavioural-realism item, usability scale, attention check 2 → manipulation check ("Did you notice any price offers? Which offer was on each outlet?") → debrief (outlets are fictional; please do not discuss the study) → end.
- **Data needed**: chosen outlet and its offer, every outlet's offer and position, stops/entries/dwell per outlet (village), intention per outlet, scales, attention flags, timings.
- Sample size around 270 (about 135 per condition).

### 15.2 Template B: deepfake advertising study (thesis main study)

- **Conditions (between-subject, balanced)**: (1) no disclosure; (2) disclosure label «مُنتج بالذكاء الاصطناعي» / "AI-generated" on the AI-generated ad.
- **Brands**: 3 fictional coffee brands. Each brand has **two ad versions**: authentic and AI-generated, matched in script, length, music, product and branding (6 ads in total).
- **Assigned variable**: `target_brand` chosen at random per participant (balanced). The target brand shows its AI-generated version; the other two show their authentic versions. Ad order randomised.
- **Flow (default order)**: welcome → consent → screening (including "Have you taken part in the food-court study?") → ad exposure → shopping village with the 3 brands' stores (behaviour logged) → attitude and perception scales **for each of the 3 brands** (repeated block, random order) → detection task per ad (real / AI-generated / not sure + confidence) → manipulation check → demographics → debrief explaining the AI-generated ad → end.
- **Data needed**: condition, target brand, ad order, exposure and video-watch data per ad, store behaviour per brand, scales per brand, detection answers, manipulation check, demographics.
- Sample size around 400 (about 200 per condition).
- The export must make it easy to compare, within each participant, the target brand against the two authentic brands (one row per participant with per-brand columns).

---

## 16. Feasibility: what is possible, what is not

### Possible in this build
Questionnaire-only studies; any ordering of blocks; unlimited stores, products, ads and offers (subject to transparent performance guidance); between, within and mixed designs; counterbalancing and Latin squares; a 2D walkable village; a realistic online shop with simulated checkout; detailed behavioural logging; bilingual RTL/LTR; panel/pool integration via links and completion codes; CSV + codebook + SPSS syntax exports; self-hosting.

### Possible later
Social-media feed environment; more themes; team workspaces; constant-sum and conjoint (choice-based conjoint with design generation); piping and advanced logic; webcam-based attention estimates (low precision, opt-in only, clearly labelled as approximate); direct .sav export.

### Not possible or out of scope
- Real purchases, real payments or real deliveries (all purchases are simulated; incentive-compatible designs must be handled outside the platform, e.g. by a lottery).
- Immersive 3D/VR headset experiences.
- Precise eye tracking, EEG or physiological measures (need hardware).
- A built-in participant panel (researchers recruit; the platform integrates with external pools).
- Guaranteed unlimited free hosting: storage and especially **video bandwidth** cost money. The hosted service needs transparent limits; self-hosting removes them.
- Automatic guarantees of ethics approval, legal compliance or validity.

---

## 17. Technical architecture

- **Framework**: Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui (or an equivalent accessible component system).
- **i18n**: a library with full RTL support; no hard-coded interface text; Arabic-compatible fonts; correct mixed Arabic/English handling.
- **Backend**: Supabase (PostgreSQL, Auth, Storage, RLS); server routes/functions for privileged operations. Keep the data layer abstract enough to run on self-hosted Supabase.
- **Hosting**: Vercel for the hosted instance; Docker-based self-hosting documented.
- **Study engine**: Zod (or equivalent) schemas for the study configuration; block registry (schema + editor + renderer per block type); deterministic, seeded randomisation stored per session.
- **Environments**: render with DOM/SVG/CSS (accessible, responsive, light) rather than a heavy game engine; lazy-load media; performance budget for mid-range phones on slow connections.
- **Event pipeline**: batched event submission from the client, server validation, idempotent writes, offline-tolerant retry during a session.
- **Charts**: a React chart library for basic analytics.
- **Media**: Supabase Storage with size limits and compression guidance; keep a seam to move video to a dedicated streaming service later.
- **Costs**: avoid unnecessary API calls and background jobs; paginate; efficient queries; do not assume free tiers are unlimited or always-on.

---

## 18. Data model (refine as needed, keep the capabilities)

- Accounts and ownership: `profiles`, `workspaces`, `workspace_members`, `projects`.
- Studies: `studies`, `study_versions` (immutable JSON configuration + publication metadata), `templates`.
- Library: `media_assets`, `brands`, `stores`, `products`, `offers`, `ads`, `ad_versions`, `scales`, `themes`.
- Participants and data: `participant_sessions` (pseudonymous ID, study version, condition, assigned variables JSON, recruitment params, status, flags, timestamps), `responses`, `exposure_events`, `interaction_events`, `consent_records`, `exclusion_hashes`.
- Governance: `audit_logs` (publishing, configuration changes, dismissed warnings, exports, deletions).

Use migrations for every schema change; foreign keys, indexes, timestamps, uniqueness and validation constraints throughout. Avoid duplicating data between relational tables and the JSON configuration.

---

## 19. Accessibility and inclusion

Keyboard navigation; accessible labels and controls; sufficient colour contrast; screen-reader support where feasible; never rely on colour alone; reduced-motion support; responsive layouts; clear errors and instructions; usable by researchers with low technical skill; RTL that is genuinely usable.

---

## 20. Development roadmap

Order chosen so that both templates in Section 15 can run as early as possible.

**Phase 1: Foundation and questionnaires**
App shell, bilingual RTL/LTR interface, authentication, workspaces/projects, study creation, block flow editor (reorder, add, remove), questionnaire blocks and question types, consent, welcome/end, media library, publish + public link, participant renderer, preview, test sessions, response storage, wide CSV export with codebook.

**Phase 2: Experimental engine**
Conditions with balanced assignment and quotas, assigned variables/factors (random, balanced, permutation, Latin square), block randomisation and per-stimulus repetition, branching/skip logic, immutable versioning and locking, event pipeline, recruitment parameters and completion codes, cross-study exclusion, methodological warnings, event-log export and SPSS syntax.

**Phase 3: Shopping village**
Brands, stores, products, offers, ads with versions and disclosure labels; village environment with unlimited stores and configurable layouts; behavioural events and computed variables; two themes. **Milestone: Templates A and B fully runnable end to end.**

**Phase 4: Online shop**
Listing, search, filters, sorting, product detail, cart, simulated checkout, ad placements, related events and computed variables, online-shop theme.

**Phase 5: Analytics and polish**
Basic analytics dashboard, templates gallery, accessibility audit, performance work, self-hosting guide and Docker set-up, cost and limits documentation.

**Phase 6: Extensions**
Optional AI assistant, social-feed environment, more themes, team workspaces, additional question types.

---

## 21. Acceptance criteria (minimum before calling the core complete)

1. A researcher can register, sign in and see only their own workspace.
2. A researcher can create, edit, duplicate and delete projects and studies.
3. A researcher can build a questionnaire-only study and run it end to end.
4. A researcher can reorder blocks freely and the participant sees exactly that order.
5. Arabic and English work for both interface and study content, with correct RTL/LTR.
6. Media can be uploaded and used in a study.
7. Two or more conditions can be configured; participants are assigned with balanced randomisation; condition and version are stored.
8. An assigned variable (e.g. which brand gets the AI-generated ad, which offer goes to which store) can be configured and is stored per session.
9. A village with at least 6 stores and multiple products per store works on a mid-range phone.
10. An online shop with search, filters, product pages, cart and simulated checkout works.
11. Exposure and interaction events are logged and computed variables appear in the export.
12. Wide CSV, event-log CSV, codebook and SPSS syntax export correctly, with Arabic intact.
13. Test sessions are flagged and excluded by default.
14. Templates A and B can be built entirely with the normal builder and completed by a participant.
15. One researcher cannot access another's private data; invalid or unauthorised writes are rejected.
16. The app works with no AI key configured.
17. No billing, pricing or upgrade code or UI exists anywhere.
18. The hosted deployment to Vercel and the self-hosting route are both documented and work.

---

## 22. Testing

Tests for: authentication and authorisation, ownership and RLS isolation, study creation and versioning, configuration schema validation, consent requirements, randomisation (including balance over many simulated sessions), assigned-variable mapping, block ordering and branching, event logging and computed variables, export correctness (including Arabic), RTL/LTR rendering, participant completion, public versus private resources, server-side validation. Provide a seed script that creates clearly labelled sample data, never mixed with real data.

---

## 23. Implementation rules

- No static mock-ups standing in for features; no buttons that do nothing.
- Do not hard-code any specific study into the core.
- Do not invent research results or show fake statistics as real.
- Do not expose credentials or bypass security to make a demo work.
- Do not silently change a published study.
- Do not build monetisation of any kind.
- Prefer clear, maintainable code over clever abstractions; keep presentation separate from research logic and participant pages separate from the studio.
- Use migrations and server-side validation for all important writes.
- Document set-up (local, Supabase, migrations, tests, Vercel, Docker self-hosting) and list anything incomplete honestly.

Begin by inspecting the repository and presenting the Phase 1 plan. Then build Phase 1, test it, and continue.
