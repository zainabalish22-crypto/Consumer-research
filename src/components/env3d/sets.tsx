"use client";

/**
 * The scene sets: one component per background scene. Every set receives the same placed
 * stores (the study) and builds the place around them. Store units are groups tagged with
 * `storeId` (tap to enter); floors the participant may walk on are tagged `walkable`.
 */
import { useTexture } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { Box, Bulbs, Floor, Frame, Glass, Photo, Prop, Sign, Wall, Water, usePbr, useWindowGrid } from "./kit";
import { frontZ, type SceneDef, type SceneId, type Slot } from "./scenes";
import type { VillageStore } from "./village";

export type Placed = { store: VillageStore; slot: Slot };
type SetProps = { scene: SceneDef; placed: Placed[] };

/** A circle the participant cannot walk into: [x, z, radius]. */
export type Blocker = [number, number, number];

/** Dressing item: a model, where it goes, and whether it blocks walking. */
type Item = { id: string; p: [number, number, number]; r?: number; s?: number | [number, number, number]; block?: number };

const SERIF = "600 64px Georgia, 'Times New Roman', serif";
const SANS = "700 60px Arial, Helvetica, sans-serif";
const LUX = "500 58px Didot, 'Bodoni MT', 'Times New Roman', serif";

/* ------------------------------------------------------------------ helpers */

/** A store unit: positioned on its side of the walkway, facing it, tagged for tapping. */
function Unit({ scene, slot, store, children }: { scene: SceneDef; slot: Slot; store: VillageStore; children: React.ReactNode }) {
  return (
    <group position={[slot.x, 0, frontZ(scene, slot.side)]} rotation-y={slot.side === -1 ? 0 : Math.PI} userData={{ storeId: store.id }}>
      {children}
    </group>
  );
}

/** Same frame as a unit, without the store tag: for the fronts between stores. */
function Side({ scene, x, side, children }: { scene: SceneDef; x: number; side: -1 | 1; children: React.ReactNode }) {
  return (
    <group position={[x, 0, frontZ(scene, side)]} rotation-y={side === -1 ? 0 : Math.PI}>
      {children}
    </group>
  );
}

/** Centres of non-store fronts that fit in the gaps between stores on one side. */
function fillerXs(scene: SceneDef, side: -1 | 1, width = scene.unit) {
  const taken = scene.slots.filter((s) => s.side === side).map((s) => [s.x - scene.unit / 2, s.x + scene.unit / 2] as const);
  taken.sort((a, b) => a[0] - b[0]);
  const edges: [number, number][] = [];
  let at = -scene.length / 2;
  for (const [a, b] of taken) {
    edges.push([at, a]);
    at = b;
  }
  edges.push([at, scene.length / 2]);
  const xs: number[] = [];
  for (const [a, b] of edges) {
    const gap = b - a - 0.4;
    const n = Math.floor(gap / width);
    for (let i = 0; i < n; i++) xs.push((a + b) / 2 + (i - (n - 1) / 2) * width);
  }
  return xs;
}

const placedOn = (placed: Placed[], side: -1 | 1) => placed.filter((p) => p.slot.side === side);

/** Shelf-edge offer tag or window poster. */
function Offer({ text, position, size = [1.3, 0.65] }: { text: string; position: [number, number, number]; size?: [number, number] }) {
  return <Sign text={text} bg="#F7E27A" fg="#1A1A1A" size={size} position={position} px={[512, 256]} font="700 54px Arial, sans-serif" />;
}

function Items({ items }: { items: Item[] }) {
  return (
    <>
      {items.map((it, i) => (
        <Prop key={i} id={it.id} position={it.p} rotation={it.r} scale={it.s} />
      ))}
    </>
  );
}

const blocks = (items: Item[]): Blocker[] => items.filter((i) => i.block).map((i) => [i.p[0], i.p[2], i.block!]);

