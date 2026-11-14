/**
 * Statistics used by the sentiment tool: the chi-square test of independence with Cramér's V.
 * Plain implementations of standard formulas, checked against published table values.
 */

/** Natural log of the gamma function (Lanczos approximation). */
function logGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.001208650973866179, -0.000005395239384953];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const v of c) ser += v / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Regularised upper incomplete gamma function Q(a, x). */
function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  if (x < a + 1) {
    // Series for P(a, x); Q = 1 - P.
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n < 500; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  // Continued fraction for Q(a, x) (modified Lentz).
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** Probability of a chi-square value at least this large, by chance alone. */
export const chiSquareP = (chi2: number, df: number) => (df <= 0 ? 1 : gammaQ(df / 2, chi2 / 2));

export type ChiSquare = {
  chi2: number;
  df: number;
  p: number;
  /** Effect size from 0 (no association) to 1. */
  cramersV: number;
  n: number;
  /** Share of cells with an expected count below 5; above 20% the test is unreliable. */
  lowExpected: number;
};

/**
 * Chi-square test of independence on a table of counts (rows = groups, columns = categories).
 * Rows and columns that are entirely zero are dropped. Returns null when fewer than two rows
 * or two columns remain, because then there is nothing to compare.
 */
export function chiSquare(table: number[][]): ChiSquare | null {
  const rows = table.filter((r) => r.some((v) => v > 0));
  if (rows.length < 2) return null;
  const keep = rows[0].map((_, j) => rows.some((r) => r[j] > 0));
  const t = rows.map((r) => r.filter((_, j) => keep[j]));
  const cols = t[0].length;
  if (cols < 2) return null;
  const rowSum = t.map((r) => r.reduce((a, b) => a + b, 0));
  const colSum = t[0].map((_, j) => t.reduce((a, r) => a + r[j], 0));
  const n = rowSum.reduce((a, b) => a + b, 0);
  let chi2 = 0;
  let low = 0;
  for (let i = 0; i < t.length; i++)
    for (let j = 0; j < cols; j++) {
      const e = (rowSum[i] * colSum[j]) / n;
      if (e < 5) low++;
      chi2 += (t[i][j] - e) ** 2 / e;
    }
  const df = (t.length - 1) * (cols - 1);
  return { chi2, df, p: chiSquareP(chi2, df), cramersV: Math.sqrt(chi2 / (n * Math.min(t.length - 1, cols - 1))), n, lowExpected: low / (t.length * cols) };
}
