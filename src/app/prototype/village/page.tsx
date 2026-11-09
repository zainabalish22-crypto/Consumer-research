import type { Metadata } from "next";
import { VillagePrototype } from "@/components/env3d/VillagePrototype";

export const metadata: Metadata = { title: "Garden village prototype · Tessellum" };

export default function Page() {
  return <VillagePrototype />;
}
