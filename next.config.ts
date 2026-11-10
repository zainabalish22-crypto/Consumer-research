import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // A separate output folder lets a production build run next to the dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
