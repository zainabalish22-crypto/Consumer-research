import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SCENES_LIVE } from "@/config/site";
import { fontVars } from "../fonts";
import "../globals.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Prototypes sit outside the language routing; their own text is English for now. */
export default function PrototypeLayout({ children }: { children: React.ReactNode }) {
  // The 3D files are not on the live site yet (see src/config/site.ts).
  if (!SCENES_LIVE) notFound();
  return (
    <html lang="en" className={fontVars}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
