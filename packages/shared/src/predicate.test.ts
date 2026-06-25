import { describe, expect, it } from "vitest";
import { describePredicate, impliedYesProbability, parseUsdc } from "./format.js";
import { evaluateYes, type MarketPredicate, orientedPredicate, winningSide } from "./predicate.js";

const corners: MarketPredicate = {
  fixtureId: 1,
  seq: 1,
  statKey: 7,
  period: 0,
  threshold: 10,
  comparison: "greaterThan",
};

const goalDiff: MarketPredicate = {
  fixtureId: 1,
  seq: 1,
  statKey: 1,
  statKey2: 2,
  op: "subtract",
  period: 0,
  threshold: 2,
  comparison: "greaterThan",
};

describe("predicate evaluation", () => {
  it("single-stat YES when value exceeds threshold", () => {
    expect(evaluateYes(corners, 13)).toBe(true);
    expect(evaluateYes(corners, 10)).toBe(false); // strict >
    expect(winningSide(corners, 8)).toBe("NO");
  });

  it("two-stat combines under the operator", () => {
    expect(evaluateYes(goalDiff, 3, 0)).toBe(true); // 3 - 0 = 3 > 2
    expect(evaluateYes(goalDiff, 2, 1)).toBe(false); // 2 - 1 = 1 < 2
    expect(winningSide(goalDiff, 5, 1)).toBe("YES"); // 4 > 2
  });
});

describe("predicate negation (oriented)", () => {
  it("YES is the stored predicate", () => {
    expect(orientedPredicate(corners, "YES")).toEqual({
      comparison: "greaterThan",
      threshold: 10,
    });
  });

  it("NO of greaterThan(T) is lessThan(T+1)", () => {
    expect(orientedPredicate(corners, "NO")).toEqual({
      comparison: "lessThan",
      threshold: 11,
    });
  });

  it("NO of lessThan(T) is greaterThan(T-1)", () => {
    const p: MarketPredicate = { ...corners, comparison: "lessThan", threshold: 3 };
    expect(orientedPredicate(p, "NO")).toEqual({ comparison: "greaterThan", threshold: 2 });
  });

  it("the oriented winning side's predicate always holds for the true value", () => {
    for (const v of [0, 3, 9, 10, 11, 25]) {
      const side = winningSide(corners, v);
      const oriented = orientedPredicate(corners, side);
      const holds =
        oriented.comparison === "greaterThan" ? v > oriented.threshold : v < oriented.threshold;
      expect(holds).toBe(true);
    }
  });
});

describe("formatting", () => {
  it("describes predicates", () => {
    expect(describePredicate(corners)).toBe("P1 Corners > 10");
    expect(describePredicate(goalDiff)).toBe("P1 Goals − P2 Goals > 2");
  });

  it("parses USDC and implied probability", () => {
    expect(parseUsdc("1.5")).toBe(1_500_000n);
    expect(impliedYesProbability(0n, 0n)).toBe(0.5);
    expect(impliedYesProbability(300n, 100n)).toBe(0.75);
  });
});