/** Ceiling with long light strips, for the indoor scenes. */
function Ceiling({ y, width, length, color = "#f1f0ec", strips = [0], stripColor = "#fffaf0" }: { y: number; width: number; length: number; color?: string; strips?: number[]; stripColor?: string }) {
  return (
    <group>
      <mesh rotation-x={Math.PI / 2} position={[0, y, 0]}>
        <planeGeometry args={[length, width]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      {strips.map((z) => (
        <Box key={z} size={[length - 2, 0.04, 0.22]} position={[0, y - 0.03, z]} color={stripColor} emissive={1.6} />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ 1. garden village */

function Townhouse({ store, W, H = 6.6, D = 7, wall }: { store: VillageStore; W: number; H?: number; D?: number; wall?: string }) {
  const walls = usePbr(wall ?? store.wall, W / 2.5, H / 2.5);
  return (
    <>
      <mesh position={[0, H / 2, -D / 2]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial {...walls} />
      </mesh>
      <Box size={[W + 0.3, 0.24, D + 0.4]} position={[0, H + 0.12, -D / 2 + 0.1]} color="#d9d4ca" rough={0.8} cast />
      <Photo src={store.interiorPhoto} size={[5.4, 2.7]} position={[-1, 1.75, 0.02]} />
      <Glass size={[5.4, 2.7]} position={[-1, 1.75, 0.06]} />
      <Frame x={-1} y={1.75} w={5.6} h={2.8} />
      <Box size={[1.5, 2.5, 0.04]} position={[3, 1.25, 0.03]} color="#15181b" rough={0.12} metal={0.3} />
      <Box size={[1.7, 0.1, 0.12]} position={[3, 2.55, 0.08]} color="#1f2124" rough={0.4} metal={0.6} />
      {store.offer && <Offer text={store.offer} position={[0.8, 1.2, 0.05]} />}
      <Sign text={store.name} bg={store.sign.bg} fg={store.sign.fg} size={[7.2, 0.9]} position={[0, 3.75, 0.05]} font={SERIF} />
      <Box size={[5.8, 0.06, 1.3]} position={[-1, 3.25, 0.6]} rotation={[0.32, 0, 0]} color={store.awning} rough={0.95} cast />
      {[-2.8, 0, 2.8].map((x) => (
        <group key={x} position={[x, 5.15, 0.03]}>
          <Box size={[1.3, 1.5, 0.02]} position={[0, 0, 0]} color="#2a3238" rough={0.1} metal={0.4} />
          <Box size={[1.5, 0.08, 0.2]} position={[0, -0.82, 0.06]} color="#d9d4ca" rough={0.8} />
        </group>
      ))}
    </>
  );
}

function villageItems(scene: SceneDef): Item[] {
  const edge = 4 + 0.7;
  const items: Item[] = [];
  for (let x = -24; x <= 24; x += 12) {
    items.push({ id: "street_lamp_01", p: [x, 0, -edge], r: 0, block: 0.3 });
    items.push({ id: "street_lamp_01", p: [x + 4, 0, edge], r: Math.PI, block: 0.3 });
  }
  for (let x = -30; x <= 30; x += 4.5) {
    if (Math.abs(x % 9) < 0.01) continue;
    items.push({ id: x % 2 === 0 ? "shrub_02" : "shrub_03", p: [x, 0, -scene.front - 0.3], r: x });
  }
  items.push({ id: "planter_box_02", p: [-13.5, 0, -edge + 0.2], block: 0.6 }, { id: "planter_box_02", p: [4.5, 0, -edge + 0.2], block: 0.6 }, { id: "planter_box_02", p: [-4.5, 0, edge - 0.2], block: 0.6 });
  items.push({ id: "potted_plant_02", p: [-15, 0, -scene.front + 0.6], block: 0.4 }, { id: "potted_plant_02", p: [21, 0, -scene.front + 0.6], block: 0.4 });
  items.push({ id: "painted_wooden_bench", p: [-6, 0, -edge + 0.4], r: 0, block: 0.6 }, { id: "painted_wooden_bench", p: [13, 0, edge - 0.4], r: Math.PI, block: 0.6 });
  items.push({ id: "outdoor_table_chair_set_01", p: [3.5, 0, -scene.front + 1.6], r: 0.3, block: 0.9 });
  for (let x = -26; x <= 26; x += 13) items.push({ id: "flower_gazania", p: [x + 2, 0, edge + 0.2], s: 1.6 });
  return items;
}

function GardenVillage({ scene, placed }: SetProps) {
  return (
    <group>
      <Floor tex="leafy_grass" size={[140, 90]} tile={4.6} />
      <Floor tex="herringbone_pavement" size={[scene.length, scene.front * 2]} position={[0, 0.012, 0]} walkable />
      {placed.map(({ store, slot }) => (
        <Unit key={store.id} scene={scene} slot={slot} store={store}>
          <Townhouse store={store} W={scene.unit} />
        </Unit>
      ))}
      <Items items={villageItems(scene)} />
    </group>
  );
}

/* ------------------------------------------------------------------ 2. futuristic district */

function Tower({ W, seed, height = 26, D = 10 }: { W: number; seed: number; height?: number; D?: number }) {
  const grid = useWindowGrid(seed, Math.round(W / 1.3), Math.round(height / 1.4));
  return (
    <mesh position={[0, 5.6 + height / 2, -D / 2]}>
      <boxGeometry args={[W, height, D]} />
      <meshStandardMaterial map={grid} emissive="#ffffff" emissiveMap={grid} emissiveIntensity={0.85} roughness={0.25} metalness={0.5} />
    </mesh>
  );
}

function TowerBase({ W, D = 10 }: { W: number; D?: number }) {
  const metal = usePbr("metal_plate", W / 2, 5.6 / 2);
  return (
    <mesh position={[0, 2.8, -D / 2 - 0.3]} receiveShadow>
      <boxGeometry args={[W, 5.6, D]} />
      <meshStandardMaterial {...metal} color="#4a5058" metalness={0.6} />
    </mesh>
  );
}

function FuturisticUnit({ store, W, i }: { store: VillageStore; W: number; i: number }) {
  return (
    <>
      <TowerBase W={W} />
      <Tower W={W} seed={i + 3} height={22 + (i % 3) * 6} />
      <Photo src={store.interiorPhoto} size={[W - 1.6, 4.0]} position={[0, 2.1, 0.02]} glow={0.7} />
      <Glass size={[W - 1.6, 4.0]} position={[0, 2.1, 0.06]} />
      <Frame x={0} y={2.1} w={W - 1.5} h={4.1} t={0.1} color="#0d0f12" />
      <Box size={[W, 0.06, 0.06]} position={[0, 4.45, 0.1]} color="#CFE8F2" emissive={2.2} />
      <Box size={[W, 0.15, 2.2]} position={[0, 4.75, 1.1]} color="#15181c" metal={0.7} rough={0.3} />
      <Box size={[W, 0.04, 0.04]} position={[0, 4.66, 2.2]} color="#CFE8F2" emissive={2.2} />
      <Sign text={store.name} bg="#0b0d10" fg="#F2F4F5" size={[W * 0.55, 0.62]} position={[0, 5.2, 0.05]} font="600 60px Arial, Helvetica, sans-serif" glow={1.1} />
      {/* Vertical digital screen: the store's ad (researcher upload) */}
      <Photo src={store.products[0].photo} size={[2.6, 4.2]} position={[W / 2 - 1.6, 8.6, 0.06]} glow={1.0} rough={0.3} />
      {store.offer && <Sign text={store.offer} bg="#0b0d10" fg="#FF6A2B" size={[2.6, 0.6]} position={[W / 2 - 1.6, 6.15, 0.06]} px={[512, 128]} font="700 46px Arial, sans-serif" glow={1.2} />}
      {store.offer && <Offer text={store.offer} position={[2, 1.0, 0.05]} />}
    </>
  );
}

function futuristicItems(scene: SceneDef): Item[] {
  const items: Item[] = [];
  for (let x = -25; x <= 25; x += 10) {
    items.push({ id: "modular_street_seating", p: [x, 0, 0], r: 0, block: 1.4 });
  }
  for (let x = -30; x <= 30; x += 10) {
    items.push({ id: "planter_box_01", p: [x, 0, 0], s: 1.6, block: 0.6 });
    items.push({ id: "shrub_03", p: [x - 0.6, 0.62, 0], s: 0.9 });
  }
  void scene;
  return items;
}

function FuturisticDistrict({ scene, placed }: SetProps) {
  const poles: number[] = [];
  for (let x = -30; x <= 30; x += 12) poles.push(x);
  return (
    <group>
      <Floor tex="concrete_pavement" size={[160, 120]} tile={3} />
      <Floor tex="smooth_concrete_floor" size={[scene.length, scene.front * 2]} position={[0, 0.012, 0]} walkable tile={3} rough={0.35} />
      {placed.map(({ store, slot }, i) => (
        <Unit key={store.id} scene={scene} slot={slot} store={store}>
          <FuturisticUnit store={store} W={scene.unit} i={i} />
        </Unit>
      ))}
      {([-1, 1] as const).flatMap((side) =>
        fillerXs(scene, side).map((x, i) => (
          <Side key={`${side}${x}`} scene={scene} x={x} side={side}>
            <TowerBase W={scene.unit} />
            <Tower W={scene.unit} seed={i * 7 + side + 20} height={30 + ((i * 5) % 12)} />
            <Box size={[scene.unit - 1, 4, 0.05]} position={[0, 2.1, 0.03]} color="#10161c" rough={0.08} metal={0.5} />
            <Box size={[scene.unit, 0.06, 0.06]} position={[0, 4.45, 0.1]} color="#CFE8F2" emissive={2.2} />
          </Side>
        )),
      )}
      {/* Light poles: slim posts with an ice-blue light bar */}
      {poles.flatMap((x) =>
        [-1, 1].map((s) => (
          <group key={`${x}${s}`} position={[x + (s > 0 ? 6 : 0), 0, s * (scene.front - 1.3)]}>
            <Box size={[0.12, 6, 0.12]} position={[0, 3, 0]} color="#1b1e22" metal={0.7} rough={0.35} />
            <Box size={[0.08, 1.6, 0.08]} position={[0, 5.0, -s * 0.07]} color="#CFE8F2" emissive={2.5} />
          </group>
        )),
      )}
      <Items items={futuristicItems(scene)} />
      <pointLight position={[-15, 5, 0]} intensity={14} distance={22} color="#cfe8f2" />
      <pointLight position={[15, 5, 0]} intensity={14} distance={22} color="#ffe2c4" />
    </group>
  );
}

/* ------------------------------------------------------------------ 3. mall */

function MallShop({ store, W }: { store: VillageStore; W: number }) {
  return (
    <>
      <Photo src={store.interiorPhoto} size={[W - 1.4, 3.9]} position={[0, 1.95, 0.03]} glow={0.45} />
      <Glass size={[W - 1.4, 3.9]} position={[0, 1.95, 0.08]} />
      <Frame x={0} y={1.95} w={W - 1.3} h={4.0} t={0.08} color="#3a3d42" z={0.1} />
      <Box size={[0.06, 3.9, 0.08]} position={[W / 2 - 2.4, 1.95, 0.1]} color="#3a3d42" metal={0.6} rough={0.4} />
      <Box size={[W - 0.6, 1.0, 0.25]} position={[0, 4.55, 0.12]} color={store.sign.bg} rough={0.5} />
      <Sign text={store.name} bg={store.sign.bg} fg={store.sign.fg} size={[W * 0.7, 0.85]} position={[0, 4.55, 0.26]} font={SERIF} glow={0.5} />
      {store.offer && <Offer text={store.offer} position={[-W / 2 + 2.2, 1.3, 0.1]} />}
    </>
  );
}

/** A generic upper-floor or filler shop: lit interior colour behind glass, plain fascia. */
function BlankShop({ W, y = 0, tint = "#d8c7ad", fascia = "#e9e7e2" }: { W: number; y?: number; tint?: string; fascia?: string }) {
  return (
    <group position={[0, y, 0]}>
      <Box size={[W - 1.4, 3.6, 0.04]} position={[0, 1.85, 0.03]} color={tint} emissive={0.18} rough={0.8} />
      <Glass size={[W - 1.4, 3.6]} position={[0, 1.85, 0.08]} />
      <Frame x={0} y={1.85} w={W - 1.3} h={3.7} t={0.08} color="#3a3d42" z={0.1} />
      <Box size={[W - 0.6, 0.8, 0.2]} position={[0, 4.15, 0.1]} color={fascia} rough={0.5} />
    </group>
  );
}

function mallItems(): Item[] {
  const items: Item[] = [];
  for (let x = -22.5; x <= 22.5; x += 9) {
    items.push({ id: "modular_street_seating", p: [x, 0, 0], r: 0, block: 1.4 });
    items.push({ id: "potted_plant_02", p: [x + 3.6, 0, 0], s: 1.3, block: 0.5 });
  }
  return items;
}

function Mall({ scene, placed }: SetProps) {
  const H = 11.5;
  const gallery = 2.4;
  const tints = ["#d9c9b0", "#c9d2d6", "#e0d6c8", "#cfc6bd"];
  return (
    <group>
      <Floor tex="marble_tiles" size={[scene.length + 4, scene.front * 2]} tile={2} position={[0, 0.002, 0]} walkable rough={0.18} />
      {([-1, 1] as const).map((s) => (
        <group key={s}>
          <Box size={[scene.length + 4, H, 0.5]} position={[0, H / 2, s * (scene.front + 0.25)]} color="#ecebe7" rough={0.8} />
          {/* Upper gallery: slab, glass balustrade, handrail */}
          <Box size={[scene.length + 4, 0.35, gallery]} position={[0, 5.55, s * (scene.front - gallery / 2)]} color="#f4f3ef" rough={0.6} />
          <Box size={[scene.length + 4, 1.05, 0.03]} position={[0, 6.25, s * (scene.front - gallery)]} color="#bcd0d6" rough={0.05} metal={0.2} />
          <Box size={[scene.length + 4, 0.06, 0.08]} position={[0, 6.8, s * (scene.front - gallery)]} color="#9a9da2" metal={0.8} rough={0.3} />
        </group>
      ))}
      {placed.map(({ store, slot }) => (
        <Unit key={store.id} scene={scene} slot={slot} store={store}>
          <MallShop store={store} W={scene.unit} />
        </Unit>
      ))}
      {([-1, 1] as const).flatMap((side) => [
        ...fillerXs(scene, side).map((x, i) => (
          <Side key={`g${side}${x}`} scene={scene} x={x} side={side}>
            <BlankShop W={scene.unit} tint={tints[i % 4]} />
          </Side>
        )),
        // Upper floor shops, all the way along
        ...Array.from({ length: Math.floor(scene.length / scene.unit) }, (_, i) => -scene.length / 2 + scene.unit / 2 + i * scene.unit).map((x, i) => (
          <Side key={`u${side}${x}`} scene={scene} x={x} side={side}>
            <BlankShop W={scene.unit} y={5.75} tint={tints[(i + 2) % 4]} />
          </Side>
        )),
      ])}
      {/* End walls with a bright entrance */}
      {[-1, 1].map((e) => (
        <group key={e} position={[e * (scene.length / 2 + 2), 0, 0]} rotation-y={-e * (Math.PI / 2)}>
          <Box size={[scene.front * 2, H, 0.4]} position={[0, H / 2, -0.2]} color="#e6e4df" rough={0.8} />
          <Box size={[5, 3.6, 0.05]} position={[0, 1.8, 0.02]} color="#f8fbff" emissive={1.2} />
          <Frame x={0} y={1.8} w={5} h={3.6} t={0.1} color="#5a5d62" z={0.06} />
        </group>
      ))}
      <Ceiling y={H} width={scene.front * 2} length={scene.length + 4} strips={[]} />
      {/* Skylight down the middle */}
      <Box size={[scene.length, 0.05, 4]} position={[0, H - 0.04, 0]} color="#f4fbff" emissive={1.3} />
      {Array.from({ length: Math.floor(scene.length / 3) }, (_, i) => -scene.length / 2 + 1.5 + i * 3).map((x) => (
        <Box key={x} size={[0.12, 0.2, 4.2]} position={[x, H - 0.12, 0]} color="#c9ccd1" metal={0.6} rough={0.4} />
      ))}
      <Items items={mallItems()} />
    </group>
  );
}

/* ------------------------------------------------------------------ 4. strip mall */

function StripUnit({ store, W }: { store: VillageStore; W: number }) {
  return (
    <>
      <Photo src={store.interiorPhoto} size={[W - 2, 2.9]} position={[-0.4, 1.65, 0.02]} glow={0.3} />
      <Glass size={[W - 2, 2.9]} position={[-0.4, 1.65, 0.06]} />
      <Frame x={-0.4} y={1.65} w={W - 1.9} h={3.0} t={0.1} color="#26282b" />
      <Box size={[1.2, 2.4, 0.04]} position={[W / 2 - 0.75, 1.2, 0.03]} color="#1b1e21" rough={0.12} metal={0.3} />
      <Box size={[W - 0.4, 1.05, 0.25]} position={[0, 4.25, 0.12]} color={store.sign.bg} rough={0.6} />
      <Sign text={store.name} bg={store.sign.bg} fg={store.sign.fg} size={[W * 0.7, 0.85]} position={[0, 4.25, 0.26]} font={SERIF} />
      {store.offer && <Offer text={store.offer} position={[1.6, 1.05, 0.08]} />}
    </>
  );
}

function StripMall({ scene, placed }: SetProps) {
  const L = scene.length;
  const F = scene.front;
  const posts: number[] = [];
  for (let x = -L / 2 + 3; x <= L / 2 - 3; x += 6) posts.push(x);
  const bays: number[] = [];
  for (let x = -L / 2 + 2; x <= L / 2 - 2; x += 2.7) bays.push(x);
  const items: Item[] = [
    { id: "metal_trash_can", p: [-18, 0, -F + 3.2], r: 0, block: 0.6 },
    { id: "metal_trash_can", p: [18, 0, -F + 3.2], r: 0, block: 0.6 },
    { id: "planter_box_02", p: [-6, 0, -F + 3.3], block: 0.6 },
    { id: "planter_box_02", p: [6, 0, -F + 3.3], block: 0.6 },
    { id: "painted_wooden_bench", p: [-12, 0, -F + 3.2], r: Math.PI, block: 0.6 },
    { id: "painted_wooden_bench", p: [12, 0, -F + 3.2], r: Math.PI, block: 0.6 },
  ];
  return (
    <group>
      <Floor tex="asphalt_02" size={[160, 100]} tile={4} position={[0, 0, 40]} walkable />
      <Floor tex="concrete_pavement" size={[L + 6, F]} position={[0, 0.15, -F / 2]} tile={2} walkable />
      <Box size={[L + 6, 0.15, 0.25]} position={[0, 0.075, 0]} color="#b9b6ae" rough={0.9} />
      {/* The building: one long single-storey block */}
      <Wall tex="beige_wall_001" size={[L + 6, 5.2, 12]} position={[0, 2.6, -F - 6]} />
      <Box size={[L + 6.4, 0.5, 12.4]} position={[0, 5.45, -F - 6]} color="#d6d0c4" rough={0.85} cast />
      {placed.map(({ store, slot }) => (
        <Unit key={store.id} scene={scene} slot={slot} store={store}>
          <StripUnit store={store} W={scene.unit} />
        </Unit>
      ))}
      {fillerXs(scene, -1, 10).map((x) => (
        <Side key={x} scene={scene} x={x} side={-1}>
          <BlankShop W={10} tint="#3b4046" fascia="#d6d0c4" />
        </Side>
      ))}
      {/* Canopy along the shopfronts */}
      <Box size={[L + 6, 0.3, 3.4]} position={[0, 3.65, -F + 1.7]} color="#e9e5dc" rough={0.7} cast />
      {posts.map((x) => (
        <Box key={x} size={[0.22, 3.5, 0.22]} position={[x, 1.9, -0.6]} color="#4a4d52" metal={0.5} rough={0.4} cast />
      ))}
      {/* Parking bay lines */}
      {bays.map((x) => (
        <Box key={x} size={[0.12, 0.01, 5]} position={[x, 0.006, 3.4]} color="#f2f2ee" rough={0.9} />
      ))}
      {bays.map((x) => (
        <Box key={`b${x}`} size={[0.12, 0.01, 5]} position={[x, 0.006, 12]} color="#f2f2ee" rough={0.9} />
      ))}
      <Box size={[L, 0.01, 0.12]} position={[0, 0.006, 9.5]} color="#f2f2ee" rough={0.9} />
      <Items items={items} />
    </group>
  );
}

function stripBlockers(scene: SceneDef): Blocker[] {
  const b: Blocker[] = [];
  for (let x = -scene.length / 2 + 3; x <= scene.length / 2 - 3; x += 6) b.push([x, -0.6, 0.3]);
  return b;
}

/* ------------------------------------------------------------------ 5. souq */

function SouqStall({ store, W }: { store: VillageStore; W: number }) {
  return (
    <>
      <Box size={[3.4, 3.0, 0.3]} position={[0, 1.5, -0.1]} color="#2b1f16" rough={0.9} />
      <Photo src={store.interiorPhoto} size={[3.0, 2.7]} position={[0, 1.4, 0.07]} glow={0.5} />
      <Frame x={0} y={1.4} w={3.1} h={2.8} t={0.18} color="#5a3e28" z={0.1} />
      {/* Open shutters */}
      <Box size={[0.75, 2.6, 0.05]} position={[-1.98, 1.4, 0.05]} color="#6e4c30" rough={0.85} />
      <Box size={[0.75, 2.6, 0.05]} position={[1.98, 1.4, 0.05]} color="#6e4c30" rough={0.85} />
      <Box size={[W * 0.8, 0.03, 1.3]} position={[0, 3.25, 0.6]} rotation={[0.3, 0, 0]} color={store.awning} rough={1} cast />
      <Sign text={store.name} bg="#3b2a1c" fg="#f0e2c8" size={[3.2, 0.55]} position={[0, 3.75, 0.05]} font={SERIF} />
      {store.offer && <Offer text={store.offer} position={[0, 0.55, 0.2]} size={[1.1, 0.55]} />}
      {/* Goods displayed outside */}
      <Prop id="wooden_crate_01" position={[-2.0, 0, 0.45]} rotation={0.1} />
      <Prop id="wicker_basket_01" position={[-2.0, 0.34, 0.45]} scale={1.4} />
      {[-0.12, 0, 0.12].map((dx) => (
        <Prop key={dx} id="food_apple_01" position={[-2.0 + dx, 0.36, 0.42 + Math.abs(dx)]} />
      ))}
      <Prop id="wooden_display_shelves_01" position={[2.0, 0, 0.3]} rotation={Math.PI / 2} />
      <Prop id="brass_pot_01" position={[1.9, 0.82, 0.3]} />
      <Prop id="ceramic_pot" position={[2.6, 0, 0.55]} scale={0.8} />
      <Prop id="lantern_chandelier_01" position={[0, 3.15, 0.35]} scale={0.7} />
    </>
  );
}

function Souq({ scene, placed }: SetProps) {
  const L = scene.length;
  const F = scene.front;
  const beams: number[] = [];
  for (let x = -L / 2 + 2; x <= L / 2 - 2; x += 4) beams.push(x);
  const cloth = ["#e8dcc4", "#c99a5b", "#e8dcc4", "#9c5a3c"];
  return (
    <group>
      <Floor tex="cobblestone_floor_01" size={[L + 10, F * 2]} tile={2} walkable />
      <Floor tex="cobblestone_floor_01" size={[30, 40]} tile={2} position={[-L / 2 - 14, 0, 0]} />
      <Floor tex="cobblestone_floor_01" size={[30, 40]} tile={2} position={[L / 2 + 14, 0, 0]} />
      {([-1, 1] as const).map((s) => (
        <group key={s}>
          <Wall tex="clay_plaster" size={[L, 6.5, 1]} position={[0, 3.25, s * (F + 0.5)]} tile={3} />
          <Wall tex="large_sandstone_blocks" size={[L, 0.6, 1.3]} position={[0, 6.8, s * (F + 0.55)]} tile={2} />
        </group>
      ))}
      {placed.map(({ store, slot }) => (
        <Unit key={store.id} scene={scene} slot={slot} store={store}>
          <SouqStall store={store} W={scene.unit} />
        </Unit>
      ))}
      {([-1, 1] as const).flatMap((side) =>
        fillerXs(scene, side, 4.5).map((x, i) => (
          <Side key={`${side}${x}`} scene={scene} x={x} side={side}>
            <Box size={[2.2, 2.8, 0.12]} position={[0, 1.4, 0.06]} color={i % 2 ? "#5c4129" : "#3f5054"} rough={0.85} />
            <Frame x={0} y={1.4} w={2.3} h={2.9} t={0.16} color="#4a3322" z={0.12} />
          </Side>
        )),
      )}
      {/* Beams across the lane, with shade cloth between some of them */}
      {beams.map((x, i) => (
        <group key={x}>
          <Box size={[0.22, 0.22, F * 2 + 1]} position={[x, 5.9, 0]} color="#4b3423" rough={0.9} cast />
          {i % 2 === 0 && <Box size={[3.1, 0.02, F * 2 + 0.6]} position={[x + 2, 5.75, 0]} color={cloth[(i / 2) % 4]} rough={1} cast />}
          {i % 3 === 1 && <Prop id="lantern_chandelier_01" position={[x, 5.8, 0]} />}
        </group>
      ))}
      {/* Gateways at both ends */}
      {[-1, 1].map((e) => (
        <group key={e} position={[e * (L / 2), 0, 0]}>
          {[-1, 1].map((s) => (
            <Wall key={s} tex="large_sandstone_blocks" size={[1.2, 7.4, 1.6]} position={[0, 3.7, s * (F + 0.2)]} tile={2} />
          ))}
          <Wall tex="large_sandstone_blocks" size={[1.2, 1.4, F * 2 + 2]} position={[0, 6.7, 0]} tile={2} />
        </group>
      ))}
    </group>
  );
}

function souqBlockers(scene: SceneDef, placed: Placed[]): Blocker[] {
  const b: Blocker[] = [];
  for (const { slot } of placed) {
    // Goods sit either side of each stall door.
    const z = frontZ(scene, slot.side) - slot.side * 0.5;
    const dir = slot.side === -1 ? 1 : -1;
    b.push([slot.x - 2.0 * dir, z, 0.55], [slot.x + 2.0 * dir, z, 0.55], [slot.x + 2.6 * dir, z - slot.side * 0.1, 0.4]);
  }
  return b;
}

/* ------------------------------------------------------------------ 6. food court */

function FoodCounter({ store, W }: { store: VillageStore; W: number }) {
  const [a, b] = store.products;
  const menu = useMemo(() => store.products.map((p) => `${p.name}   BHD ${p.price.toFixed(3)}`).join("\n"), [store.products]);
  return (
    <>
      <Box size={[W - 0.4, 5, 0.1]} position={[0, 2.5, 0.03]} color="#2a2c30" rough={0.7} />
      <Photo src={store.interiorPhoto} size={[W - 1.2, 1.9]} position={[0, 1.95, 0.1]} glow={0.3} />
      <Photo src={a.photo} size={[1.8, 1.2]} position={[-W / 2 + 1.5, 3.6, 0.1]} glow={0.85} rough={0.4} />
      <Sign text={menu} bg="#111214" fg="#F2F4F5" size={[2.8, 1.2]} position={[0, 3.6, 0.1]} px={[768, 330]} font="600 40px Arial, Helvetica, sans-serif" glow={0.9} />
      <Photo src={b.photo} size={[1.8, 1.2]} position={[W / 2 - 1.5, 3.6, 0.1]} glow={0.85} rough={0.4} />
      <Box size={[W - 0.4, 0.9, 0.3]} position={[0, 4.75, 0.2]} color={store.sign.bg} rough={0.5} />
      <Sign text={store.name} bg={store.sign.bg} fg={store.sign.fg} size={[W * 0.6, 0.75]} position={[0, 4.75, 0.36]} font={SERIF} glow={0.6} />
      {/* Counter */}
      <Box size={[W - 1, 1.0, 0.75]} position={[0, 0.5, 1.0]} color={store.sign.bg} rough={0.6} cast />
      <Box size={[W - 0.9, 0.06, 0.85]} position={[0, 1.03, 1.0]} color="#c9ccd0" metal={0.7} rough={0.25} />
      {store.offer && <Offer text={store.offer} position={[0, 0.55, 1.39]} size={[1.4, 0.6]} />}
    </>
  );
}

function foodCourtItems(scene: SceneDef): Item[] {
  const items: Item[] = [];
  for (let x = -21; x <= 21; x += 6)
    for (const z of [6.2, 10.4]) {
      items.push({ id: "round_wooden_table_02", p: [x, 0, z], block: 0.6 });
      items.push({ id: "painted_wooden_chair_02", p: [x, 0, z - 0.75], r: 0 }, { id: "painted_wooden_chair_02", p: [x, 0, z + 0.75], r: Math.PI });
      if ((x + 21) % 12 === 0) items.push({ id: "hanging_industrial_lamp", p: [x, 4.0, z] });
    }
  void scene;
  return items;
}

function FoodCourt({ scene, placed }: SetProps) {
  const L = scene.length;
  const H = 5.4;
  return (
    <group>
      <Floor tex="terrazzo_tiles" size={[L + 4, 22]} tile={2} position={[0, 0, 5]} walkable rough={0.3} />
      <Box size={[L + 4, H, 0.5]} position={[0, H / 2, -scene.front - 0.25]} color="#d9d6cf" rough={0.8} />
      <Box size={[L + 4, H, 0.5]} position={[0, H / 2, 16]} color="#e4e1da" rough={0.8} />
      {[-1, 1].map((e) => (
        <Box key={e} size={[0.5, H, 22]} position={[e * (L / 2 + 2), H / 2, 5]} color="#e4e1da" rough={0.8} />
      ))}
      {/* Tall windows on the far wall */}
      {[-18, -6, 6, 18].map((x) => (
        <group key={x}>
          <Box size={[8, 3.6, 0.04]} position={[x, 2.6, 15.73]} color="#f6fbff" emissive={1.1} />
          <Frame x={x} y={2.6} w={8} h={3.6} t={0.12} color="#55595e" z={15.7} />
        </group>
      ))}
      {placed.map(({ store, slot }) => (
        <Unit key={store.id} scene={scene} slot={slot} store={store}>
          <FoodCounter store={store} W={scene.unit} />
        </Unit>
      ))}
      <Ceiling y={H} width={22} length={L + 4} strips={[-1, 4, 9, 14].map((z) => z)} color="#2d2f33" />
      <group position={[0, 0, 0]}>
        <Items items={foodCourtItems(scene)} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ 7. supermarket aisle */

const FACING = 0.26;
const SHELVES = [0.14, 0.56, 0.98, 1.4, 1.82];

/** Product facings on one gondola: study stores' bays show their product photos; the rest is stock. */
function Gondola({ scene, side, placed }: { scene: SceneDef; side: -1 | 1; placed: Placed[] }) {
  const L = scene.length - 2;
  const photos = useTexture(placed.flatMap((p) => p.store.products.map((pr) => pr.photo)));
  const groups = useMemo(() => {
    const byPhoto = new Map<string, THREE.Matrix4[]>();
    const filler: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const o = new THREE.Object3D();
    const stock = ["#7a2e2a", "#264b6e", "#e8e1cf", "#3f6b3a", "#c48a2c", "#5a3d6e", "#1f1f1f", "#b8b2a3"];
    let k = 0;
    for (let lx = -L / 2 + FACING / 2; lx <= L / 2 - FACING / 2; lx += FACING) {
      const wx = side === -1 ? lx : -lx;
      const bay = placed.find((p) => Math.abs(p.slot.x - wx) < scene.unit / 2 - 0.1);
      SHELVES.forEach((y, row) => {
        const h = 0.3 - (row === 4 ? 0.04 : 0);
        o.position.set(lx, y + 0.02 + h / 2, 0.22);
        o.scale.set(FACING - 0.02, h, 0.24);
        o.updateMatrix();
        if (bay) {
          const pr = bay.store.products[(Math.floor((lx + 99) / (FACING * 3)) + row) % bay.store.products.length];
          if (!byPhoto.has(pr.photo)) byPhoto.set(pr.photo, []);
          byPhoto.get(pr.photo)!.push(o.matrix.clone());
        } else {
          k = (k * 7 + row * 3 + 5) % 97;
          const block = Math.floor((lx + 99) / (FACING * 4));
          filler.push({ m: o.matrix.clone(), c: new THREE.Color(stock[(block * 3 + row * 5) % stock.length]).offsetHSL(0, 0, (k % 5) * 0.012) });
        }
      });
    }
    return { byPhoto, filler };
  }, [L, side, placed, scene.unit]);
  const urls = placed.flatMap((p) => p.store.products.map((pr) => pr.photo));
  return (
    <group position={[0, 0, frontZ(scene, side)]} rotation-y={side === -1 ? 0 : Math.PI}>
      {/* Gondola: back panel, base, shelves, uprights, price strips */}
      <Box size={[L, 2.15, 0.05]} position={[0, 1.07, -0.02]} color="#d7d9dc" rough={0.5} metal={0.3} />
      <Box size={[L, 0.14, 0.5]} position={[0, 0.07, 0.25]} color="#3a3d42" rough={0.6} />
      {SHELVES.map((y) => (
        <group key={y}>
          <Box size={[L, 0.025, 0.5]} position={[0, y, 0.25]} color="#c8cbcf" rough={0.4} metal={0.5} />
          <Box size={[L, 0.04, 0.012]} position={[0, y - 0.005, 0.505]} color="#f4f4f1" rough={0.7} />
        </group>
      ))}
      {Array.from({ length: Math.floor(L / 1.25) + 1 }, (_, i) => -L / 2 + i * 1.25).map((x) => (
        <Box key={x} size={[0.04, 2.15, 0.05]} position={[x, 1.07, 0.02]} color="#9a9ea4" metal={0.6} rough={0.4} />
      ))}
      {[...groups.byPhoto.entries()].map(([url, mats]) => (
        <Facings key={url} mats={mats} photo={photos[urls.indexOf(url)]} />
      ))}
      <StockFacings items={groups.filler} />
    </group>
  );
}

function Facings({ mats, photo }: { mats: THREE.Matrix4[]; photo: THREE.Texture }) {
  const mesh = useMemo(() => {
    photo.colorSpace = THREE.SRGBColorSpace;
    const side = new THREE.MeshStandardMaterial({ color: "#d9d2c4", roughness: 0.7 });
    const front = new THREE.MeshStandardMaterial({ map: photo, roughness: 0.5 });
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), [side, side, side, side, front, side], mats.length);
    mats.forEach((mt, i) => m.setMatrixAt(i, mt));
    m.instanceMatrix.needsUpdate = true;
    return m;
  }, [mats, photo]);
  return <primitive object={mesh} />;
}

function StockFacings({ items }: { items: { m: THREE.Matrix4; c: THREE.Color }[] }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.55 }), items.length);
    items.forEach((it, i) => {
      m.setMatrixAt(i, it.m);
      m.setColorAt(i, it.c);
    });
    m.instanceMatrix.needsUpdate = true;
    return m;
  }, [items]);
  return <primitive object={mesh} />;
}

function Supermarket({ scene, placed }: SetProps) {
  const L = scene.length;
  const H = 4.4;
  return (
    <group>
      <Floor tex="long_white_tiles" size={[L + 10, 20]} tile={1.6} walkable rough={0.25} />
      {([-1, 1] as const).map((side) => (
        <Gondola key={side} scene={scene} side={side} placed={placedOn(placed, side)} />
      ))}
      {/* Store bays: tap targets, header sign and offer tag */}
      {placed.map(({ store, slot }) => (
        <Unit key={store.id} scene={scene} slot={slot} store={store}>
          {/* Invisible tap target over the bay (still hit by taps) */}
          <mesh position={[0, 1.07, 0.3]}>
            <boxGeometry args={[scene.unit - 0.2, 2.15, 0.6]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          <Box size={[scene.unit - 0.3, 0.42, 0.06]} position={[0, 2.42, 0.3]} color={store.sign.bg} rough={0.5} />
          <Sign text={store.name} bg={store.sign.bg} fg={store.sign.fg} size={[scene.unit - 0.6, 0.38]} position={[0, 2.42, 0.34]} px={[1024, 96]} font={SERIF} />
          {store.offer && <Offer text={store.offer} position={[0, 0.95, 0.52]} size={[0.62, 0.2]} />}
          {store.offer && <Offer text={store.offer} position={[-1.2, 1.37, 0.52]} size={[0.62, 0.2]} />}
        </Unit>
      ))}
      {/* Aisle signs hanging across the aisle, readable from both ends */}
      {[-L / 2 + 2, L / 2 - 2].map((x) => (
        <group key={x} position={[x, 3.3, 0]}>
          <Box size={[0.02, 0.9, 0.02]} position={[0, 0.65, 0]} color="#8a8d92" />
          <group rotation-y={Math.PI / 2}>
            <Sign text={"Aisle 7\nCoffee & tea"} bg="#1F5C4E" fg="#FFFFFF" size={[1.8, 0.8]} position={[0, 0, 0.02]} px={[512, 228]} font={SANS} />
          </group>
          <group rotation-y={-Math.PI / 2}>
            <Sign text={"Aisle 7\nCoffee & tea"} bg="#1F5C4E" fg="#FFFFFF" size={[1.8, 0.8]} position={[0, 0, 0.02]} px={[512, 228]} font={SANS} />
          </group>
        </group>
      ))}
      {/* The rest of the store: neighbouring aisles' tops and the walls */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box size={[L - 2, 2.15, 0.6]} position={[0, 1.07, s * 3.9]} color="#c3c6ca" rough={0.6} metal={0.3} />
          <Box size={[L + 10, H, 0.4]} position={[0, H / 2, s * 8]} color="#eeede9" rough={0.85} />
        </group>
      ))}
      {[-1, 1].map((e) => (
        <group key={e} position={[e * (L / 2 + 5), 0, 0]} rotation-y={-e * (Math.PI / 2)}>
          <Box size={[16, H, 0.3]} position={[0, H / 2, -0.15]} color="#eeede9" rough={0.85} />
          <Sign text={e < 0 ? "Bakery" : "Dairy"} bg="#1F5C4E" fg="#FFFFFF" size={[3, 0.7]} position={[0, 3.3, 0.02]} px={[512, 120]} font={SANS} glow={0.4} />
          <Box size={[6, 1.9, 0.05]} position={[0, 1.2, 0.02]} color="#f5f2ea" emissive={0.5} />
        </group>
      ))}
      <Ceiling y={H} width={16} length={L + 10} strips={[-2.6, 0, 2.6, 5.5, -5.5]} />
    </group>
  );
}

/* ------------------------------------------------------------------ 8. waterfront */

function WaterfrontCafe({ store, W }: { store: VillageStore; W: number }) {
  return (
    <>
      <Photo src={store.interiorPhoto} size={[W - 3.4, 2.8]} position={[-0.8, 1.7, 0.02]} />
      <Glass size={[W - 3.4, 2.8]} position={[-0.8, 1.7, 0.06]} />
      <Frame x={-0.8} y={1.7} w={W - 3.3} h={2.9} t={0.1} color="#e9e6df" />
      <Box size={[1.4, 2.5, 0.04]} position={[W / 2 - 1.4, 1.25, 0.03]} color="#20384a" rough={0.3} metal={0.2} />
      <Sign text={store.name} bg={store.sign.bg} fg={store.sign.fg} size={[W * 0.6, 0.75]} position={[0, 3.7, 0.05]} font={SERIF} />
      <Box size={[W - 1, 0.05, 1.8]} position={[0, 3.25, 0.85]} rotation={[0.28, 0, 0]} color={store.awning} rough={1} cast />
      {store.offer && <Offer text={store.offer} position={[1.2, 1.15, 0.05]} />}
    </>
  );
}

function Waterfront({ scene, placed }: SetProps) {
  const L = scene.length;
  const F = scene.front;
  const edge = 7.8;
  const posts: number[] = [];
  for (let x = -L / 2; x <= L / 2; x += 2) posts.push(x);
  const items: Item[] = [];
  for (let x = -24; x <= 24; x += 12) items.push({ id: "wooden_picnic_table", p: [x + 6, 0, 3.4], r: Math.PI / 2, block: 1.3 });
  for (let x = -30; x <= 30; x += 10) items.push({ id: "street_lamp_01", p: [x, 0, edge - 0.5], r: Math.PI, block: 0.3 });
  items.push({ id: "CoffeeCart_01", p: [-6, 0, 5.4], r: 0.3, block: 1.3 }, { id: "painted_wooden_bench", p: [5, 0, edge - 0.7], r: Math.PI, block: 0.6 }, { id: "painted_wooden_bench", p: [-16, 0, edge - 0.7], r: Math.PI, block: 0.6 });
  for (const p of placed) items.push({ id: "potted_plant_02", p: [p.slot.x - scene.unit / 2 + 0.6, 0, -F + 0.5], block: 0.4 });
  return (
    <group>
      <Floor tex="wood_floor_deck" size={[L + 30, edge + F]} tile={2.2} position={[0, 0, (edge - F) / 2]} walkable color="#b8a693" />
      <Water size={[400, 260]} position={[0, -0.9, edge + 130]} />
      <Box size={[L + 30, 1.2, 0.5]} position={[0, -0.6, edge + 0.25]} color="#8b8780" rough={0.9} />
      {/* Railing */}
      {posts.map((x) => (
        <Box key={x} size={[0.06, 1.05, 0.06]} position={[x, 0.52, edge - 0.05]} color="#3c4146" metal={0.7} rough={0.35} />
      ))}
      <Box size={[L, 0.06, 0.08]} position={[0, 1.05, edge - 0.05]} color="#3c4146" metal={0.7} rough={0.35} />
      <Box size={[L, 0.02, 0.02]} position={[0, 0.55, edge - 0.05]} color="#3c4146" metal={0.7} rough={0.35} />
      {/* Building along the promenade */}
      <Wall tex="white_stucco" size={[L + 30, 8.4, 10]} position={[0, 4.2, -F - 5]} />
      <Box size={[L + 30.4, 0.3, 10.4]} position={[0, 8.55, -F - 5]} color="#d9d4ca" rough={0.8} cast />
      {Array.from({ length: Math.floor((L + 28) / 3.2) }, (_, i) => -(L + 28) / 2 + 1.6 + i * 3.2).map((x) => (
        <group key={x} position={[x, 6.1, -F + 0.03]}>
          <Box size={[1.2, 1.5, 0.02]} position={[0, 0, 0]} color="#2a3238" rough={0.1} metal={0.4} />
          <Box size={[1.4, 0.08, 0.2]} position={[0, -0.8, 0.06]} color="#d9d4ca" rough={0.8} />
          <Box size={[0.5, 1.5, 0.04]} position={[-0.88, 0, 0.03]} color="#3c6d8a" rough={0.7} />
          <Box size={[0.5, 1.5, 0.04]} position={[0.88, 0, 0.03]} color="#3c6d8a" rough={0.7} />
        </group>
      ))}
      {placed.map(({ store, slot }) => (
        <Unit key={store.id} scene={scene} slot={slot} store={store}>
          <WaterfrontCafe store={store} W={scene.unit} />
        </Unit>
      ))}
      {fillerXs(scene, -1, 10).map((x) => (
        <Side key={x} scene={scene} x={x} side={-1}>
          <Box size={[6, 2.6, 0.03]} position={[0, 1.6, 0.02]} color="#2a3238" rough={0.1} metal={0.4} />
          <Frame x={0} y={1.6} w={6.1} h={2.7} t={0.1} color="#e9e6df" />
        </Side>
      ))}
      <Items items={items} />
    </group>
  );
}

/* ------------------------------------------------------------------ 9. duty-free */

function Boutique({ store, W }: { store: VillageStore; W: number }) {
  return (
    <>
      <Photo src={store.interiorPhoto} size={[W - 1.4, 4.0]} position={[0, 2.0, 0.02]} glow={0.5} />
      {/* Open portal in gloss white */}
      <Box size={[0.5, 4.6, 0.5]} position={[-W / 2 + 0.45, 2.3, 0.2]} color="#f7f7f5" rough={0.15} cast />
      <Box size={[0.5, 4.6, 0.5]} position={[W / 2 - 0.45, 2.3, 0.2]} color="#f7f7f5" rough={0.15} cast />
      <Box size={[W - 0.4, 1.0, 0.5]} position={[0, 4.6, 0.2]} color="#f7f7f5" rough={0.15} />
      <Sign text={store.name} bg={store.sign.bg} fg={store.sign.fg} size={[W * 0.62, 0.7]} position={[0, 4.6, 0.46]} font={SERIF} glow={0.6} />
      {/* Display plinths with product */}
      {[-1.6, 1.6].map((x, i) => (
        <group key={x} position={[x, 0, 1.1]}>
          <Box size={[1.0, 0.9, 1.0]} position={[0, 0.45, 0]} color="#f2f1ee" rough={0.25} cast />
          <Photo src={store.products[i % store.products.length].photo} size={[0.5, 0.5]} position={[0, 1.16, 0.0]} glow={0.25} />
          <Box size={[0.52, 0.52, 0.2]} position={[0, 1.16, -0.11]} color="#d9d2c4" rough={0.6} />
        </group>
      ))}
      {store.offer && <Offer text={store.offer} position={[0, 0.7, 1.62]} size={[1.0, 0.5]} />}
    </>
  );
}

function DutyFree({ scene, placed }: SetProps) {
  const L = scene.length;
  const F = scene.front;
  const H = 8;
  const board = "DEPARTURES\nTS 112   Lisbon      Boarding   A12\nTS 408   Muscat      14:20      A08\nTS 761   Singapore   15:05      B03";
  const items: Item[] = [];
  for (let x = -21; x <= 21; x += 14) items.push({ id: "modular_street_seating", p: [x, 0, 0], block: 1.4 }, { id: "potted_plant_02", p: [x + 4, 0, 0], s: 1.4, block: 0.5 });
  return (
    <group>
      <Floor tex="granite_tile" size={[L + 4, F * 2]} tile={1.8} walkable rough={0.2} />
      {([-1, 1] as const).map((s) => (
        <Box key={s} size={[L + 4, H, 0.5]} position={[0, H / 2, s * (F + 0.25)]} color="#f0f0ee" rough={0.6} />
      ))}
      {placed.map(({ store, slot }) => (
        <Unit key={store.id} scene={scene} slot={slot} store={store}>
          <Boutique store={store} W={scene.unit} />
        </Unit>
      ))}
      {([-1, 1] as const).flatMap((side) =>
        fillerXs(scene, side).map((x, i) => (
          <Side key={`${side}${x}`} scene={scene} x={x} side={side}>
            <BlankShop W={scene.unit} tint={i % 2 ? "#e8e2d6" : "#d6dde2"} fascia="#f7f7f5" />
          </Side>
        )),
      )}
      {/* Upper glazing above the shops */}
      {([-1, 1] as const).map((s) => (
        <Box key={`w${s}`} size={[L, 2.2, 0.04]} position={[0, 6.4, s * (F - 0.02)]} color="#f4f9ff" emissive={0.9} />
      ))}
      {[-1, 1].map((e) => (
        <Box key={e} size={[0.4, H, F * 2]} position={[e * (L / 2 + 2), H / 2, 0]} color="#e8e8e6" rough={0.6} />
      ))}
      <Ceiling y={H} width={F * 2} length={L + 4} strips={[-3, 0, 3]} color="#f5f5f3" />
      {/* Departures board, readable while walking along */}
      {[-10, 10].map((x) => (
        <group key={x} position={[x, 4.4, 0]}>
          <Box size={[0.04, 1.6, 0.04]} position={[0, 2.0, 0]} color="#8a8d92" />
          {[1, -1].map((d) => (
            <group key={d} rotation-y={d * (Math.PI / 2)}>
              <Sign text={board} bg="#0d1117" fg="#F2C94C" size={[3.6, 1.5]} position={[0, 0, 0.06]} px={[1024, 420]} font="600 46px 'Courier New', monospace" glow={1} />
            </group>
          ))}
          <Box size={[0.1, 1.6, 3.7]} position={[0, 0, 0]} color="#1b1e22" />
        </group>
      ))}
      <Items items={items} />
    </group>
  );
}

/* ------------------------------------------------------------------ 10. night market */

function useStripes(color: string) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 8;
    const g = c.getContext("2d")!;
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? "#f1ece2" : color;
      g.fillRect(i * 32, 0, 32, 8);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [color]);
}

