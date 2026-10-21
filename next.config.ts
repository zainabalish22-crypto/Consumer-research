import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Standalone output is for Docker and self-hosting; Vercel builds its own output.
  output: process.env.VERCEL ? undefined : "standalone",
  // Lets a production build run next to `npm run dev` without sharing .next.
  // Next.js then adds the folder to tsconfig.json and next-env.d.ts; do not commit those edits.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default withNextIntl(nextConfig);
