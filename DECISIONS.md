# Decisions

Choices made during the rebuild, newest first. `docs/PLATFORM_BRIEF.md` is the functional specification; where a decision here changes it, the decision says so.

## 2026-11-14 · Network tool, stage 2a: upload and checks

- **Input formats:** edge lists (CSV, TSV, TXT), GEXF and GraphML. Excel is not in this stage; it needs a free spreadsheet reader added on approval.
- **Presets only choose which columns are matched first.** The researcher sees and can change every match. The 4CAT and Communalytic column names were not found in public documentation, so that preset says the matches are unchecked until a real sample export is tested. A sample export from each tool is needed.
- **Every problem is counted, not repaired:** blank ends (rows left out), self-loops (kept), repeated ties (merged, weights added), blank or non-numeric weights (tie counts as 1), and rows with the wrong number of cells (listed by line).
- **Checked:** the graph model against hand-worked cases (merging, direction, bad weights, missing columns; run in Node); the sample file in the browser (12 rows read, 1 skipped, 8 nodes, 10 ties). GEXF and GraphML parsing is not yet tested in the browser.
- **Not yet built:** metrics (stage 2b), the interactive graph (2c), outputs (2d), and posts-to-network.

## 2026-11-14 · Sentiment tool: agreement, disagreements and export

