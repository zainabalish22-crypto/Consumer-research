"use client";

import dynamic from "next/dynamic";

/** Loads the 3D cube only in the browser; the frame keeps its size meanwhile, so nothing jumps. */
const HeroCube = dynamic(() => import("./HeroCube"), { ssr: false });

export function HeroFigure() {
  return <HeroCube />;
}
