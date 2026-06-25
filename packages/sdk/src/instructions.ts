import type * as anchor from "@coral-xyz/anchor";
import type { Finalwhistle } from "@finalwhistle/shared";
import {
  type BinaryOp,
  type Comparison,
  toTxlineComparison,
  toTxlineOp,
} from "@finalwhistle/shared";
import { type PublicKey, SystemProgram, type TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import { escrowPda, marketPda, positionPda, treasuryPda } from "./program.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, ata, TOKEN_PROGRAM_ID } from "./tokens.js";
import type { buildSettleProof } from "./txline.js";

type Program = anchor.Program<Finalwhistle>;

export interface CreateMarketArgs {
  creator: PublicKey;
  usdcMint: PublicKey;
  nonce: bigint;
  fixtureId: number;
  seq: number;
  statKey: number;
  statKey2?: number;
  op?: BinaryOp;
  period: number;
  threshold: number;
  comparison: Comparison;
  closeTs: number;
  feeBps: number;
  title: string;
  tokenProgram?: PublicKey;
}

export async function buildCreateMarketIx(
  program: Program,
  a: CreateMarketArgs,
): Promise<TransactionInstruction> {
  const tokenProgram = a.tokenProgram ?? TOKEN_PROGRAM_ID;
  const market = marketPda(a.creator, a.nonce);
  return program.methods
    .createMarket(new BN(a.nonce.toString()), {
      fixtureId: new BN(a.fixtureId),
      seq: a.seq,
      statKey: a.statKey,
      statKey2: a.statKey2 ?? null,
      op: a.op ? (toTxlineOp(a.op) as never) : null,
      period: a.period,
      threshold: a.threshold,
      comparison: toTxlineComparison(a.comparison) as never,
      closeTs: new BN(a.closeTs),
      feeBps: a.feeBps,
      title: a.title,
    })
    .accountsPartial({
      creator: a.creator,
      usdcMint: a.usdcMint,
      market,
      escrow: escrowPda(market),
      tokenProgram,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export interface PlacePositionArgs {
  bettor: PublicKey;
  market: PublicKey;
  usdcMint: PublicKey;
  side: "YES" | "NO";
  amount: bigint;
  tokenProgram?: PublicKey;
}

export async function buildPlacePositionIx(
  program: Program,
  a: PlacePositionArgs,
): Promise<TransactionInstruction> {
  const tokenProgram = a.tokenProgram ?? TOKEN_PROGRAM_ID;
  return program.methods
    .placePosition(a.side === "YES" ? 1 : 2, new BN(a.amount.toString()))
    .accountsPartial({
      bettor: a.bettor,
      market: a.market,
      position: positionPda(a.market, a.bettor),
      bettorUsdc: ata(a.usdcMint, a.bettor, tokenProgram, false),
      escrow: escrowPda(a.market),
      usdcMint: a.usdcMint,
      tokenProgram,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export interface SettleArgs {
  settler: PublicKey;
  market: PublicKey;
  usdcMint: PublicKey;
  dailyScoresMerkleRoots: PublicKey;
  txlineProgram: PublicKey;
  proof: ReturnType<typeof buildSettleProof>;
  tokenProgram?: PublicKey;
}

export async function buildSettleIx(
  program: Program,
  a: SettleArgs,
): Promise<TransactionInstruction> {
  const tokenProgram = a.tokenProgram ?? TOKEN_PROGRAM_ID;
  const treasury = treasuryPda();
  return program.methods
    .settle(a.proof as never)
    .accountsPartial({
      settler: a.settler,
      market: a.market,
      escrow: escrowPda(a.market),
      dailyScoresMerkleRoots: a.dailyScoresMerkleRoots,
      txlineProgram: a.txlineProgram,
      treasury,
      treasuryUsdc: ata(a.usdcMint, treasury, tokenProgram, true),
      usdcMint: a.usdcMint,
      tokenProgram,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export interface ClaimArgs {
  claimant: PublicKey;
  market: PublicKey;
  owner: PublicKey;
  usdcMint: PublicKey;
  tokenProgram?: PublicKey;
}

export async function buildClaimIx(
  program: Program,
  a: ClaimArgs,
): Promise<TransactionInstruction> {
  const tokenProgram = a.tokenProgram ?? TOKEN_PROGRAM_ID;
  return program.methods
    .claim()
    .accountsPartial({
      claimant: a.claimant,
      market: a.market,
      position: positionPda(a.market, a.owner),
      owner: a.owner,
      escrow: escrowPda(a.market),
      claimantUsdc: ata(a.usdcMint, a.claimant, tokenProgram, false),
      usdcMint: a.usdcMint,
      tokenProgram,
    })
    .instruction();
}

export async function buildVoidMarketIx(
  program: Program,
  authority: PublicKey,
  market: PublicKey,
): Promise<TransactionInstruction> {
  return program.methods.voidMarket().accountsPartial({ authority, market }).instruction();
}
