/**
 * Agreement between two coders on nominal labels: Krippendorff's alpha and simple percentage
 * agreement. Alpha corrects for the agreement expected by chance: 1 is perfect agreement, 0 is
 * what chance alone gives, and negative values mean the coders disagree more than chance.
 */
import type { Sentiment } from "./normalize.ts";

const CATS: Sentiment[] = ["positive", "neutral", "negative"];

export type Agreement = {
  /** Units where both coders gave a label. */
  pairs: number;
  /** Units where the labels match. */
  matches: number;
  percent: number;
  alpha: number | null;
  /** Units where the coders disagree. */
  disagreements: number[];
};

/** Alpha from pairs of labels (one pair per unit), using the coincidence matrix. */
export function krippendorffNominal(pairs: [Sentiment, Sentiment][]): number | null {
  const o: Record<Sentiment, Record<Sentiment, number>> = {
    positive: { positive: 0, neutral: 0, negative: 0 },
    neutral: { positive: 0, neutral: 0, negative: 0 },
    negative: { positive: 0, neutral: 0, negative: 0 },
  };
  // Each unit has two values, so each contributes one pair in each order.
  for (const [a, b] of pairs) {
    o[a][b] += 1;
    o[b][a] += 1;
  }
  const n = pairs.length * 2;
  if (n < 2) return null;
  const nc = Object.fromEntries(CATS.map((c) => [c, CATS.reduce((s, k) => s + o[c][k], 0)])) as Record<Sentiment, number>;
  let observed = 0;
  let expected = 0;
  for (const c of CATS)
    for (const k of CATS) {
      if (c === k) continue;
      observed += o[c][k];
      expected += nc[c] * nc[k];
    }
  // Every label is the same category: alpha is undefined (no variation to explain).
  if (expected === 0) return null;
  return 1 - ((n - 1) * observed) / expected;
}

/** Agreement for two label columns, row by row. `pairs` are (first, second) labels per row. */
export function agreement(rows: { index: number; a: Sentiment | null; b: Sentiment | null }[]): Agreement {
  const both = rows.filter((r): r is { index: number; a: Sentiment; b: Sentiment } => r.a !== null && r.b !== null);
  const matches = both.filter((r) => r.a === r.b).length;
  return {
    pairs: both.length,
    matches,
    percent: both.length ? (matches / both.length) * 100 : 0,
    alpha: krippendorffNominal(both.map((r) => [r.a, r.b] as [Sentiment, Sentiment])),
    disagreements: both.filter((r) => r.a !== r.b).map((r) => r.index),
  };
}

/** A plain reading of alpha, for the researcher. Cut-offs follow common practice; they are a guide. */
export function readAlpha(alpha: number | null): "none" | "poor" | "fair" | "good" | "strong" {
  if (alpha === null) return "none";
  if (alpha < 0.4) return "poor";
  if (alpha < 0.667) return "fair";
  if (alpha < 0.8) return "good";
  return "strong";
}
