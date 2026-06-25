import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as anchor from "@coral-xyz/anchor";
import { hashToBytes } from "@finalwhistle/shared";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { ComputeBudgetProgram, Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import rawIdl from "../../../idl/txoracle.json" with { type: "json" };
import type { Txoracle } from "../../../idl/txoracle.ts";
import {
  API_BASE,
  loadKeeperKeypair,
  ORACLE_BASE,
  RPC_URL,
  SELECTED_LEAGUES,
  SERVICE_LEVEL_ID,
  SUBSCRIPTION_WEEKS,
  TARGET,
  TXL_DEVNET_MINT,
  TXLINE_DEVNET_PROGRAM_ID,
} from "./config.ts";
import { activate, fetchStatValidation, guestAuth } from "./txline-api.ts";

const CU_LIMIT = 1_400_000; // validate_stat recomputes the full Merkle path → max CU.

type ProofNodeApi = { hash: string; isRightSibling: boolean };
const toProof = (nodes: ProofNodeApi[]) =>
  nodes.map((n) => ({ hash: hashToBytes(n.hash), isRightSibling: n.isRightSibling }));

function buildProgram(): anchor.Program<Txoracle> {
  const keypair = loadKeeperKeypair();
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  // Override the IDL address (mainnet → devnet); encodings are identical. The vendored type
  // pins the mainnet address literal, so cast through `unknown`.
  const idl = { ...rawIdl, address: TXLINE_DEVNET_PROGRAM_ID } as unknown as Txoracle;
  return new anchor.Program<Txoracle>(idl, provider);
}

async function main(): Promise<void> {
  const program = buildProgram();
  const provider = program.provider as anchor.AnchorProvider;
  const wallet = provider.wallet as anchor.Wallet;
  const txlMint = new PublicKey(TXL_DEVNET_MINT);
  console.log(`▶ wallet ${wallet.publicKey.toBase58()}  program ${program.programId.toBase58()}`);

  // 1. Guest auth.
  const jwt = await guestAuth(ORACLE_BASE);
  console.log("✓ guest JWT acquired");

  // 2. Subscribe (free World Cup tier → 0 TxL).
  const userTokenAccount = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    wallet.payer,
    txlMint,
    wallet.publicKey,
    false,
    "confirmed",
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );
  const [pricingMatrix] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    program.programId,
  );
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    program.programId,
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    txlMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
  );

  const subSig = await program.methods
    .subscribe(SERVICE_LEVEL_ID, SUBSCRIPTION_WEEKS)
    .accountsPartial({
      user: wallet.publicKey,
      pricingMatrix,
      tokenMint: txlMint,
      userTokenAccount: userTokenAccount.address,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log(`✓ subscribed (SL ${SERVICE_LEVEL_ID}, ${SUBSCRIPTION_WEEKS}w): ${subSig}`);

  // 3. Activate → API token.
  const apiToken = await activate(
    ORACLE_BASE,
    subSig,
    SELECTED_LEAGUES,
    jwt,
    wallet.payer.secretKey,
  );
  console.log("✓ API token activated");

  // 4. Fetch the three-stage proof (single + second stat).
  const validation = await fetchStatValidation(API_BASE, jwt, apiToken, TARGET);
  console.log(
    `✓ proof: ts=${validation.ts} stat ${validation.statToProve.key}=${validation.statToProve.value}` +
      (validation.statToProve2
        ? ` stat2 ${validation.statToProve2.key}=${validation.statToProve2.value}`
        : ""),
  );

  // 5. Derive the daily-scores-roots PDA for the proof's epoch day.
  const epochDay = Math.floor(validation.ts / (24 * 60 * 60 * 1000));
  const [dailyScoresRoots] = PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), new anchor.BN(epochDay).toArrayLike(Buffer, "le", 2)],
    program.programId,
  );
  const rootsInfo = await provider.connection.getAccountInfo(dailyScoresRoots);
  if (!rootsInfo) throw new Error(`daily_scores_roots missing for epoch day ${epochDay}`);
  console.log(`✓ daily_scores_roots ${dailyScoresRoots.toBase58()} (epoch day ${epochDay})`);

  const fixtureSummary = {
    fixtureId: new anchor.BN(validation.summary.fixtureId),
    updateStats: {
      updateCount: validation.summary.updateStats.updateCount,
      minTimestamp: new anchor.BN(validation.summary.updateStats.minTimestamp),
      maxTimestamp: new anchor.BN(validation.summary.updateStats.maxTimestamp),
    },
    eventsSubTreeRoot: hashToBytes(validation.summary.eventStatsSubTreeRoot),
  };
  const fixtureProof = toProof(validation.subTreeProof);
  const mainTreeProof = toProof(validation.mainTreeProof);
  const statA = {
    statToProve: validation.statToProve,
    eventStatRoot: hashToBytes(validation.eventStatRoot),
    statProof: toProof(validation.statProof),
  };
  const cuIx = ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT });

  // 6. Single-stat validation — a TRUE predicate (value > value-1) must land.
  const truePredicate = {
    threshold: validation.statToProve.value - 1,
    comparison: { greaterThan: {} },
  };
  const sig1 = await program.methods
    .validateStat(
      new anchor.BN(validation.ts),
      fixtureSummary,
      fixtureProof,
      mainTreeProof,
      truePredicate,
      statA,
      null,
      null,
    )
    .accountsPartial({ dailyScoresMerkleRoots: dailyScoresRoots })
    .preInstructions([cuIx])
    .rpc();
  console.log(`✓ single-stat validate_stat landed: ${sig1}`);

  // 7. Negative — a FALSE predicate (value > value) must revert (no return value ⇒ revert-on-false).
  let reverted = false;
  try {
    const falsePredicate = {
      threshold: validation.statToProve.value,
      comparison: { greaterThan: {} },
    };
    await program.methods
      .validateStat(
        new anchor.BN(validation.ts),
        fixtureSummary,
        fixtureProof,
        mainTreeProof,
        falsePredicate,
        statA,
        null,
        null,
      )
      .accountsPartial({ dailyScoresMerkleRoots: dailyScoresRoots })
      .preInstructions([cuIx])
      .rpc();
  } catch {
    reverted = true;
  }
  console.log(`✓ false predicate reverted: ${reverted}`);
  if (!reverted)
    throw new Error("CRITICAL: false predicate did NOT revert — settle design assumption broken");

  // 8. Two-stat validation (if a second stat was returned).
  let sig2: string | null = null;
  if (validation.statToProve2 && validation.statProof2) {
    const statB = {
      statToProve: validation.statToProve2,
      eventStatRoot: hashToBytes(validation.eventStatRoot),
      statProof: toProof(validation.statProof2),
    };
    const diff = validation.statToProve.value - validation.statToProve2.value;
    const twoStatPredicate = { threshold: diff + 1, comparison: { lessThan: {} } }; // diff < diff+1 ⇒ true
    sig2 = await program.methods
      .validateStat(
        new anchor.BN(validation.ts),
        fixtureSummary,
        fixtureProof,
        mainTreeProof,
        twoStatPredicate,
        statA,
        statB,
        { subtract: {} },
      )
      .accountsPartial({ dailyScoresMerkleRoots: dailyScoresRoots })
      .preInstructions([cuIx])
      .rpc();
    console.log(`✓ two-stat validate_stat landed: ${sig2}`);
  }

  // 9. Persist the golden vector (raw proof + the predicates we proved + tx signatures).
  const golden = {
    capturedAtTs: validation.ts,
    cluster: "devnet",
    programId: program.programId.toBase58(),
    dailyScoresRoots: dailyScoresRoots.toBase58(),
    epochDay,
    target: TARGET,
    validation,
    proved: {
      singleStat: { predicate: truePredicate, signature: sig1 },
      falsePredicateReverted: reverted,
      twoStat: sig2 ? { op: "subtract", comparison: "lessThan", signature: sig2 } : null,
    },
  };
  const outDir = resolve(process.cwd(), "golden");
  mkdirSync(outDir, { recursive: true });
  const outFile = resolve(outDir, "stat_validation.devnet.json");
  writeFileSync(outFile, `${JSON.stringify(golden, null, 2)}\n`);
  console.log(`✓ golden vector written: ${outFile}`);
  console.log(
    "\n🎉 Phase-1 spike complete — validate_stat is CPI-ready and revert-on-false confirmed.",
  );
}

main().catch((err: unknown) => {
  console.error("✗ spike failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
