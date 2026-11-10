import type { Metadata } from "next";
import Link from "next/link";
import { SCENES } from "@/components/env3d/scenes";

export const metadata: Metadata = { title: "Scene library · Tessellum" };

/** The researcher's scene library for the 3D environment module (prototype). */
export default function Page() {
  return (
    <main className="min-h-dvh bg-[#050506] px-4 py-10 text-[#F2F4F5] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#8B9097]">Tessellum · 3D environment module · prototype</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Scene library</h1>
        <p className="mt-3 max-w-2xl text-[#A6ABB2]">
          The background a study runs in. Every scene holds the same stores, offers and products, and records the same events; only the place changes. Open one to walk it as a participant.
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SCENES.map((s, i) => (
            <li key={s.id}>
              <Link
                href={`/prototype/scenes/${s.id}`}
                className="group flex h-full flex-col rounded-2xl border border-[#2A2D33] bg-[#0E0F11] p-5 transition-colors hover:border-[#3A3E45] hover:bg-[#17191D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6A2B]"
              >
                <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-[#8B9097]">
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <span>
                    {s.setting} · {s.time === "night" ? "evening" : "day"}
                  </span>
                </div>
                <h2 className="mt-6 text-xl font-semibold">{s.name}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-[#A6ABB2]">{s.blurb}</p>
                <span className="mt-5 text-sm font-semibold text-[#FF6A2B] group-hover:underline">Walk this scene →</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-[#8B9097]">
          Digital settings (delivery app, search results, video pre-roll) belong to the e-commerce simulator module, not here.
        </p>
      </div>
    </main>
  );
}