function MarketStall({ store, W }: { store: VillageStore; W: number }) {
  const stripes = useStripes(store.awning);
  const D = 2.6;
  const corners: [number, number][] = [
    [-W / 2 + 0.3, 0.2],
    [W / 2 - 0.3, 0.2],
    [-W / 2 + 0.3, -D],
    [W / 2 - 0.3, -D],
  ];
  return (
    <>
      {corners.map(([x, z], i) => (
        <Box key={i} size={[0.08, 2.6, 0.08]} position={[x, 1.3, z]} color="#2a2b2e" metal={0.6} rough={0.4} />
      ))}
      <mesh position={[0, 2.7, -D / 2 + 0.1]} rotation-x={0.08} castShadow>
        <boxGeometry args={[W - 0.2, 0.06, D + 0.8]} />
        <meshStandardMaterial map={stripes} roughness={1} />
      </mesh>
      <Photo src={store.interiorPhoto} size={[W - 0.8, 2.2]} position={[0, 1.4, -D + 0.05]} glow={0.55} />
      <Box size={[W - 1, 0.95, 0.7]} position={[0, 0.48, -0.15]} color="#6b4a32" rough={0.8} cast />
      <Prop id="wooden_crate_01" position={[-1.2, 0.95, -0.15]} />
      <Prop id="wicker_basket_01" position={[0.2, 0.95, -0.15]} scale={1.5} />
      <Prop id="wicker_basket_01" position={[1.2, 0.95, -0.15]} scale={1.5} />
      {[-0.1, 0.05].map((dx) => (
        <Prop key={dx} id="food_apple_01" position={[-1.2 + dx, 1.3, -0.15 + dx]} />
      ))}
      <Sign text={store.name} bg="#141518" fg={store.sign.bg === "#FFFFFF" ? "#F2F4F5" : store.sign.bg} size={[W * 0.7, 0.42]} position={[0, 2.38, 0.3]} px={[1024, 128]} font={SERIF} glow={1.1} />
      {store.offer && <Offer text={store.offer} position={[0, 0.55, 0.21]} size={[1.2, 0.6]} />}
      <Bulbs runs={[{ from: [-W / 2 + 0.2, 2.55, 0.32], to: [W / 2 - 0.2, 2.55, 0.32], n: 12 }]} sag={0.12} />
      <Prop id="lantern_chandelier_01" position={[0, 2.62, -1.2]} scale={0.6} />
    </>
  );
}

