# Asset credits (3D village prototype)

All assets are free to use without payment or subscription. The files live in `public/proto/`. The simplified, compressed set is committed and deployed; the full-size source models (`public/proto/env/models/`) stay local.

| Asset | Source | Licence |
|---|---|---|
| Sky and lighting: Sunny Rose Garden HDRI (2k) | [Poly Haven](https://polyhaven.com/a/sunny_rose_garden) | CC0 |
| Textures: herringbone pavement, leafy grass, white stucco, beige wall 001, dark brick wall (1k) | [Poly Haven](https://polyhaven.com/textures) | CC0 |
| Models: shrub 02, shrub 03, potted plant 02, planter box 02, painted wooden bench, outdoor table and chair set 01, street lamp 01, gazania flower (1k) | [Poly Haven](https://polyhaven.com/models) | CC0 |
| Skies and lighting (2k): Rostock Laage Airport (indoor scenes), Mall Parking Lot (strip mall), Simon's Town Harbour (waterfront), Rooftop Night (futuristic district, night market), Wide Street 01 (souq, luxury boulevard) | [Poly Haven](https://polyhaven.com/hdris) | CC0 |
| Textures (1k): marble tiles, terrazzo tiles, long white tiles, asphalt 02, concrete pavement, smooth concrete floor, wood floor deck, cobblestone floor 01, white sandstone bricks, large sandstone blocks, clay plaster, metal plate, granite tile | [Poly Haven](https://polyhaven.com/textures) | CC0 |
| Models (1k): wooden display shelves 01, wooden crate 01, wicker basket 01, apple, modular street seating, metal trash can, street lamp 02, hanging industrial lamp, modern ceiling lamp 01, round wooden table 02, painted wooden chair 02, lantern chandelier 01, brass pot 01, ceramic pot, potted plant 04, planter box 01, coffee cart 01, wooden picnic table, steel frame shelves 01 (downloaded, not used: the supermarket shelving is built in code) | [Poly Haven](https://polyhaven.com/models) | CC0 |
| Avatars: Female_Adult_01, Male_Adult_01, and walk animations f/m_walk_neutral | [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) | MIT |
| Photos: café storefronts, interiors and drinks (8; two drinks also in `public/samples/` for the starter shop) | Unsplash: JQgWhib1FA0, PyHrr8nZXvs, V_AZ3zBj8aU, WmWaMDf4yCY, RPDCA2KiLAQ, 3qMEJJZ9i6Y, L-sm1B4L1Ns, 7ZkoxdZLrog | [Unsplash Licence](https://unsplash.com/license) |

Processing: avatar TGA skins were converted to 1024 px JPG/PNG; photos resized to 1024 px wide; model textures re-encoded at 512 px and surfaces at 1024 px (sharp, mozjpeg); Poly Haven models were simplified with [glTF-Transform](https://gltf-transform.dev) (MIT) into `public/proto/env/models-lite` (for example the street lamp from 30,610 to 3,876 triangles).

Note: the Mall Parking Lot sky shows real retail brands (for example JYSK); the strip mall scene turns the sky so they stay hidden behind the building. "Modern Buildings Night" was downloaded and then deleted, because it shows an indoor atrium rather than an open-air night sky.

Note: interior photo WmWaMDf4yCY (`interior_1.jpg`) shows a real café's name on its menu screen. It is no longer used and must never be published; researchers supply their own photos.
