import * as anchor from "@coral-xyz/anchor";
import { FINALWHISTLE_IDL, type Finalwhistle } from "@finalwhistle/shared";
import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

/**
 * The FinalWhistle Anchor program is used here purely as an **offline instruction coder** —
 * `.instruction()` never touches the network. Every RPC read and transaction send goes
 * through `solana-resilience-kit` (see `rpc.ts` / `sender.ts`). The dummy connection exists
 * only because the Anchor `Program` constructor requires one; it is never read through.
 */
export function createProgram(): anchor.Program<Finalwhistle> {
  const connection = new Connection("http://localhost:9999", "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    { publicKey: PublicKey.default } as unknown as anchor.Wallet,
    { commitment: "confirmed" },
  );
  return new anchor.Program<Finalwhistle>(FINALWHISTLE_IDL, provider);
}

export const FINALWHISTLE_PROGRAM = new PublicKey(FINALWHISTLE_IDL.address);

export const MARKET_SEED = Buffer.from("market");
export const ESCROW_SEED = Buffer.from("escrow");
export const POSITION_SEED = Buffer.from("position");
export const TREASURY_SEED = Buffer.from("treasury");
export const TXLINE_DAILY_SCORES_SEED = Buffer.from("daily_scores_roots");

export function marketPda(creator: PublicKey, nonce: bigint, programId = FINALWHISTLE_PROGRAM) {
  return PublicKey.findProgramAddressSync(
    [MARKET_SEED, creator.toBuffer(), new BN(nonce.toString()).toArrayLike(Buffer, "le", 8)],
    programId,
  )[0];
}

export function escrowPda(market: PublicKey, programId = FINALWHISTLE_PROGRAM) {
  return PublicKey.findProgramAddressSync([ESCROW_SEED, market.toBuffer()], programId)[0];
}

export function positionPda(market: PublicKey, owner: PublicKey, programId = FINALWHISTLE_PROGRAM) {
  return PublicKey.findProgramAddressSync(
    [POSITION_SEED, market.toBuffer(), owner.toBuffer()],
    programId,
  )[0];
}

export function treasuryPda(programId = FINALWHISTLE_PROGRAM) {
  return PublicKey.findProgramAddressSync([TREASURY_SEED], programId)[0];
}

/** The TxLINE daily-scores-roots PDA for a given epoch day (seed: u16 little-endian). */
export function txlineDailyScoresPda(epochDay: number, txlineProgram: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [TXLINE_DAILY_SCORES_SEED, new BN(epochDay).toArrayLike(Buffer, "le", 2)],
    txlineProgram,
  )[0];
}