function NightMarket({ scene, placed }: SetProps) {
  const L = scene.length;
  const F = scene.front;
  const runs = useMemo(() => {
    const r: { from: [number, number, number]; to: [number, number, number]; n: number }[] = [];
    for (let x = -L / 2 + 3; x <= L / 2 - 3; x += 4.5) r.push({ from: [x, 4.2, -F - 0.4], to: [x + 2, 4.2, F + 0.4], n: 22 });
    return r;
  }, [L, F]);
  const items: Item[] = [
    { id: "CoffeeCart_01", p: [-21.5, 0, -F + 1.2], r: 0.2, block: 1.3 },
    { id: "wooden_picnic_table", p: [3.5, 0, F + 3.5], r: Math.PI / 2 },
    { id: "wooden_picnic_table", p: [-3.5, 0, -F - 3.5], r: Math.PI / 2 },
    { id: "metal_trash_can", p: [21, 0, F - 1.2], block: 0.6 },
  ];
  const poles: number[] = [];
  for (let x = -L / 2 + 3; x <= L / 2 - 3; x += 4.5) poles.push(x);
  return (
    <group>
      <Floor tex="asphalt_02" size={[L + 40, 60]} tile={4} />
      <Floor tex="cobblestone_floor_01" size={[L, F * 2 + 1]} tile={2} position={[0, 0.01, 0]} walkable />
      {placed.map(({ store, slot }) => (
        <Unit key={store.id} scene={scene} slot={slot} store={store}>
          <MarketStall store={store} W={scene.unit} />
        </Unit>
      ))}
      {([-1, 1] as const).flatMap((side) =>
        fillerXs(scene, side, 5).map((x, i) => (
          <Side key={`${side}${x}`} scene={scene} x={x} side={side}>
            <MarketStallBlank W={5} color={["#2f5d50", "#8a3b2c", "#3d4a6b", "#7a5a1e"][(i + (side > 0 ? 2 : 0)) % 4]} />
          </Side>
        )),
      )}
      {poles.flatMap((x) => [-1, 1].map((s) => <Box key={`${x}${s}`} size={[0.07, 4.3, 0.07]} position={[x + (s > 0 ? 2 : 0), 2.15, s * (F + 0.4)]} color="#232428" metal={0.6} rough={0.4} />))}
      <Bulbs runs={runs} />
      <Items items={items} />
      <pointLight position={[-12, 3.6, 0]} intensity={10} distance={14} color="#ffcf8a" />
      <pointLight position={[0, 3.6, 0]} intensity={10} distance={14} color="#ffcf8a" />
      <pointLight position={[12, 3.6, 0]} intensity={10} distance={14} color="#ffcf8a" />
    </group>
  );
}

