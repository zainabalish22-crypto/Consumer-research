/**
 * Prototype configuration for the garden village scene. In the real platform this comes from
 * the study's environment settings (stores, photos, products); here it is fixed for testing.
 */
export type WallTexture = "white_stucco" | "beige_wall_001" | "dark_brick_wall";

export type VillageStore = {
  id: string;
  name: string;
  /** Centre of the store front along the street (metres). */
  x: number;
  /** -1: north side of the street, 1: south side. */
  side: -1 | 1;
  wall: WallTexture;
  awning: string;
  sign: { bg: string; fg: string };
  storefrontPhoto: string;
  interiorPhoto: string;
  offer?: string;
  products: { id: string; name: string; price: number; was?: number; photo: string }[];
};

const P = "/proto/photos";

export const STREET = { length: 64, width: 8, storeDepth: 7, storeWidth: 9, setback: 3 };

export const STORES: VillageStore[] = [
  {
    id: "store_1",
    name: "Mocha Lane",
    x: -18,
    side: -1,
    wall: "white_stucco",
    awning: "#7A3B22",
    sign: { bg: "#1E1A17", fg: "#F3E7D3" },
    storefrontPhoto: `${P}/storefront_1.jpg`,
    interiorPhoto: `${P}/interior_1.jpg`,
    offer: "Buy one, get one free",
    products: [
      { id: "p1", name: "Iced latte", price: 2, photo: `${P}/product_1.jpg` },
      { id: "p2", name: "Latte", price: 1.8, photo: `${P}/product_2.jpg` },
    ],
  },
  {
    id: "store_2",
    name: "Bean & Co",
    x: 0,
    side: -1,
    wall: "dark_brick_wall",
    awning: "#2F4A3E",
    sign: { bg: "#F2EEE6", fg: "#1D2A24" },
    storefrontPhoto: `${P}/storefront_2.jpg`,
    interiorPhoto: `${P}/interior_2.jpg`,
    offer: "50% off",
    products: [
      { id: "p3", name: "Iced latte", price: 1, was: 2, photo: `${P}/product_1.jpg` },
      { id: "p4", name: "Latte", price: 0.9, was: 1.8, photo: `${P}/product_2.jpg` },
    ],
  },
  {
    id: "store_3",
    name: "Leaf Brew",
    x: 18,
    side: -1,
    wall: "beige_wall_001",
    awning: "#3C4F6B",
    sign: { bg: "#FFFFFF", fg: "#22313F" },
    storefrontPhoto: `${P}/storefront_3.jpg`,
    interiorPhoto: `${P}/interior_3.jpg`,
    products: [
      { id: "p5", name: "Iced latte", price: 2, photo: `${P}/product_1.jpg` },
      { id: "p6", name: "Latte", price: 1.8, photo: `${P}/product_2.jpg` },
    ],
  },
  {
    id: "store_4",
    name: "Pearl Roasters",
    x: -9,
    side: 1,
    wall: "beige_wall_001",
    awning: "#5B4636",
    sign: { bg: "#2B2B2B", fg: "#EDE6D8" },
    storefrontPhoto: `${P}/storefront_1.jpg`,
    interiorPhoto: `${P}/interior_2.jpg`,
    offer: "1 BHD off",
    products: [
      { id: "p7", name: "Iced latte", price: 1, was: 2, photo: `${P}/product_1.jpg` },
      { id: "p8", name: "Latte", price: 0.8, was: 1.8, photo: `${P}/product_2.jpg` },
    ],
  },
  {
    id: "store_5",
    name: "Saffron House",
    x: 9,
    side: 1,
    wall: "white_stucco",
    awning: "#8A5A12",
    sign: { bg: "#F5EBDD", fg: "#5A3A0C" },
    storefrontPhoto: `${P}/storefront_2.jpg`,
    interiorPhoto: `${P}/interior_3.jpg`,
    products: [
      { id: "p9", name: "Iced latte", price: 2, photo: `${P}/product_1.jpg` },
      { id: "p10", name: "Latte", price: 1.8, photo: `${P}/product_2.jpg` },
    ],
  },
];

/** z of a store's front face for its side of the street. */
export function frontZ(side: -1 | 1) {
  return side * (STREET.width / 2 + STREET.setback);
}

/** Where a participant stands to be "at the door" of a store. */
export function doorPoint(s: VillageStore): [number, number] {
  return [s.x, frontZ(s.side) - s.side * 1.2];
}

export const APPROACH_RADIUS = 3.2;

/** Answer-to-avatar rule: the automatic assignment the researcher configures. */
/**
 * How the participant appears: a realistic person, an abstract circle on the ground ("presence"),
 * or null for a first-person view with nothing shown.
 */
export type AvatarChoice = "Female_Adult_01" | "Male_Adult_01" | "presence" | null;

/**
 * Answer-to-avatar rule set by the researcher. "Prefer not to say" gets the abstract presence,
 * so nobody is given a body or gender they did not state.
 */
export function avatarFor(answer: "woman" | "man" | "none"): AvatarChoice {
  if (answer === "woman") return "Female_Adult_01";
  if (answer === "man") return "Male_Adult_01";
  return "presence";
}
