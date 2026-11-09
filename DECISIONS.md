# Decisions

Choices made during the rebuild, newest first. `docs/PLATFORM_BRIEF.md` is the functional specification; where a decision here changes it, the decision says so.

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
