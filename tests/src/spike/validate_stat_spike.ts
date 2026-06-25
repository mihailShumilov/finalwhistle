import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as anchor from "@coral-xyz/anchor";
import { hashToBytes, type ProofNode } from "@finalwhistle/shared";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { ComputeBudgetProgram, Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
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

const toProof = (nodes: ProofNode[]) =>
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

  // Cache the session so discovery/exploration can reuse it without re-subscribing.
  const sessionFile = resolve(process.cwd(), "../.keys/txline-session.json");
  writeFileSync(sessionFile, `${JSON.stringify({ jwt, apiToken, apiBase: API_BASE }, null, 2)}\n`);
  console.log(`  (session cached → ${sessionFile})`);

  // 4. Fetch the three-stage proof (single + second stat).
  const validation = await fetchStatValidation(API_BASE, jwt, apiToken, TARGET);
  console.log(
    `✓ proof: ts=${validation.ts} stat ${validation.statToProve.key}=${validation.statToProve.value}` +
      (validation.statToProve2
        ? ` stat2 ${validation.statToProve2.key}=${validation.statToProve2.value}`
        : ""),
  );

  // 5. Derive the daily-scores-roots PDA. The canonical timestamp for both PDA seed and the
  //    validate_stat `ts` arg is the batch's `minTimestamp` (the snapshot-payload timestamp);
  //    passing `validation.ts` instead trips the program's TimestampMismatch (6010) check.
  const targetTs = validation.summary.updateStats.minTimestamp;
  const epochDay = Math.floor(targetTs / (24 * 60 * 60 * 1000));
  const [dailyScoresRoots] = PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), new BN(epochDay).toArrayLike(Buffer, "le", 2)],
    program.programId,
  );
  const rootsInfo = await provider.connection.getAccountInfo(dailyScoresRoots);
  if (!rootsInfo) throw new Error(`daily_scores_roots missing for epoch day ${epochDay}`);
  console.log(`✓ daily_scores_roots ${dailyScoresRoots.toBase58()} (epoch day ${epochDay})`);

  const fixtureSummary = {
    fixtureId: new BN(validation.summary.fixtureId),
    updateStats: {
      updateCount: validation.summary.updateStats.updateCount,
      minTimestamp: new BN(validation.summary.updateStats.minTimestamp),
      maxTimestamp: new BN(validation.summary.updateStats.maxTimestamp),
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

  type Empty = Record<string, never>;
  type Comparison = { greaterThan: Empty } | { lessThan: Empty } | { equalTo: Empty };
  type BinOp = { add: Empty } | { subtract: Empty };
  type Predicate = { threshold: number; comparison: Comparison };
  type StatTerm = typeof statA;

  const buildIx = (predicate: Predicate, a: StatTerm, b: StatTerm | null, op: BinOp | null) =>
    program.methods
      .validateStat(
        new BN(targetTs),
        fixtureSummary,
        fixtureProof,
        mainTreeProof,
        predicate,
        a,
        b,
        op,
      )
      .accountsPartial({ dailyScoresMerkleRoots: dailyScoresRoots })
      .preInstructions([cuIx]);

  // Read the boolean predicate result from validate_stat's return data via simulation.
  // KEY FINDING: validate_stat does NOT revert on a false predicate — it verifies the Merkle
  // proof (reverting only on a tampered/invalid proof) and writes the predicate result as a
  // 1-byte bool to return_data. Our settle path therefore CPIs validate_stat, then reads the
  // returned bool to determine the winning side. The caller cannot influence the outcome.
  async function readPredicate(
    predicate: Predicate,
    a: StatTerm,
    b: StatTerm | null,
    op: BinOp | null,
  ): Promise<boolean | null> {
    const tx = await buildIx(predicate, a, b, op).transaction();
    const sim = await provider.simulate(tx, [wallet.payer]);
    const rd = sim.returnData;
    if (!rd) return null;
    return Buffer.from(rd.data[0], "base64")[0] === 1;
  }

  // 6. Single-stat: a TRUE predicate (value > value-1) lands AND its return bool is true.
  const v = validation.statToProve.value;
  const truePredicate: Predicate = { threshold: v - 1, comparison: { greaterThan: {} } };
  const falsePredicate: Predicate = { threshold: v, comparison: { greaterThan: {} } };

  const sig1 = await buildIx(truePredicate, statA, null, null).rpc();
  console.log(`✓ single-stat validate_stat landed: ${sig1}`);

  const trueResult = await readPredicate(truePredicate, statA, null, null);
  const falseResult = await readPredicate(falsePredicate, statA, null, null);
  console.log(`✓ return-data bool: true-predicate=${trueResult}  false-predicate=${falseResult}`);
  if (trueResult !== true || falseResult !== false) {
    throw new Error(
      `CRITICAL: validate_stat return-data semantics unexpected (true=${trueResult}, false=${falseResult})`,
    );
  }

  // 7. Security boundary — a TAMPERED proof must revert (this, not the predicate, is what
  //    protects settlement). Flip one byte of the event-stat root.
  const tamperedStatA: StatTerm = {
    ...statA,
    eventStatRoot: statA.eventStatRoot.map((byte, i) => (i === 0 ? byte ^ 0xff : byte)),
  };
  let tamperReverted = false;
  try {
    await readPredicate(truePredicate, tamperedStatA, null, null);
  } catch {
    tamperReverted = true;
  }
  console.log(`✓ tampered proof reverted: ${tamperReverted}`);
  if (!tamperReverted) {
    throw new Error("CRITICAL: tampered proof did NOT revert — settlement would be forgeable");
  }

  // 8. Two-stat validation (if a second stat was returned) — land + read the diff predicate.
  let sig2: string | null = null;
  let twoStatResult: boolean | null = null;
  if (validation.statToProve2 && validation.statProof2) {
    const statB: StatTerm = {
      statToProve: validation.statToProve2,
      eventStatRoot: hashToBytes(validation.eventStatRoot),
      statProof: toProof(validation.statProof2),
    };
    const diff = validation.statToProve.value - validation.statToProve2.value;
    const twoStatPredicate: Predicate = { threshold: diff + 1, comparison: { lessThan: {} } };
    sig2 = await buildIx(twoStatPredicate, statA, statB, { subtract: {} }).rpc();
    twoStatResult = await readPredicate(twoStatPredicate, statA, statB, { subtract: {} });
    console.log(`✓ two-stat validate_stat landed: ${sig2} (diff<${diff + 1} ⇒ ${twoStatResult})`);
  }

  // 9. Persist the golden vector (raw proof + proven predicates + tx signatures + semantics).
  const golden = {
    capturedAtTs: validation.ts,
    canonicalTs: targetTs,
    cluster: "devnet",
    programId: program.programId.toBase58(),
    dailyScoresRoots: dailyScoresRoots.toBase58(),
    epochDay,
    target: TARGET,
    validation,
    semantics: {
      revertsOnFalsePredicate: false,
      returnsBoolViaReturnData: true,
      revertsOnTamperedProof: tamperReverted,
    },
    proved: {
      singleStat: { predicate: truePredicate, result: trueResult, signature: sig1 },
      falsePredicate: { predicate: falsePredicate, result: falseResult },
      twoStat: sig2
        ? { op: "subtract", comparison: "lessThan", result: twoStatResult, signature: sig2 }
        : null,
    },
  };
  const outDir = resolve(process.cwd(), "golden");
  mkdirSync(outDir, { recursive: true });
  const outFile = resolve(outDir, "stat_validation.devnet.json");
  writeFileSync(outFile, `${JSON.stringify(golden, null, 2)}\n`);
  console.log(`✓ golden vector written: ${outFile}`);
  console.log(
    "\n🎉 Phase-1 spike complete — validate_stat verified on devnet: predicate result via" +
      " return-data, tampered proof reverts. settle() reads the returned bool.",
  );
}

main().catch((err: unknown) => {
  console.error("✗ spike failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
