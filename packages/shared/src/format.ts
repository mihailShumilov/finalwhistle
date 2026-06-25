import type { MarketPredicate } from "./predicate.js";
import { isTwoStat } from "./predicate.js";
import { statLabel } from "./txline.js";

const CMP_SYMBOL: Record<MarketPredicate["comparison"], string> = {
  greaterThan: ">",
  lessThan: "<",
};

const OP_SYMBOL: Record<NonNullable<MarketPredicate["op"]>, string> = {
  add: "+",
  subtract: "−",
};

/** A compact human-readable rendering of a predicate, e.g. `P1 Goals − P2 Goals > 1`. */
export function describePredicate(predicate: MarketPredicate): string {
  const left = isTwoStat(predicate)
    ? `${statLabel(predicate.statKey)} ${OP_SYMBOL[predicate.op!]} ${statLabel(predicate.statKey2!)}`
    : statLabel(predicate.statKey);
  return `${left} ${CMP_SYMBOL[predicate.comparison]} ${predicate.threshold}`;
}

/** Convert USDC base units (6 decimals) to a display string. */
export function formatUsdc(baseUnits: bigint | number, decimals = 6): string {
  const v = typeof baseUnits === "bigint" ? baseUnits : BigInt(Math.trunc(baseUnits));
  const denom = 10n ** BigInt(decimals);
  const whole = v / denom;
  const frac = (v % denom).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac.length > 0 ? `${whole}.${frac}` : `${whole}`;
}

/** Parse a USDC display string into base units. */
export function parseUsdc(amount: string, decimals = 6): bigint {
  const [whole, frac = ""] = amount.trim().split(".");
  const fracPadded = frac.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}

/**
 * Parimutuel implied probability of YES = `yesPool / (yesPool + noPool)` — the fraction of
 * money staked on YES, which is exactly the probability the book assigns to that outcome.
 * Returns 0.5 for an empty book.
 */
export function impliedYesProbability(yesPool: bigint, noPool: bigint): number {
  const total = yesPool + noPool;
  if (total === 0n) return 0.5;
  return Number(yesPool) / Number(total);
}
