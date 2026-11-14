/**
 * Import presets. A preset only says what kind of file the researcher is bringing; the column
 * matches are the same guesses for each, and the researcher always sees and can change them.
 * The column names of 4CAT and Communalytic exports are not yet confirmed against real files,
 * so that preset says so until a sample export has been checked.
 */
export const PRESET_IDS = ["edgeList", "gephi", "exportTool"] as const;
export type PresetId = (typeof PRESET_IDS)[number];

const GUESS = {
  source: ["source", "from", "node_a", "node1", "sender", "src"],
  target: ["target", "to", "node_b", "node2", "receiver", "dst"],
  weight: ["weight", "count", "value", "strength", "frequency"],
};

/** The first header that matches one of the candidate names, ignoring case, spaces, _ and -. */
export function guessColumn(header: string[], names: string[]): string | undefined {
  const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, "");
  for (const n of names) {
    const hit = header.find((h) => norm(h) === norm(n));
    if (hit) return hit;
  }
  return undefined;
}

export function guessMapping(header: string[]): { source?: string; target?: string; weight?: string } {
  return {
    source: guessColumn(header, GUESS.source),
    target: guessColumn(header, GUESS.target),
    weight: guessColumn(header, GUESS.weight),
  };
}
