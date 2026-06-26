import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as anchor from "@coral-xyz/anchor";
import { buildSettleProof, epochDayForValidation, fetchStatValidation } from "@finalwhistle/sdk";
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
import { API_BASE, loadKeeperKeypair, RPC_URL, TXLINE_DEVNET_PROGRAM_ID } from "../spike/config.ts";

/**
 * Seed a spread of demo markets on devnet. Resolved markets settle with REAL TxLINE proofs for
 * a finished World Cup fixture (17588395 — South Africa 1–0 South Korea, P1 corners 4 / P2 6),
 * so each gets a re-verifiable receipt; open markets stay open for the live-odds / betting UI.
 */

interface Spec {
  title: string;
  fixtureId: number;
  seq: number;
  statKey: number;
  statKey2?: number;
  op?: "add" | "subtract";
  period: number;
  threshold: number;
  comparison: "greaterThan" | "lessThan";
  resolve: boolean;
  yes: number; // USDC staked YES (base units set below)
  no: number;
}

const FX = 17588395;
const SEQ = 980;
const SPECS: Spec[] = [
  {
    title: "P1 Corners > 3",
    fixtureId: FX,
    seq: SEQ,
    statKey: 7,
    period: 4,
    threshold: 3,
    comparison: "greaterThan",
    resolve: true,
    yes: 3,
    no: 1,
  },
  // Two-stat markets are left OPEN: their settle proof (statA + statB Merkle paths) exceeds the
  // legacy 1232-byte tx limit, so settling them needs an Address Lookup Table (tracked follow-up).
  // The two-stat validate_stat CPI itself works (proven in the Phase-1 spike) — only our settle
  // wrapper's tx packaging is the constraint.
  {
    title: "Total Corners < 12",
    fixtureId: FX,
    seq: SEQ,
    statKey: 7,
    statKey2: 8,
    op: "add",
    period: 4,
    threshold: 12,
    comparison: "lessThan",
    resolve: false,
    yes: 4,
    no: 2,
  },
  {
    title: "P1 Goals − P2 Goals > 0",
    fixtureId: FX,
    seq: SEQ,
    statKey: 1,
    statKey2: 2,
    op: "subtract",
    period: 4,
    threshold: 0,
    comparison: "greaterThan",
    resolve: false,
    yes: 5,
    no: 3,
  },
  {
    title: "P2 Goals > 0 (away to score)",
    fixtureId: FX,
    seq: SEQ,
    statKey: 2,
    period: 4,
    threshold: 0,
    comparison: "greaterThan",
    resolve: true,
    yes: 1,
    no: 4,
  },
  {
    title: "Norway–France: P1 Goals > 1",
    fixtureId: 17588234,
    seq: 0,
    statKey: 1,
    period: 4,
    threshold: 1,
    comparison: "greaterThan",
    resolve: false,
    yes: 2,
    no: 3,
  },
  {
    title: "Tunisia–Netherlands: Total Goals > 2",
    fixtureId: 17588236,
    seq: 0,
    statKey: 1,
    statKey2: 2,
    op: "add",
    period: 4,
    threshold: 2,
    comparison: "greaterThan",
    resolve: false,
    yes: 3,
    no: 1,
  },
];

const CLOSE_WINDOW_SEC = 25;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cmp = (c: Spec["comparison"]) =>
  c === "greaterThan" ? { greaterThan: {} } : { lessThan: {} };
const opEnum = (o: Spec["op"]) => (o === "add" ? { add: {} } : { subtract: {} });

async function main(): Promise<void> {
  const keypair = loadKeeperKeypair();
  const connection = new anchor.web3.Connection(RPC_URL, "confirmed");
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const program = new anchor.Program<Finalwhistle>(fwIdl as Finalwhistle, provider);
  const me = wallet.publicKey;
  const txlineProgram = new PublicKey(TXLINE_DEVNET_PROGRAM_ID);

  const session = JSON.parse(
    readFileSync(resolve(process.cwd(), "../.keys/txline-session.json"), "utf8"),
  ) as { jwt: string; apiToken: string };
  const tx = { jwt: session.jwt, apiToken: session.apiToken, apiBase: API_BASE };

  // Shared demo USDC mint.
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
  await mintTo(connection, keypair, usdcMint, myUsdc.address, keypair, 100_000_000_000n);
  console.log(`✓ demo USDC mint ${usdcMint.toBase58()}`);

  const now = Math.floor(Date.now() / 1000);
  const created: { spec: Spec; market: PublicKey }[] = [];

  for (const [i, spec] of SPECS.entries()) {
    const nonce = new BN(Date.now() + i);
    const [market] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), me.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
      program.programId,
    );
    const [escrow] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), market.toBuffer()],
      program.programId,
    );
    const closeTs = spec.resolve ? now + CLOSE_WINDOW_SEC : now + 7 * 24 * 3600;

    await program.methods
      .createMarket(nonce, {
        fixtureId: new BN(spec.fixtureId),
        seq: spec.seq,
        statKey: spec.statKey,
        statKey2: spec.statKey2 ?? null,
        op: spec.op ? (opEnum(spec.op) as never) : null,
        period: spec.period,
        threshold: spec.threshold,
        comparison: cmp(spec.comparison) as never,
        closeTs: new BN(closeTs),
        feeBps: 200,
        title: spec.title,
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
    await program.methods
      .placePosition(1, new BN(spec.yes * 1_000_000))
      .accountsPartial(placeAccounts)
      .rpc();
    await program.methods
      .placePosition(2, new BN(spec.no * 1_000_000))
      .accountsPartial(placeAccounts)
      .rpc();
    created.push({ spec, market });
    console.log(
      `✓ created ${spec.resolve ? "[resolve]" : "[open]   "} ${market.toBase58()}  ${spec.title}`,
    );
  }

  // Wait once for the betting window of the resolvable markets to close.
  const waitMs = (CLOSE_WINDOW_SEC + 3) * 1000;
  console.log(`… waiting ${Math.ceil(waitMs / 1000)}s for betting to close on resolvable markets`);
  await sleep(waitMs);

  for (const { spec, market } of created) {
    if (!spec.resolve) continue;
    const validation = await fetchStatValidation(tx, {
      fixtureId: spec.fixtureId,
      seq: spec.seq,
      statKey: spec.statKey,
      ...(spec.statKey2 !== undefined ? { statKey2: spec.statKey2 } : {}),
    });
    const proof = buildSettleProof(validation, spec.op ? { op: spec.op } : undefined);
    const [escrow] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), market.toBuffer()],
      program.programId,
    );
    const [dailyScoresRoots] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("daily_scores_roots"),
        new BN(epochDayForValidation(validation)).toArrayLike(Buffer, "le", 2),
      ],
      txlineProgram,
    );
    const [treasury] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      program.programId,
    );
    const treasuryUsdc = getAssociatedTokenAddressSync(usdcMint, treasury, true, TOKEN_PROGRAM_ID);

    await program.methods
      .settle(proof as never)
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
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })])
      .rpc();
    const m = await program.account.market.fetch(market);
    console.log(
      `✓ settled ${market.toBase58()} → winning_side=${m.winningSide} (1=YES,2=NO)  ${spec.title}`,
    );
  }

  console.log("\n🎉 Seeded demo markets:");
  for (const { spec, market } of created) {
    console.log(
      `   ${spec.resolve ? "resolved" : "open    "}  https://finalwhistle-web.mschumilow.workers.dev/market?address=${market.toBase58()}`,
    );
  }
}

main().catch((err: unknown) => {
  console.error("✗ seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
