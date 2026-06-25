import { describePredicate, type MarketPredicate, winningSide } from "@finalwhistle/shared";
import { describe, expect, it } from "vitest";

// Sanity that the shared predicate model is wired across the workspace. The TxLINE
// on-chain golden-vector tests live alongside this file once Phase 1 captures them.
describe("workspace smoke", () => {
  it("shared predicate model is importable and consistent", () => {
    const p: MarketPredicate = {
      fixtureId: 17271370,
      seq: 401,
      statKey: 1,
      statKey2: 2,
      op: "subtract",
      period: 0,
      threshold: 0,
      comparison: "greaterThan",
    };
    expect(describePredicate(p)).toBe("P1 Goals − P2 Goals > 0");
    expect(winningSide(p, 2, 1)).toBe("YES");
    expect(winningSide(p, 1, 1)).toBe("NO");
  });
});