- **Agreement between coders** uses Krippendorff's alpha for nominal labels, computed from the coincidence matrix and checked against hand-worked values (perfect agreement 1; systematic disagreement -0.75; half agreement 0.125; a single category gives no value). A plain reading follows the usual 0.667 threshold, worded as tentative between 0.667 and 0.8.
- **Disagreements** are listed with a final-label choice per text. Final labels replace the first coder's label in the results and the export; undecided texts keep the first coder's label.
- **Export** gives three files: final data (one row per uploaded row, with status, both coders' labels and the final-label source), a summary with the groups and the significance test, and a plain-language method note in the interface language. CSV headers stay in English so they match analysis software; each file has one byte-order mark so Excel shows Arabic.
- **Checked:** the statistics against published values; the disagreement choice changes the counts (10/6/7 to 9/6/8); the files in English; the results in Arabic (right to left, no overflow).
- **Not yet built:** the network tool, and automatic classification (phase 2, planned only).

## 2026-11-14 · Analysis tools: eight changes after the desk research

Approved by the owner after `docs/RESEARCH_ANALYSIS_TOOLS.md`.

- **Network tool:** (1) import presets for 4CAT and Communalytic exports and Gephi's GEXF and GraphML, besides CSV and Excel; (2) build the network from a table of posts (author, text, date) by extracting mentions, replies and shared hashtags, for researchers who have no edge list; (3) the methods note and the standard cautions appear in the main results, not as an optional export.
- **Sentiment tool:** (4) agreement between coders (Krippendorff's alpha) is a main feature when the file has two or more label columns; (5) a view for resolving the texts coders disagreed on, with a final label to export; (6) a dialect or country column for comparisons, so Gulf Arabic is not treated as one group.
- **Order:** (7) the sentiment tool is built before the network tool: it is smaller, useful on its own, and proves the shared upload and validation parts first. (8) Phase 2 (automatic labelling) is designed around the test set: it switches on only after passing a comparison with the researcher's own human-coded sample, scored per language and dialect. Planning only; not built.
- **New stage order:** 1 shared structure (done) · accounts (done locally) · 3a sentiment upload · 3b sentiment results · 3c agreement and disagreements · 3d sentiment export · 2a to 2d network tool (now including posts-to-network) · 4 review and publish.
- **Uploaded data stays in the page's memory** and is gone on reload or close, which is what "not kept after the session" means in practice. Saving comes later, by choice.

## 2026-11-14 · Researcher accounts

- **Email and password**, built in the app with no paid service. Passwords are stored only as scrypt hashes with a random salt. A session is a random token in an httpOnly cookie (30 days); the database stores only its SHA-256. Eight failed sign-ins for one email in 15 minutes lock that email for the rest of the window. Error messages do not reveal whether an email has an account.
- **Database:** Neon Postgres (free tier) on the hosted site through `DATABASE_URL`; an embedded Postgres (PGlite, in `.data/`, not committed) on a developer's computer when `DATABASE_URL` is not set. Tables are created on first use. The Neon path is not tested until the owner adds the connection string in Vercel.
- **What is gated:** the upload, results and export steps of the analysis tools. Tool "about" pages, the homepage and the studio stay open (studio studies are still saved in the browser).
- **Not built yet:** password reset and email verification (both need an email-sending service), and moving studies and responses into the database.
- **Later stage, noted at the owner's request:** a social media reader as another data source for the analysis tools. The upload step treats a file as one source so a reader can be added. It needs the legal decision revisited first, and platform-by-platform access terms.

## 2026-11-13 · Two analysis tools: social network analysis and sentiment analysis

- **Five tools, each independent, combinable by the researcher.** Shopping village, e-commerce simulator, forms, network analysis, sentiment analysis. Every tool works on its own; a researcher may combine them (owner, 2026-11-13). This refines the earlier "one study, one link" answer: combining is optional, never required.
- **Analysis only in this release:** no data is collected from social platforms (a final legal decision for this phase). Researchers upload their own files.
- **Computation runs in the browser** (owner chose this over Python on the server): graphology for metrics and Louvain, sigma.js for display, in a web worker. The uploaded file never leaves the researcher's device. Python on the server stays a later option for networks above the browser limit. The brief asked for networkx and python-louvain; results will be tested against published values for known graphs.
- **Sign-in comes before the tools open** (owner chose to wait for accounts rather than run without sign-in). Order: shared structure, then accounts (email and password, free database the owner creates), then the network tool, then the sentiment tool.
- **Sentiment, phase 1:** aggregates and compares labels the researcher supplies; it does not classify text. Automatic classification (English model, Gulf-dialect Arabic model, human-labelled test set) is phase 2 and not built now.
- **Approved additions:** column mapping, encoding and delimiter detection, in-browser anonymising with a downloadable key, sample files and templates, exportable methods note, fixed Louvain seed with modularity, stated accuracy limits for large networks, in/out degree and strong/weak components, GEXF/GraphML export, table alternative to the graph, template-written reports (no AI), label normalising, group sizes with small-group warnings, time trend, inter-rater agreement, colour-blind-safe colours.
- **Stages, each shown before the next:** 1 shared structure; 2a network upload; 2b metrics; 2c interactive graph; 2d outputs; 3 sentiment; 4 review and publish.

## 2026-11-13 · Form builder rebuilt

- **Works like Google Forms / SharePoint Forms, looks like Tessellum.** The owner asked not to copy the layout completely. Kept: one centred column of cards edited in place, the selected card showing its controls, a floating add-toolbar, and Questions / Responses / Settings tabs. Own design: dark carbon cards, corner brackets on the selected card (from the logo), mono labels, colour only where it means something. The participant view stays the light Tessellum style (soft rounded cards, large targets, the researcher's accent).
- **One language per form**, one long page per form page; "Add page" inserts a page break. A new form starts with a title and one question, in the studio's current language.
- **In questions:** images and video on any question, on options, or as standalone items; tap an image to enlarge, video plays in place. Limits: images 10 MB, video 100 MB (browser storage).
- **Skip logic:** "show this question only if [earlier answer] is / is not [option]", and "end the study if the answer is…" for screening (recorded as screened).
- **Responses tab:** summary (bars per option, distribution and mean for scales, mean/median/range for numbers, text lists), individual responses, table, and downloads: participants.csv, events.csv, codebook.csv, labels.sps (SPSS).
- Replaced FlowEditor, QuestionEditor and DataPanel with FormEditor and ResponsesPanel.

## 2026-11-11 · How everything should work (owner's answers)

- **One study, one link.** The researcher designs a study by adding steps in any order (questions, the 3D village, the e-commerce simulator) and shares a single link.
- **Forms** follow the Google Forms / SharePoint Forms layout: a centred column of question cards edited in place, with Questions / Responses / Settings tabs. Participants see **one long page**. Each form is in **one language** (Arabic or English), not both side by side. Extras: skip logic, images and video in questions and options (seamless and easy to view), theme colour and header image. **Responses tab:** summary charts, individual responses, a table view, and CSV and SPSS downloads.
- **E-commerce simulator:** the researcher chooses a marketplace or single-brand layout. Checkout ends the task. Variable between groups: prices and offers, ads and sponsored items, ratings and reviews, product order, plus further consumer-behaviour variables (scarcity, social proof, delivery, badges, anchoring, defaults, bundles, labels).
- **3D village:** the researcher adds their own stores and products and picks the scene. Entering a store opens the product screen now; walkable 3D interiors come later as an option the researcher can choose.
- **Researcher sign-in:** email and password.
- **Assignment:** the full engine from the brief (groups, within-person factors, random mapping, Latin squares, quotas, counterbalanced order).
- **Performance fix (deployed 8324a13):** rigid follow camera, shadows that follow the participant, real-pixel resolution, one-way automatic step-down.

## 2026-11-10 · Form builder and e-commerce simulator (browser-first)

- **One study engine for both modules** (`src/lib/study`): a study is an ordered flow of blocks (welcome, consent, instructions, questions, media, online shop, end). The form builder edits the flow and the 13 question types; the e-commerce simulator is the shop block plus its own editor (store, categories, products with offers, sponsored placements, researcher-created ratings and reviews, banners).
- **Saved in the browser for now (IndexedDB)**, behind a small async repository (`repo.ts`) so a free database (Neon Postgres) can replace it without changing the screens. Until then, participant links only work in the researcher's own browser, which is fine for previews and test sessions. The studio says so on every page.
- **Participant view is light** with the researcher's accent colour; studio is dark. Both in Arabic and English. Participants choose the language when the study has both; sessions resume after a refresh; preview sessions (`?test=1`) are flagged; URL parameters (e.g. a panel ID) are stored; consent version is recorded.
- **Recorded:** answers, attention-check failures, block timings, and in the shop: page views, product clicks and views, searches, category and offer filters, sort, add/remove from basket, checkout start and completion, ad impressions, banner clicks and scroll depth. No keystrokes, mouse streams, camera or location.
- **Exports:** participants.csv (wide), events.csv (long), codebook.csv; UTF-8 with Arabic intact.
- **Starter shop** uses two Unsplash drink photos in `public/samples/` (checked: no brands). A storefront photo with real business names was rejected.
- **Homepage module cards link to their modules**; the 3D scenes are now on by default (`NEXT_PUBLIC_SCENES_LIVE=0` hides them) and their compressed files are committed.

## 2026-11-10 · Homepage (Phase 4)

- **Built from the approved B-Home mockup**, with the three modules named as the owner names them, in this order: **M-01 Shopping village** (3D, prototype), **M-02 E-commerce simulator** (in design), **M-03 Forms** (in design). Each card says what the participant does and what is recorded, so the modules read as distinct.
- **English and Arabic at `/en` and `/ar`** (next-intl; `/` redirects by browser language). The Arabic page is right to left with its own type (Noto Kufi Arabic for display, IBM Plex Sans Arabic for reading), no uppercase or wide tracking. The Arabic text needs a native speaker's review before launch.
- **No dead links:** "Sign in" and "New study" from the mockup are left out until those pages exist; the calls to action open the scene library.
- **Hero cube is live 3D** (React Three Fiber), turns with the pointer, pauses off screen, and rests still under reduced motion.
- **Not indexed by search engines** until launch (trademark check on the name is still to do).
- Prototypes (`/prototype/...`) sit outside the language routing with their own layout.

## 2026-11-10 · Three modules; the scene library

- **The platform has three modules:** (1) this 3D environment module, (2) an e-commerce simulator (a shopping website), and (3) a standard form builder. The digital settings proposed earlier (delivery app, search results, video pre-roll) belong to the e-commerce simulator, not to the scene library.
- **Eleven 3D scenes, one engine:** garden village, futuristic district, shopping mall, strip mall, souq, food court, supermarket aisle, waterfront, airport duty-free, night market, luxury boulevard (`src/components/env3d/scenes.ts`, built in `sets.tsx`). Every scene holds the same five stores, offers and products and records the same events (`enter_environment` now also records `scene=`); only the place changes. Researcher's library: `/prototype/scenes`.
- **Layout model:** each scene is a walkway along x with store units facing it, five slots per scene. Non-study fronts fill the gaps so places look occupied but cannot be entered. The participant walks within scene bounds and around blockers (benches, stalls, posts).
- **No real brands in backgrounds:** photo skies can contain real shop signs (the strip mall HDRI shows real retail brands), so a scene can rotate its sky (`hdriRotation`) to hide them behind buildings. Check every new HDRI for signage.
- **Performance budget:** simplify every model to what it looks like at walking distance (an apple 300 triangles, a basket 1,500, seating 4,000). Scenes measure about 25k–210k triangles per frame and run at 60 fps in the preview.
- **Researcher preview:** `?as=woman|man|none` skips the avatar question.

## 2026-11-10 · Village prototype: representation, movement and performance

- **"Prefer not to say" gets an abstract presence:** a brand-orange circle on the ground, with no body. A faceless mannequin was tried and rejected as dehumanising; nobody is given a body or gender they did not state. Researchers will be able to use the presence for everyone. The representation is recorded per session (`enter_environment representation=…`).
- **Controls:** tap the street to walk there, tap a shop to walk in and enter, drag anywhere to steer, or use the arrow keys. Tap and drag are told apart by distance and time; events `tap_walk` and `tap_store` are recorded.
- **Natural movement:** walking speed 1.45 m/s, matched to the Rocketbox walk cycle so feet don't slide; speed and turning ease in over about half a second; walking and standing poses blend by speed; the camera follows smoothly.
- **Performance:** Poly Haven models are simplified with glTF-Transform (`public/proto/env/models-lite`): the scene went from about a million triangles per frame to about 30,000. Lamps every 12 m; only buildings and the figure cast shadows; standard rather than physical glass materials. The 3D tree is memoised so page updates never re-render it.
- **No automatic resolution switching:** it misread throttled background tabs as slow devices and blurred the picture. Sharpness is fixed per quality setting (light 1×, high 1.5×).
- **Judge speed on a production build:** `next dev` is much slower. `node scripts/serve-prod.mjs` (or the "prod" preview) serves a production build on port 3001 beside the dev server.

## 2026-11-09 · Environments are realistic 3D, in the browser

- **Changes the brief (section 5.1):** the shopping village was specified as 2D. At the owner's request, environments are now realistic 3D scenes, built like a game. Headset VR remains out of scope.
- **Stack:** three.js with React Three Fiber and drei, inside the same Next.js app (all MIT, no subscriptions). No separate game engine.
- **Assets:** Poly Haven (CC0) for lighting, textures and props; Microsoft Rocketbox (MIT) for realistic avatars; researchers' own photos and videos for storefronts, interiors, products and ads. See `docs/ASSET_CREDITS.md`.
- **Scenes:** researchers choose a background scene (garden village, futuristic district, mall, strip mall, souq, food court, supermarket aisle, waterfront, duty-free, night market, luxury boulevard; digital: delivery app, search results, video pre-roll). One engine runs all of them; the scene changes appearance, never the experimental logic.
- **Avatars are assigned automatically** from an earlier answer by a researcher-set rule (prototype: woman → woman figure, man → man figure, prefer not to say → no figure, first-person view). The assigned avatar is recorded with the session.
- **Performance:** high and light quality modes; heavy assets (e.g. Poly Haven trees at 66–487 MB) are excluded until reduced versions exist. A non-3D fallback is still needed for low-end devices and screen-reader users.

## 2026-11-09 · Brand and design

- Name **Tessellum** (working; trademark search pending), visual direction B "Instrument": dark studio, Signal orange only for live and primary actions.
- Participant view is separate from the studio: light by default, with dark and match-device modes and an accent colour chosen by the researcher.
- Design canvas: https://claude.ai/artifact/JzuFMD7h2JiypTaxR3dqrz
