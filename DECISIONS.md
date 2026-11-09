# Decisions

Choices made during the rebuild, newest first. `docs/PLATFORM_BRIEF.md` is the functional specification; where a decision here changes it, the decision says so.

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
