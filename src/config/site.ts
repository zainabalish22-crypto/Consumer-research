/**
 * Whether the 3D shopping village scenes are published on this deployment. Their 3D files are
 * not on the live site yet, so links to them are hidden and their pages return "not found"
 * unless NEXT_PUBLIC_SCENES_LIVE=1 (set in .env.local for local work).
 */
export const SCENES_LIVE = process.env.NEXT_PUBLIC_SCENES_LIVE === "1";
