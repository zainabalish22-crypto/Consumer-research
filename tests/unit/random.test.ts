import { describe, expect, it } from "vitest";
import { seededShuffle } from "@/lib/random";

describe("seeded randomisation", () => {
  it("is deterministic for the same seed and a permutation of the input", () => {
    const items = [1, 2, 3, 4, 5, 6];
    const a = seededShuffle(items, "session-a:q1");
    expect(seededShuffle(items, "session-a:q1")).toEqual(a);
    expect([...a].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]); // input untouched
  });

  it("is roughly uniform across many sessions", () => {
    const n = 4;
    const sessions = 20000;
    const firstCounts = new Array(n).fill(0);
    for (let i = 0; i < sessions; i++) {
      firstCounts[seededShuffle([0, 1, 2, 3], `s${i}:q`)[0]]++;
    }
    for (const c of firstCounts) {
      expect(Math.abs(c / sessions - 1 / n)).toBeLessThan(0.02);
    }
  });
});
