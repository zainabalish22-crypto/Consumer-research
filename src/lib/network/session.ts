import type { Delimiter, Encoding } from "@/lib/tools/csv";
import type { PresetId } from "./presets";
import type { BuildReport, Graph } from "./graph";

/**
 * The network being analysed. Like the sentiment dataset it lives only in this page's memory;
 * it is never sent to a server and is gone when the page is reloaded or closed.
 */
export type NetworkDataset = {
  fileName: string;
  preset: PresetId;
  kind: "table" | "xml";
  /** Table files: how the text was read, and the cells. */
  encoding?: Encoding;
  delimiter?: Delimiter;
  header: string[];
  rows: string[][];
  badRows: number[];
  emptyRows: number;
  /** Table files: which column is the source, target and weight. */
  mapping: { source?: string; target?: string; weight?: string };
  /** Table files: whether each tie has a direction. */
  directed: boolean;
  /** GEXF and GraphML files: the graph read from the file, with its own report. */
  xml?: { graph: Graph; report: BuildReport };
};

let current: NetworkDataset | null = null;

export const getNetwork = () => current;
export function setNetwork(d: NetworkDataset | null) {
  current = d;
}
