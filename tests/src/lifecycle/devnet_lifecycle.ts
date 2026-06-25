import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as anchor from "@coral-xyz/anchor";
import { hashToBytes, type ScoresStatValidation } from "@finalwhistle/shared";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { ComputeBudgetProgram, PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import fwIdl from "../../../idl/finalwhistle.json" with { type: "json" };
import type { Finalwhistle } from "../../../idl/finalwhistle.ts";
import { loadKeeperKeypair, RPC_URL, TXLINE_DEVNET_PROGRAM_ID } from "../spike/config.ts";

/**
 * Phase-2 gate: the full create → place → settle → claim lifecycle against the DEPLOYED
 * devnet program, settling with the real golden-vector proof (so validate_stat actually
 * resolves the winner). Uses @coral-xyz/anchor like the spike; the production SDK is kit-based.
 */

const CU_LIMIT = 1_400_000;
const toProof = (nodes: { hash: string | number[]; isRightSibling: boolean }[]) =>
  nodes.map((n) => ({ hash: hashToBytes(n.hash), isRightSibling: n.isRightSibling }));

async function main(): Promise<void> {
  const keypair = loadKeeperKeypair();
  const connection = new anchor.web3.Connection(RPC_URL, "confirmed");
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const program = new anchor.Program<Finalwhistle>(fwIdl as Finalwhistle, provider);
  const me = wallet.publicKey;
  console.log(`▶ program ${program.programId.toBase58()}  wallet ${me.toBase58()}`);

  // 1. Devnet USDC: a fresh 6-decimal mint we control, minting 1000 to ourselves.
  const usdcMint = await createMint(
    connection,
    keypair,
    me,
    null,
    6,
    undefined,
    undefined,
    TOKEN_PROGRAM_ID,
  );
  const myUsdc = await getOrCreateAssociatedTokenAccount(connection, keypair, usdcMint, me);
  await mintTo(connection, keypair, usdcMint, myUsdc.address, keypair, 1_000_000_000n);
  console.log(`✓ USDC mint ${usdcMint.toBase58()} (minted 1000 to self)`);

  // 2. Load the golden-vector proof and build a market that matches it.
  const golden = JSON.parse(
    readFileSync(resolve(process.cwd(), "golden/stat_validation.devnet.json"), "utf8"),
  ) as { canonicalTs: number; validation: ScoresStatValidation; target: { seq: number } };
  const v = golden.validation;
  const stat = v.statToProve;
  const nonce = new BN(Date.now());
  const now = Math.floor(Date.now() / 1000);
  const closeTs = now + 25; // brief betting window, then settle (fixture is already final)
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const [market] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), me.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
    program.programId,
  );
  const [escrow] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), market.toBuffer()],
    program.programId,
  );

  // Market predicate: "P1 Goals > 0" — with P1 goals = 1 the YES side must win.
  await program.methods
    .createMarket(nonce, {
      fixtureId: new BN(v.summary.fixtureId),
      seq: golden.target.seq,
      statKey: stat.key,
      statKey2: null,
      op: null,
      period: stat.period,
      threshold: 0,
      comparison: { greaterThan: {} },
      closeTs: new BN(closeTs),
      feeBps: 200,
      title: "P1 Goals > 0",
    })
    .accountsPartial({
      creator: me,
      usdcMint,
      market,
      escrow,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log(`✓ market created ${market.toBase58()} (P1 Goals > 0)`);

  // 3. Stake 2 USDC YES and 1 USDC NO (same wallet on both sides for the demo).
  const [position] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), market.toBuffer(), me.toBuffer()],
    program.programId,
  );
  const placeAccounts = {
    bettor: me,
    market,
    position,
    bettorUsdc: myUsdc.address,
    escrow,
    usdcMint,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  };
  await program.methods.placePosition(1, new BN(2_000_000)).accountsPartial(placeAccounts).rpc();
  await program.methods.placePosition(2, new BN(1_000_000)).accountsPartial(placeAccounts).rpc();
  console.log("✓ staked 2 USDC YES + 1 USDC NO");

  // Wait for the betting window to close (settle requires now >= close_ts).
  const waitMs = (closeTs - Math.floor(Date.now() / 1000) + 2) * 1000;
  if (waitMs > 0) {
    console.log(`… waiting ${Math.ceil(waitMs / 1000)}s for betting to close`);
    await sleep(waitMs);
  }

  // 4. Settle using the real proof → CPI into validate_stat resolves the winner.
  const txlineProgram = new PublicKey(TXLINE_DEVNET_PROGRAM_ID);
  const epochDay = Math.floor(golden.canonicalTs / (24 * 60 * 60 * 1000));
  const [dailyScoresRoots] = PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), new BN(epochDay).toArrayLike(Buffer, "le", 2)],
    txlineProgram,
  );
  const [treasury] = PublicKey.findProgramAddressSync([Buffer.from("treasury")], program.programId);
  const treasuryUsdc = getAssociatedTokenAddressSync(usdcMint, treasury, true, TOKEN_PROGRAM_ID);

  const settleSig = await program.methods
    .settle({
      ts: new BN(golden.canonicalTs),
      fixtureSummary: {
        fixtureId: new BN(v.summary.fixtureId),
        updateStats: {
          updateCount: v.summary.updateStats.updateCount,
          minTimestamp: new BN(v.summary.updateStats.minTimestamp),
          maxTimestamp: new BN(v.summary.updateStats.maxTimestamp),
        },
        eventsSubTreeRoot: hashToBytes(v.summary.eventStatsSubTreeRoot),
      },
      fixtureProof: toProof(v.subTreeProof),
      mainTreeProof: toProof(v.mainTreeProof),
      statA: {
        statToProve: { key: stat.key, value: stat.value, period: stat.period },
        eventStatRoot: hashToBytes(v.eventStatRoot),
        statProof: toProof(v.statProof),
      },
      statB: null,
      op: null,
    })
    .accountsPartial({
      settler: me,
      market,
      escrow,
      dailyScoresMerkleRoots: dailyScoresRoots,
      txlineProgram,
      treasury,
      treasuryUsdc,
      usdcMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT })])
    .rpc();
  const marketState = await program.account.market.fetch(market);
  console.log(
    `✓ settled ${settleSig.slice(0, 16)}… → winning_side=${marketState.winningSide}` +
      ` (1=YES) status=${JSON.stringify(marketState.status)} fee=${marketState.feeCollected}`,
  );

  // 5. Claim winnings.
  const before = (await getOrCreateAssociatedTokenAccount(connection, keypair, usdcMint, me))
    .amount;
  await program.methods
    .claim()
    .accountsPartial({
      claimant: me,
      market,
      position,
      owner: me,
      escrow,
      claimantUsdc: myUsdc.address,
      usdcMint,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  const after = (await getOrCreateAssociatedTokenAccount(connection, keypair, usdcMint, me)).amount;
  console.log(`✓ claimed → balance +${Number(after - before) / 1e6} USDC`);
  console.log("\n🎉 Phase-2 lifecycle complete on devnet: create → place → settle(CPI) → claim.");
}

main().catch((err: unknown) => {
  console.error("✗ lifecycle failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
