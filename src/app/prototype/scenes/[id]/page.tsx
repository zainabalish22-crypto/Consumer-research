import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EnvironmentPrototype } from "@/components/env3d/EnvironmentPrototype";
import { SCENES, sceneById } from "@/components/env3d/scenes";

export function generateStaticParams() {
  return SCENES.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const scene = sceneById((await params).id);
  return { title: `${scene?.name ?? "Scene"} prototype · Tessellum` };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const scene = sceneById((await params).id);
  if (!scene) notFound();
  return <EnvironmentPrototype key={scene.id} scene={scene} />;
}