function MarketStallBlank({ W, color }: { W: number; color: string }) {
  const stripes = useStripes(color);
  return (
    <>
      {[-W / 2 + 0.3, W / 2 - 0.3].map((x) => (
        <Box key={x} size={[0.08, 2.6, 0.08]} position={[x, 1.3, 0.2]} color="#2a2b2e" metal={0.6} rough={0.4} />
      ))}
      <mesh position={[0, 2.7, -1.2]} rotation-x={0.08}>
        <boxGeometry args={[W - 0.2, 0.06, 3.4]} />
        <meshStandardMaterial map={stripes} roughness={1} />
      </mesh>
      <Box size={[W - 1, 0.95, 0.7]} position={[0, 0.48, -0.15]} color="#5a3f2b" rough={0.8} />
      <Box size={[W - 0.6, 2.4, 0.05]} position={[0, 1.3, -2.5]} color="#2a2724" rough={0.9} />
      <Prop id="wooden_crate_01" position={[-0.8, 0.95, -0.15]} />
      <Prop id="wooden_crate_01" position={[0.8, 0.95, -0.15]} rotation={0.1} />
    </>
  );
}

function nightBlockers(scene: SceneDef): Blocker[] {
  const b: Blocker[] = [];
  for (let x = -scene.length / 2 + 3; x <= scene.length / 2 - 3; x += 4.5)
    for (const s of [-1, 1]) b.push([x + (s > 0 ? 2 : 0), s * (scene.front + 0.4), 0.2]);
  return b;
}

