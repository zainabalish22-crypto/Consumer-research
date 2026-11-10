# Decisions

Choices made during the rebuild, newest first. `docs/PLATFORM_BRIEF.md` is the functional specification; where a decision here changes it, the decision says so.

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
