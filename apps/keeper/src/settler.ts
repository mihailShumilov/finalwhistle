import type * as anchor from "@coral-xyz/anchor";
import {
  buildSettleIx,
  buildSettleProof,
  enumKey,
  epochDayForValidation,
  fetchMarket,
  fetchStatValidation,
  type MarketAccount,
  type ResilientSender,
  type TxlineSession,
  txlineDailyScoresPda,
} from "@finalwhistle/sdk";
import type { Finalwhistle } from "@finalwhistle/shared";
import { ComputeBudgetProgram, PublicKey } from "@solana/web3.js";
import type { ResilientRpcPool, SendResult } from "solana-resilience-kit";

/** Settlement transactions raise the CU budget (validate_stat recomputes the Merkle path). */
export const SETTLE_CU_LIMIT = 1_400_000;

export interface SettleDeps {
  pool: ResilientRpcPool;
  sender: ResilientSender;
  program: anchor.Program<Finalwhistle>;
  coder: anchor.BorshAccountsCoder;
  session: TxlineSession;
  txlineProgram: PublicKey;
}

export interface SettleOutcome {
  market: string;
  status: "settled" | "skipped" | "failed";
  outcome?: SendResult["outcome"];
  signature?: string;
  winningSide?: number;
  reason?: string;
}

function statusKey(status: Record<string, unknown>): string {
  return enumKey(status);
}

/**
 * Settle a single market: read its immutable predicate, fetch the matching TxLINE proof, and
 * submit `settle` through the resilient sender. Idempotent at the program level (a resolved
 * market rejects a second settle), and skips markets that aren't open or whose betting window
 * is still running.
 */
export async function settleMarket(
  deps: SettleDeps,
  marketAddress: string,
): Promise<SettleOutcome> {
  const rpc = deps.pool.rpc();
  const market: MarketAccount | null = await fetchMarket(rpc, deps.coder, marketAddress);
  if (!market) return { market: marketAddress, status: "failed", reason: "market not found" };

  const status = statusKey(market.status);
  if (status !== "open") return { market: marketAddress, status: "skipped", reason: status };

  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec < market.closeTs.toNumber()) {
    return { market: marketAddress, status: "skipped", reason: "betting open" };
  }

  // Two-stat settle proofs exceed the legacy 1232-byte tx limit; settling them needs an
  // Address Lookup Table (tracked follow-up). Skip cleanly instead of churning every cron.
  if (market.statKey2 !== null) {
    return { market: marketAddress, status: "skipped", reason: "two-stat settle needs ALT" };
  }

  // Fetch the three-stage proof for this market's exact stat.
  const validation = await fetchStatValidation(deps.session, {
    fixtureId: market.fixtureId.toNumber(),
    seq: market.seq,
    statKey: market.statKey,
    ...(market.statKey2 !== null ? { statKey2: market.statKey2 } : {}),
  });

  const op = market.op
    ? (("add" in market.op ? "add" : "subtract") as "add" | "subtract")
    : undefined;
  const proof = buildSettleProof(validation, op ? { op } : undefined);
  const dailyScoresRoots = txlineDailyScoresPda(
    epochDayForValidation(validation),
    deps.txlineProgram,
  );

  const settleIx = await buildSettleIx(deps.program, {
    settler: new PublicKey(deps.sender.feePayer.address),
    market: new PublicKey(marketAddress),
    usdcMint: market.usdcMint,
    dailyScoresMerkleRoots: dailyScoresRoots,
    txlineProgram: deps.txlineProgram,
    proof,
  });
  const cuIx = ComputeBudgetProgram.setComputeUnitLimit({ units: SETTLE_CU_LIMIT });

  const result = await deps.sender.send([cuIx, settleIx]);
  return {
    market: marketAddress,
    status: result.outcome === "confirmed" ? "settled" : "failed",
    outcome: result.outcome,
    signature: result.signature,
  };
}
