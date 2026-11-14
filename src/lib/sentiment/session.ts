import type { Delimiter, Encoding } from "@/lib/tools/csv";
import type { Sentiment } from "./normalize";

/**
 * The dataset being analysed. It lives only in this page's memory: it is never sent to a
 * server and is gone when the page is reloaded or closed. That is what "not kept after the
 * session" means here. Saving, when it comes, will be an explicit choice.
 */
export type ColumnRole = "text" | "label" | "label2" | "account" | "category" | "language" | "dialect" | "date";
export const COLUMN_ROLES: ColumnRole[] = ["text", "label", "label2", "account", "category", "language", "dialect", "date"];

export type SentimentDataset = {
  fileName: string;
  encoding: Encoding;
  delimiter: Delimiter;
  header: string[];
  rows: string[][];
  badRows: number[];
  emptyRows: number;
  /** Which column plays each role. */
  mapping: Partial<Record<ColumnRole, string>>;
  /** The researcher's own meanings for label spellings the tool did not recognise (folded value → sentiment). */
  custom: [string, Sentiment][];
  /** The researcher's final label for disputed rows: row index → label. Used by results and export. */
  resolved: [number, Sentiment][];
  /** Number of accounts replaced with codes, when anonymising was used. */
  anonymised: number;
};

let current: SentimentDataset | null = null;

export const getDataset = () => current;
export function setDataset(d: SentimentDataset | null) {
  current = d;
}