/* ------------------------------------------------------------------ 11. luxury boulevard */

function LuxuryFront({ store, W }: { store: VillageStore; W: number }) {
  return (
    <>
      <Photo src={store.interiorPhoto} size={[W - 4.2, 4.4]} position={[-1, 2.6, 0.03]} glow={0.35} />
      <Glass size={[W - 4.2, 4.4]} position={[-1, 2.6, 0.08]} />
      <Frame x={-1} y={2.6} w={W - 4} h={4.6} t={0.22} color="#0e0e0f" z={0.12} />
      <Box size={[1.6, 3.4, 0.05]} position={[W / 2 - 1.6, 1.7, 0.03]} color="#1a1712" rough={0.2} metal={0.4} />
      <Frame x={W / 2 - 1.6} y={1.7} w={1.7} h={3.5} t={0.16} color="#8a6d3b" z={0.1} />
      <Box size={[W - 1, 1.1, 0.14]} position={[0, 5.6, 0.08]} color="#0d0d0d" rough={0.4} />
      <Sign text={store.name.toUpperCase()} bg="#0d0d0d" fg="#c9a55a" size={[W * 0.62, 0.8]} position={[0, 5.6, 0.16]} font={LUX} />
      <Box size={[W - 1.6, 0.04, 1.5]} position={[0, 4.95, 0.75]} rotation={[0.18, 0, 0]} color="#151515" rough={0.6} cast />
      {store.offer && <Offer text={store.offer} position={[-1, 1.0, 0.1]} size={[1.1, 0.55]} />}
    </>
  );
}

