# Asdaa Lab: agreed flows and build order

Agreed with the owner on 2026-11-27, question by question. This is the reference for what "functional" means; each phase is shown to the owner before the next starts.

## Researcher journey (scenario)

Noor, a master's student, studies whether an "AI-generated" label on an ad changes what people buy.

1. **Account.** Creates an account (name, email, password). Once email sending works, she confirms her email before using the studio. Can change her password, reset it by email (once sending works), and delete her account with all its studies, media and responses.
2. **Studio (signed-in only).** On first sign-in, studies found in her browser from before accounts existed are offered for import. Everything is saved to her account.
3. **New study.** Name and language(s). If the study has both Arabic and English, **the link decides the language** (one link per language).
4. **Steps, in order, one link:** welcome → consent → screening → media (ad video) → shopping village or e-commerce simulator → questions → manipulation check → demographics → end. Images and videos are **uploaded to the platform** (a link can be pasted instead). The research assistant can check wording and translate.
5. **Experiment (Design tab).** Factors and levels (e.g. Disclosure: none / label; Target brand: A / B / C); combinations built automatically; between, within and Latin-square designs. A condition can change **text and media, whole steps (show/skip), shop and village offers/prices/ads, and order**. New participants go to the condition with the **fewest completed responses**. **Quotas** on screening answers (e.g. 50% women); a full quota shows "this study is full".
6. **Settings.** Repeats: **researcher chooses per study** (once per device, once per panel ID, or allowed). Closing: **closing date** and a **manual close/reopen**. Panel return links for **completed, screened out and declined consent**, each with its code. All devices allowed. No time limit; time per step is recorded.
7. **Preview and test.** Preview any condition; test responses are flagged and kept apart.
8. **Publish.** Version 1 is locked. Edits become a new version only when published again; each response records its version. Link example: `asdaalab.com/en/s/<id>?pid={PROLIFIC_PID}`.
9. **Responses.** Completed and unfinished responses (unfinished kept, marked incomplete), counts per condition and quota, summary charts, individual responses, table. No email notifications.
10. **Download.** participants.csv (one row per person, condition and per-brand columns), events.csv, bilingual codebook, SPSS syntax; include or exclude unfinished and test responses.
11. **Delete.** One response or all responses of a study, permanently, after confirmation.
12. **Sharing.** Invite by email with view or edit rights, **built once email sending works**.

## Participant journey

Anonymous link, no account; the link can carry a panel ID. Welcome → consent (decline → "declined" return link) → screening (fail or full quota → "screened out" return link) → assigned condition → steps → end page with completion code → "completed" return link. Closing the page and reopening the link in the same browser continues where they stopped. Any device.

## Shopping village step

- Researcher picks a scene, then sets up **each store fully**: name, sign or logo image, window ad (image or video), products (photo, name, price, offer).
- Walking into a store opens a **product screen** over the scene (walkable 3D interiors later).
- The step ends by the researcher's choice: **one purchase**, **basket and checkout**, or a **Done button** after a minimum time.

## E-commerce simulator step

Marketplace or single-brand layout; checkout ends the task; prices, offers, ads, sponsored items, ratings and order can vary (earlier decision, 2026-11-11).

## Analysis tools

- **Network (first working version):** measures table, Louvain communities, interactive graph (PNG/SVG), and posts-to-network. Excel files read in the browser.
- **Sentiment:** done. Add: Excel files; and from a study's Responses, "Analyse sentiment" opens open-ended answers in a **coding screen** (first and second coder), then the usual results.

## Research assistant

Your key covers **30 questions per researcher per day**; researchers can add their own key. Needs `ANTHROPIC_API_KEY` in Vercel.

## Email

Send from **hello@asdaalab.com through Microsoft 365** (owner's choice). Needs the mailbox created and SMTP sending allowed; if Microsoft blocks it, ask the owner before switching to a free sending service. Unlocks: password reset, email confirmation, study invitations.

## Build order

1. **Run a real study end to end:** account storage (studies, versions, sessions, media in Vercel Blob), signed-in studio, browser import, publish/versions, participant runner from the server with resume, repeat rule, closing date and manual close, three return links, language by link, unfinished responses, deletion, account deletion. Correct the shop/forms page text that describes the engine as built.
2. **Experimental engine:** factors and levels, designs, condition changes, balancing, quotas.
3. **Village as a study step:** store setup, product screen, end options.
4. **Network tool** and **Excel** for both analysis tools.
5. **Sentiment from study answers** with the coding screen.
6. **Email** (after the mailbox): password reset, email confirmation, invitations and sharing.
