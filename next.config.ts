import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A separate output folder lets a production build run next to the dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
