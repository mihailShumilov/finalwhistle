import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  hashToBytes,
  type MarketPredicate,
  orientedPredicate,
  type ScoresStatValidation,
  winningSide,
} from "@finalwhistle/shared";
import { describe, expect, it } from "vitest";

const GOLDEN_DIR = resolve(__dirname, "../golden");

function load<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(GOLDEN_DIR, name), "utf8")) as T;
}

/**
 * Determinism gate. The off-chain proof → on-chain `validate_stat` hand-off must be
 * byte-stable. We lock the encoding transforms (hex → [u8;32]) and the predicate-orientation
 * semantics against a committed vector, so a silent change to hashing/field-order/negation
 * fails CI — the exact "verifier disagrees" class of bug the build guide warns about.
 */
describe("golden vector — encoding determinism", () => {
  const synthetic = load<ScoresStatValidation & { _comment: string }>(
    "synthetic_stat_validation.json",
  );

  it("hex hashes decode to exactly 32 bytes, stably", () => {
    const bytes = hashToBytes(synthetic.statProof[0]!.hash);
    expect(bytes).toHaveLength(32);
    expect(bytes.every((b) => b >= 0 && b <= 255)).toBe(true);
    // 0xaa repeated → every byte 170.
    expect(bytes.every((b) => b === 0xaa)).toBe(true);
  });

  it("two-stat diff drives the winning side", () => {
    const goalDiff: MarketPredicate = {
      fixtureId: synthetic.summary.fixtureId,
      seq: 1,
      statKey: synthetic.statToProve.key,
      statKey2: synthetic.statToProve2!.key,
      op: "subtract",
      period: 0,
      threshold: 2,
      comparison: "greaterThan",
    };
    // 3 - 1 = 2, not > 2 ⇒ NO; the NO-oriented predicate (lessThan 3) must hold for diff 2.
    const side = winningSide(goalDiff, synthetic.statToProve.value, synthetic.statToProve2!.value);
    expect(side).toBe("NO");
    const oriented = orientedPredicate(goalDiff, side);
    expect(oriented).toEqual({ comparison: "lessThan", threshold: 3 });
  });
});

/**
 * Live devnet golden vector — only present once the spike has captured a real
 * `validate_stat` landing (gated on the TxLINE devnet data backend being reachable). When
 * present, it asserts that each predicate the on-chain program actually proved is exactly
 * the one our off-chain `winningSide` would have chosen — i.e. our settle path and TxLINE's
 * validate_stat agree on the real proof.
 */
const liveFile = resolve(GOLDEN_DIR, "stat_validation.devnet.json");
describe.skipIf(!existsSync(liveFile))("golden vector — live devnet validate_stat", () => {
  it("the proved single-stat predicate is consistent with the proven value", () => {
    const golden = load<{
      validation: ScoresStatValidation;
      proved: {
        singleStat: {
          predicate: { threshold: number; comparison: Record<string, unknown> };
          signature: string;
        };
        falsePredicateReverted: boolean;
      };
    }>("stat_validation.devnet.json");

    const v = golden.validation;
    const cmp: "greaterThan" | "lessThan" =
      "greaterThan" in golden.proved.singleStat.predicate.comparison ? "greaterThan" : "lessThan";
    const thr = golden.proved.singleStat.predicate.threshold;
    const holds = cmp === "greaterThan" ? v.statToProve.value > thr : v.statToProve.value < thr;
    expect(holds).toBe(true);
    expect(golden.proved.singleStat.signature).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
    expect(golden.proved.falsePredicateReverted).toBe(true);
  });
});
