/**
 * The scene library: the backgrounds a researcher chooses for the 3D environment module.
 * Every scene runs the same study (the same stores, offers, products and recorded events);
 * only the place changes. Each scene is a walkway along x with store units facing it.
 */
export type SceneId =
  | "garden-village"
  | "futuristic-district"
  | "mall"
  | "strip-mall"
  | "souq"
  | "food-court"
  | "supermarket"
  | "waterfront"
  | "duty-free"
  | "night-market"
  | "luxury-boulevard";

/** Where a store sits: centre along the walkway, and which side (-1 north, 1 south). */
export type Slot = { x: number; side: -1 | 1 };

export type SceneDef = {
  id: SceneId;
  name: string;
  /** One line for the researcher's scene picker. */
  blurb: string;
  setting: "outdoor" | "indoor";
  time: "day" | "night";
  /** Poly Haven HDRI file (lighting, and the sky when `sky` is true). */
  hdri: string;
  /** Turns the HDRI (radians), e.g. to keep real brand signs in a photo sky out of view. */
  hdriRotation?: number;
  sky: boolean;
  /** Background colour when the sky is hidden (indoor scenes). */
  bg?: string;
  envIntensity: number;
  sun: { position: [number, number, number]; intensity: number; color?: string };
  fog?: { color: string; near: number; far: number };
  /** Walkway length along x. */
  length: number;
  /** Distance from the centre line to the store fronts. */
  front: number;
  /** Width of each store unit along the walkway. */
  unit: number;
  /** Where the participant may walk: [xMin, xMax, zMin, zMax]. */
  bounds: [number, number, number, number];
  slots: Slot[];
  start: { x: number; z: number; heading: number };
  /** Shown while the scene loads, e.g. "Preparing the mall…". */
  loading: string;
};

const EAST = Math.PI / 2;

/** Bounds for a walkway with stores on both sides: stop just short of the fronts. */
const twoSided = (length: number, front: number, margin = 0.9): [number, number, number, number] => [-length / 2 + 1, length / 2 - 1, -front + margin, front - margin];

