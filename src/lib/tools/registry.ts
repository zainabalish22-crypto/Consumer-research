/**
 * The platform's tools. Each one works on its own; a researcher may combine them in a study.
 * Analysis tools follow the same four steps (about, upload, results, export) and share one
 * page template, so adding a tool means adding an entry here plus its own logic.
 */
export const ANALYSIS_TOOLS = ["sentiment", "network"] as const;
export type AnalysisTool = (typeof ANALYSIS_TOOLS)[number];

export const STEPS = ["home", "upload", "results", "export"] as const;
export type Step = (typeof STEPS)[number];

/** Message keys for each analysis tool's "about" page. */
export const TOOL_COPY: Record<AnalysisTool, { need: string[]; get: string[]; limits: string[]; disclaimer?: string }> = {
  network: { need: ["need1", "need4", "need2", "need3"], get: ["get1", "get2", "get3", "get4", "get5"], limits: ["limit1", "limit2"] },
  sentiment: { need: ["need1", "need2", "need3"], get: ["get1", "get2", "get3", "get5", "get6", "get4"], limits: ["limit1", "limit2"], disclaimer: "disclaimer" },
};

/** Study tools already on the platform, with where each one opens. */
export const STUDY_TOOLS = [
  { id: "village", href: "/prototype/scenes", localized: false },
  { id: "shop", href: "/studio?module=shop", localized: true },
  { id: "forms", href: "/studio?module=form", localized: true },
] as const;

export const isAnalysisTool = (v: string): v is AnalysisTool => (ANALYSIS_TOOLS as readonly string[]).includes(v);
export const isStep = (v: string): v is Step => (STEPS as readonly string[]).includes(v);

/** Path of a step inside a tool ("home" is the tool's own page). */
export const stepPath = (tool: AnalysisTool, step: Step) => (step === "home" ? `/tools/${tool}` : `/tools/${tool}/${step}`);