function StoneUpper({ W }: { W: number }) {
  return (
    <>
      {[8.2, 11.4, 14.6].map((y) =>
        [-W / 4, W / 4].map((x) => (
          <group key={`${x}${y}`} position={[x, y, 0.04]}>
            <Box size={[1.5, 2.2, 0.02]} position={[0, 0, 0]} color="#1e2428" rough={0.08} metal={0.5} />
            <Box size={[1.9, 0.14, 0.4]} position={[0, -1.18, 0.15]} color="#e9e2d2" rough={0.7} />
            <Box size={[1.8, 0.04, 0.04]} position={[0, -0.3, 0.38]} color="#151515" metal={0.7} rough={0.4} />
          </group>
        )),
      )}
    </>
  );
}

function LuxuryBoulevard({ scene, placed }: SetProps) {
  const L = scene.length;
  const F = scene.front;
  const items: Item[] = [];
  for (let x = -L / 2 + 6; x <= L / 2 - 6; x += 11) {
    items.push({ id: "street_lamp_01", p: [x, 0, 0], block: 0.3 });
    items.push({ id: "planter_box_01", p: [x + 5.5, 0, 0], s: 2, block: 0.95 }, { id: "shrub_03", p: [x + 4.9, 0.8, 0], s: 1.2 });
  }
  for (let x = -L / 2 + 12; x <= L / 2 - 12; x += 22)
    for (const s of [-1, 1]) items.push({ id: "modular_street_seating", p: [x, 0, s * 4.2], r: s > 0 ? Math.PI : 0, block: 1.4 });
  return (
    <group>
      <Floor tex="granite_tile" size={[L + 40, 80]} tile={2.2} />
      <Floor tex="granite_tile" size={[L, F * 2]} tile={1.6} position={[0, 0.01, 0]} walkable rough={0.35} color="#e8e2d8" />
      {([-1, 1] as const).map((s) => (
        <group key={s}>
          <Wall tex="white_sandstone_bricks" size={[L + 20, 17, 12]} position={[0, 8.5, s * (F + 6)]} tile={1.4} color="#f3e9d6" />
          <Box size={[L + 20.6, 0.6, 12.6]} position={[0, 17.2, s * (F + 6)]} color="#e9e2d2" rough={0.75} cast />
          <Box size={[L + 20, 0.3, 0.5]} position={[0, 6.6, s * (F + 0.2)]} color="#e9e2d2" rough={0.75} />
        </group>
      ))}
      {placed.map(({ store, slot }) => (
        <Unit key={store.id} scene={scene} slot={slot} store={store}>
          <LuxuryFront store={store} W={scene.unit} />
          <StoneUpper W={scene.unit} />
        </Unit>
      ))}
      {([-1, 1] as const).flatMap((side) =>
        fillerXs(scene, side).map((x) => (
          <Side key={`${side}${x}`} scene={scene} x={x} side={side}>
            <Box size={[scene.unit - 4, 4.4, 0.03]} position={[0, 2.6, 0.03]} color="#1c2024" rough={0.08} metal={0.5} />
            <Frame x={0} y={2.6} w={scene.unit - 3.8} h={4.6} t={0.22} color="#0e0e0f" z={0.12} />
            <StoneUpper W={scene.unit} />
          </Side>
        )),
      )}
      <Items items={items} />
    </group>
  );
}