export const SCENES: SceneDef[] = [
  {
    id: "garden-village",
    name: "Garden village",
    blurb: "A paved village street with gardens, townhouse shops and café seating, on a sunny day.",
    setting: "outdoor",
    time: "day",
    hdri: "sunny_rose_garden_2k.hdr",
    sky: true,
    envIntensity: 0.9,
    sun: { position: [18, 26, 12], intensity: 2.4 },
    length: 64,
    front: 7,
    unit: 9,
    bounds: twoSided(64, 7),
    slots: [
      { x: -18, side: -1 },
      { x: 0, side: -1 },
      { x: 18, side: -1 },
      { x: -9, side: 1 },
      { x: 9, side: 1 },
    ],
    start: { x: -26, z: 0, heading: EAST },
    loading: "Preparing the village street…",
  },
  {
    id: "futuristic-district",
    name: "Futuristic district",
    blurb: "Glass towers, lit facades and digital screens on a concrete plaza at dusk.",
    setting: "outdoor",
    time: "night",
    hdri: "rooftop_night_2k.hdr",
    sky: true,
    envIntensity: 0.55,
    sun: { position: [-20, 30, 10], intensity: 0.5, color: "#c9d8ff" },
    length: 70,
    front: 8,
    unit: 10,
    bounds: twoSided(70, 8),
    slots: [
      { x: -20, side: -1 },
      { x: 0, side: -1 },
      { x: 20, side: -1 },
      { x: -10, side: 1 },
      { x: 10, side: 1 },
    ],
    start: { x: -30, z: 3, heading: EAST },
    loading: "Preparing the district…",
  },
  {
    id: "mall",
    name: "Shopping mall",
    blurb: "An indoor mall concourse: marble floor, glass shopfronts, skylight and seating.",
    setting: "indoor",
    time: "day",
    hdri: "rostock_laage_airport_2k.hdr",
    sky: false,
    bg: "#d8d6d0",
    envIntensity: 1.0,
    sun: { position: [6, 20, 4], intensity: 1.2 },
    length: 60,
    front: 6,
    unit: 9,
    bounds: [-27, 27, -5.1, 5.1],
    slots: [
      { x: -18, side: -1 },
      { x: 0, side: -1 },
      { x: 18, side: -1 },
      { x: -9, side: 1 },
      { x: 9, side: 1 },
    ],
    start: { x: -25, z: 2.6, heading: EAST },
    loading: "Preparing the mall…",
  },
  {
    id: "strip-mall",
    name: "Strip mall",
    blurb: "A single row of shops under a canopy, facing an open car park.",
    setting: "outdoor",
    time: "day",
    hdri: "mall_parking_lot_2k.hdr",
    hdriRotation: (Math.PI * 3) / 4,
    sky: true,
    envIntensity: 0.9,
    sun: { position: [20, 28, 18], intensity: 2.6 },
    length: 64,
    front: 4,
    unit: 10,
    bounds: [-31, 31, -3.1, 16],
    slots: [
      { x: -24, side: -1 },
      { x: -12, side: -1 },
      { x: 0, side: -1 },
      { x: 12, side: -1 },
      { x: 24, side: -1 },
    ],
    start: { x: -28, z: 2, heading: EAST },
    loading: "Preparing the strip mall…",
  },
  {
    id: "souq",
    name: "Souq",
    blurb: "A narrow covered market lane with plaster walls, stalls, lanterns and shade cloth.",
    setting: "outdoor",
    time: "day",
    hdri: "wide_street_01_2k.hdr",
    sky: true,
    envIntensity: 1.1,
    sun: { position: [10, 30, 6], intensity: 2.8, color: "#fff1dc" },
    length: 46,
    front: 3,
    unit: 6,
    bounds: twoSided(46, 3, 0.7),
    slots: [
      { x: -14, side: -1 },
      { x: 0, side: -1 },
      { x: 14, side: -1 },
      { x: -7, side: 1 },
      { x: 7, side: 1 },
    ],
    start: { x: -20, z: 0, heading: EAST },
    loading: "Preparing the souq…",
  },
  {
    id: "food-court",
    name: "Food court",
    blurb: "Food counters with lit menu boards facing a seating area under hanging lamps.",
    setting: "indoor",
    time: "day",
    hdri: "rostock_laage_airport_2k.hdr",
    sky: false,
    bg: "#cfccc5",
    envIntensity: 0.95,
    sun: { position: [4, 20, 8], intensity: 1.1 },
    length: 52,
    front: 3.5,
    unit: 8,
    bounds: [-23, 23, -1.75, 3.2],
    slots: [
      { x: -20, side: -1 },
      { x: -10, side: -1 },
      { x: 0, side: -1 },
      { x: 10, side: -1 },
      { x: 20, side: -1 },
    ],
    start: { x: -21, z: 1.2, heading: EAST },
    loading: "Preparing the food court…",
  },
  {
    id: "supermarket",
    name: "Supermarket aisle",
    blurb: "A supermarket aisle with stocked shelving, shelf-edge offer tags and aisle signs.",
    setting: "indoor",
    time: "day",
    hdri: "rostock_laage_airport_2k.hdr",
    sky: false,
    bg: "#e7e6e2",
    envIntensity: 1.0,
    sun: { position: [2, 20, 3], intensity: 1.0 },
    length: 30,
    front: 1.4,
    unit: 4.4,
    bounds: twoSided(30, 1.4, 0.55),
    slots: [
      { x: -8, side: -1 },
      { x: 0, side: -1 },
      { x: 8, side: -1 },
      { x: -4, side: 1 },
      { x: 4, side: 1 },
    ],
    start: { x: -13.5, z: 0, heading: EAST },
    loading: "Preparing the supermarket…",
  },
  {
    id: "waterfront",
    name: "Waterfront",
    blurb: "A timber promenade with cafés on one side and the harbour on the other.",
    setting: "outdoor",
    time: "day",
    hdri: "simons_town_harbour_2k.hdr",
    sky: true,
    envIntensity: 0.9,
    sun: { position: [-16, 26, 20], intensity: 2.4 },
    length: 64,
    front: 4,
    unit: 10,
    bounds: [-31, 31, -3.1, 7.2],
    slots: [
      { x: -24, side: -1 },
      { x: -12, side: -1 },
      { x: 0, side: -1 },
      { x: 12, side: -1 },
      { x: 24, side: -1 },
    ],
    start: { x: -28, z: 2, heading: EAST },
    loading: "Preparing the waterfront…",
  },
  {
    id: "duty-free",
    name: "Airport duty-free",
    blurb: "A bright airport duty-free walkway with open boutiques and a departures board.",
    setting: "indoor",
    time: "day",
    hdri: "rostock_laage_airport_2k.hdr",
    sky: false,
    bg: "#e9ebee",
    envIntensity: 1.1,
    sun: { position: [8, 22, 6], intensity: 1.1 },
    length: 56,
    front: 6,
    unit: 9,
    bounds: [-25, 25, -5.1, 5.1],
    slots: [
      { x: -17, side: -1 },
      { x: 0, side: -1 },
      { x: 17, side: -1 },
      { x: -8.5, side: 1 },
      { x: 8.5, side: 1 },
    ],
    start: { x: -23, z: 2.6, heading: EAST },
    loading: "Preparing the terminal…",
  },
  {
    id: "night-market",
    name: "Night market",
    blurb: "Open-air market stalls under canopies and string lights, in the evening.",
    setting: "outdoor",
    time: "night",
    hdri: "rooftop_night_2k.hdr",
    sky: true,
    envIntensity: 0.5,
    sun: { position: [-10, 30, -12], intensity: 0.35, color: "#bcd0ff" },
    length: 48,
    front: 3.6,
    unit: 5,
    bounds: twoSided(48, 3.6, 0.8),
    slots: [
      { x: -14, side: -1 },
      { x: 0, side: -1 },
      { x: 14, side: -1 },
      { x: -7, side: 1 },
      { x: 7, side: 1 },
    ],
    start: { x: -21, z: 0, heading: EAST },
    loading: "Preparing the night market…",
  },
  {
    id: "luxury-boulevard",
    name: "Luxury boulevard",
    blurb: "A wide stone boulevard with tall facades, display windows and gold lettering.",
    setting: "outdoor",
    time: "day",
    hdri: "wide_street_01_2k.hdr",
    sky: true,
    envIntensity: 0.9,
    sun: { position: [22, 30, 10], intensity: 2.5 },
    length: 72,
    front: 9,
    unit: 11,
    bounds: twoSided(72, 9),
    slots: [
      { x: -22, side: -1 },
      { x: 0, side: -1 },
      { x: 22, side: -1 },
      { x: -11, side: 1 },
      { x: 11, side: 1 },
    ],
    start: { x: -32, z: 2.6, heading: EAST },
    loading: "Preparing the boulevard…",
  },
];

export const sceneById = (id: string) => SCENES.find((s) => s.id === id);

/** z of a store front for its side. */
export const frontZ = (scene: SceneDef, side: -1 | 1) => side * scene.front;

/** Where the participant stands to be "at the door". */
export function doorPoint(scene: SceneDef, slot: Slot): [number, number] {
  return [slot.x, frontZ(scene, slot.side) - slot.side * 1.2];
}

/** Heading that faces a store from its door point. */
export const faceStore = (slot: Slot) => (slot.side === -1 ? Math.PI : 0);
