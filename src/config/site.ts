/**
 * Whether the 3D shopping village scenes are published on this deployment. On by default;
 * set NEXT_PUBLIC_SCENES_LIVE=0 to hide the scene links and return "not found" for their pages.
 */
export const SCENES_LIVE = process.env.NEXT_PUBLIC_SCENES_LIVE !== "0";