/* ------------------------------------------------------------------ registry */

export const SETS: Record<SceneId, (p: SetProps) => React.ReactElement> = {
  "garden-village": GardenVillage,
  "futuristic-district": FuturisticDistrict,
  mall: Mall,
  "strip-mall": StripMall,
  souq: Souq,
  "food-court": FoodCourt,
  supermarket: Supermarket,
  waterfront: Waterfront,
  "duty-free": DutyFree,
  "night-market": NightMarket,
  "luxury-boulevard": LuxuryBoulevard,
};

/** Everything in a scene the participant should walk around rather than through. */
export function blockersFor(scene: SceneDef, placed: Placed[]): Blocker[] {
  switch (scene.id) {
    case "garden-village":
      return blocks(villageItems(scene));
    case "futuristic-district":
      return blocks(futuristicItems(scene));
    case "mall":
      return blocks(mallItems());
    case "strip-mall":
      return [...stripBlockers(scene), [-18, -F(scene) + 3.2, 0.6], [18, -F(scene) + 3.2, 0.6], [-6, -F(scene) + 3.3, 0.6], [6, -F(scene) + 3.3, 0.6], [-12, -F(scene) + 3.2, 0.6], [12, -F(scene) + 3.2, 0.6]];
    case "souq":
      return souqBlockers(scene, placed);
    case "food-court":
      return blocks(foodCourtItems(scene));
    case "waterfront": {
      const b: Blocker[] = [];
      for (let x = -24; x <= 24; x += 12) b.push([x + 6, 3.4, 1.3]);
      for (let x = -30; x <= 30; x += 10) b.push([x, 7.3, 0.3]);
      b.push([-6, 5.4, 1.3], [5, 7.1, 0.6], [-16, 7.1, 0.6]);
      for (const p of placed) b.push([p.slot.x - scene.unit / 2 + 0.6, -scene.front + 0.5, 0.4]);
      return b;
    }
    case "duty-free": {
      const b: Blocker[] = [];
      for (let x = -21; x <= 21; x += 14) b.push([x, 0, 1.4], [x + 4, 0, 0.5]);
      for (const p of placed) for (const dx of [-1.6, 1.6]) b.push([p.slot.x + dx * (p.slot.side === -1 ? 1 : -1), frontZ(scene, p.slot.side) - p.slot.side * 1.1, 0.75]);
      return b;
    }
    case "night-market":
      return [...nightBlockers(scene), [-21.5, -scene.front + 1.2, 1.3], [21, scene.front - 1.2, 0.6]];
    case "luxury-boulevard": {
      const b: Blocker[] = [];
      for (let x = -scene.length / 2 + 6; x <= scene.length / 2 - 6; x += 11) b.push([x, 0, 0.3], [x + 5.5, 0, 0.95]);
      for (let x = -scene.length / 2 + 12; x <= scene.length / 2 - 12; x += 22) for (const s of [-1, 1]) b.push([x, s * 4.2, 1.4]);
      return b;
    }
    default:
      return [];
  }
}
const F = (s: SceneDef) => s.front;
