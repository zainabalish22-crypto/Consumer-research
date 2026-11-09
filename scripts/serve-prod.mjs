// Builds and serves a production version on port 3001, next to the dev server on 3000.
// Production builds run much faster than `next dev`, so performance is judged here.
import { spawnSync, spawn } from "node:child_process";

const env = { ...process.env, NEXT_DIST_DIR: ".next-prod", NEXT_TELEMETRY_DISABLED: "1" };
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const build = spawnSync(npx, ["next", "build"], { env, stdio: "inherit", shell: process.platform === "win32" });
if (build.status !== 0) process.exit(build.status ?? 1);
spawn(npx, ["next", "start", "-p", "3001"], { env, stdio: "inherit", shell: process.platform === "win32" });
