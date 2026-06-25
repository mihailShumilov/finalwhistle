/**
 * The FinalWhistle predicate model — a TypeScript mirror of the on-chain Rust types in
 * `programs/finalwhistle/src/state.rs`. A market is an immutable predicate:
 *
 *   YES holds  ⇔  (statA [op statB]) <comparison> threshold
 *
 * `EqualTo` is deliberately unsupported: a two-sided market needs a negatable predicate so
 * the losing side can also be proven on-chain, and `!=` is not a single comparison.
 */

export type Side = "YES" | "NO";

/** Comparison operators (subset of TxLINE's `Comparison`). */
export type Comparison = "greaterThan" | "lessThan";

/** Binary operators for two-stat predicates (mirrors TxLINE's `BinaryExpression`). */
export type BinaryOp = "add" | "subtract";

export interface MarketPredicate {
  fixtureId: number;
  seq: number;
  statKey: number;
  /** Optional second stat key (two-stat market). */
  statKey2?: number;
  /** Optional binary operator (required iff `statKey2` is set). */
  op?: BinaryOp;
  /** Period the stat(s) are measured at. */
  period: number;
  threshold: number;
  comparison: Comparison;
}

/** Side discriminants matching the on-chain `SIDE_*` constants. */
export const SIDE_YES = 1;
export const SIDE_NO = 2;
export const SIDE_NONE = 0;

export function sideToU8(side: Side): number {
  return side === "YES" ? SIDE_YES : SIDE_NO;
}

export function u8ToSide(value: number): Side {
  if (value === SIDE_YES) return "YES";
  if (value === SIDE_NO) return "NO";
  throw new Error(`Not a resolved side: ${value}`);
}

/** Combine two stat values under a binary operator. */
export function combineStats(statA: number, statB: number, op: BinaryOp): number {
  return op === "add" ? statA + statB : statA - statB;
}

/** The effective left-hand value of the predicate (single- or two-stat). */
export function predicateValue(
  predicate: Pick<MarketPredicate, "op">,
  statA: number,
  statB?: number,
): number {
  if (predicate.op !== undefined) {
    if (statB === undefined) {
      throw new Error("Two-stat predicate requires statB");
    }
    return combineStats(statA, statB, predicate.op);
  }
  return statA;
}

/** Evaluate whether the YES predicate holds given the actual stat value(s). */
export function evaluateYes(predicate: MarketPredicate, statA: number, statB?: number): boolean {
  const value = predicateValue(predicate, statA, statB);
  return predicate.comparison === "greaterThan"
    ? value > predicate.threshold
    : value < predicate.threshold;
}

/** Which side actually won, given the proven stat value(s). */
export function winningSide(predicate: MarketPredicate, statA: number, statB?: number): Side {
  return evaluateYes(predicate, statA, statB) ? "YES" : "NO";
}

/**
 * Orient `(comparison, threshold)` to prove that `side` is the TRUE outcome. YES is the
 * stored predicate; NO is its exact integer negation:
 *   greaterThan(T) ⇒ NO is lessThan(T + 1);  lessThan(T) ⇒ NO is greaterThan(T - 1).
 *
 * This mirrors `Market::oriented_predicate` on-chain exactly.
 */
export function orientedPredicate(
  predicate: MarketPredicate,
  side: Side,
): { comparison: Comparison; threshold: number } {
  if (side === "YES") {
    return { comparison: predicate.comparison, threshold: predicate.threshold };
  }
  return predicate.comparison === "greaterThan"
    ? { comparison: "lessThan", threshold: predicate.threshold + 1 }
    : { comparison: "greaterThan", threshold: predicate.threshold - 1 };
}

/** Map a comparison to the TxLINE IDL enum shape `{ greaterThan: {} }`. */
export function toTxlineComparison(comparison: Comparison): Record<string, Record<string, never>> {
  return comparison === "greaterThan" ? { greaterThan: {} } : { lessThan: {} };
}

/** Map a binary op to the TxLINE IDL enum shape `{ subtract: {} }`. */
export function toTxlineOp(op: BinaryOp): Record<string, Record<string, never>> {
  return op === "add" ? { add: {} } : { subtract: {} };
}

export function isTwoStat(predicate: Pick<MarketPredicate, "statKey2" | "op">): boolean {
  return predicate.statKey2 !== undefined && predicate.op !== undefined;
}
