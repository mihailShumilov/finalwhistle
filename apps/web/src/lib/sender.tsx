"use client";

import type * as anchor from "@coral-xyz/anchor";
import { createProgram, createRpcPool, type Finalwhistle } from "@finalwhistle/sdk";
import { address, type Base64EncodedWireTransaction } from "@solana/kit";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  type TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { useMemo } from "react";
import { type ResilientRpcPool, TransactionSender } from "solana-resilience-kit";
import { useResilientSender } from "solana-resilience-kit/react";
import { CLUSTER, RPC, RPC_BACKUP } from "./config";

type Rpc = ReturnType<ResilientRpcPool["rpc"]>;

/** Below this the fee payer cannot cover tx fee + rent for a new market + escrow (~0.005 SOL). */
const MIN_LAMPORTS_FOR_RENT = 8_000_000n;

/**
 * A pre-send simulation failure carrying a human-readable, actionable message.
 * Thrown before the wallet is ever prompted, so a doomed transaction never pops a
 * signature request and the real reason (most often an unfunded devnet wallet) is shown.
 */
export class PreflightError extends Error {
  constructor(
    message: string,
    readonly simErr: unknown,
    readonly logs: readonly string[],
  ) {
    super(message);
    this.name = "PreflightError";
  }
}

function explainSimFailure(err: unknown, logs: readonly string[], lamports: bigint): string {
  // The dominant devnet failure: the connected wallet holds no (or too little) SOL, so it
  // cannot pay the rent the program charges to open the market + escrow accounts.
  if (err === "AccountNotFound" || lamports < MIN_LAMPORTS_FOR_RENT) {
    const sol = (Number(lamports) / 1e9).toFixed(4);
    return `Insufficient devnet SOL — this wallet holds ${sol} SOL, but the transaction must pay account rent (~0.005 SOL to open a market). Fund it with devnet SOL at faucet.solana.com (set the network to Devnet), then try again.`;
  }
  const reason = typeof err === "string" ? err : JSON.stringify(err);
  const hint = logs.filter((l) => /fail|insufficient|error|custom/i.test(l)).slice(-1)[0];
  return `The network rejected this transaction: ${reason}${hint ? ` — ${hint}` : ""}`;
}

/**
 * Simulate the unsigned transaction and, on failure, throw a {@link PreflightError} with an
 * actionable message. A flaky simulate never blocks a real send — it falls through so the
 * actual broadcast still gets its chance and surfaces any error itself.
 */
async function preflight(rpc: Rpc, tx: VersionedTransaction, payer: string): Promise<void> {
  let err: unknown;
  let logs: readonly string[] = [];
  try {
    const wire = Buffer.from(tx.serialize()).toString("base64") as Base64EncodedWireTransaction;
    const sim = await rpc
      .simulateTransaction(wire, {
        sigVerify: false,
        replaceRecentBlockhash: true,
        encoding: "base64",
        commitment: "confirmed",
      })
      .send();
    err = sim.value.err;
    logs = sim.value.logs ?? [];
  } catch {
    return; // transient simulate failure — let the real send decide
  }
  if (err == null) return;

  let lamports = 0n;
  try {
    lamports = (await rpc.getBalance(address(payer)).send()).value;
  } catch {
    /* balance read is best-effort; 0 just biases toward the funding hint */
  }
  throw new PreflightError(explainSimFailure(err, logs, lamports), err, logs);
}

// The browser routes sends through the resilient sender via the wallet bridge
// (useResilientSender), mirroring the keeper's keypair-signer path.
let poolSingleton: ResilientRpcPool | null = null;
let senderSingleton: TransactionSender | null = null;
let programSingleton: anchor.Program<Finalwhistle> | null = null;

function pool(): ResilientRpcPool {
  if (!poolSingleton) poolSingleton = createRpcPool({ endpoints: [RPC, RPC_BACKUP] });
  return poolSingleton;
}
function sender(): TransactionSender {
  if (!senderSingleton) {
    senderSingleton = new TransactionSender(pool().rpc(), {
      clusterGuard: { expected: CLUSTER, mode: "throw" },
    });
  }
  return senderSingleton;
}
export function program(): anchor.Program<Finalwhistle> {
  if (!programSingleton) programSingleton = createProgram();
  return programSingleton;
}
export const getPool = pool;

/** Serialise a wallet-signed VersionedTransaction to wire + signature for the resilient sender. */
const encode = (signed: VersionedTransaction) => ({
  wireTransaction: Buffer.from(signed.serialize()).toString("base64"),
  signature: bs58.encode(signed.signatures[0] ?? new Uint8Array(64)),
});

export function useFinalWhistleSender() {
  const wallet = useWallet();

  const bridgeWallet = useMemo(
    () => ({
      publicKey: wallet.publicKey ? wallet.publicKey.toBase58() : null,
      signTransaction: async (tx: VersionedTransaction) => {
        if (!wallet.signTransaction) throw new Error("Wallet does not support signTransaction");
        return wallet.signTransaction(tx);
      },
      ...(wallet.signAllTransactions
        ? { signAllTransactions: wallet.signAllTransactions.bind(wallet) }
        : {}),
    }),
    [wallet],
  );

  const { signAndSend, status, error, address } = useResilientSender<VersionedTransaction>({
    wallet: bridgeWallet,
    sender: sender(),
    encode,
  });

  /** Build a v0 transaction from web3 instructions, sign with the wallet, land via the kit. */
  async function send(instructions: TransactionInstruction[]) {
    if (!wallet.publicKey) throw new Error("Connect a wallet first");
    const rpc = pool().rpc();
    const payer = wallet.publicKey.toBase58();
    const { value } = await rpc.getLatestBlockhash().send();
    const message = new TransactionMessage({
      payerKey: new PublicKey(payer),
      recentBlockhash: value.blockhash,
      instructions,
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    // Pre-flight the unsigned tx: catch an unfunded fee payer / program rejection BEFORE the
    // wallet prompt, so a failed create reads as a clear message instead of a silent no-op.
    await preflight(rpc, tx, payer);
    return signAndSend(tx, { lastValidBlockHeight: value.lastValidBlockHeight });
  }

  return { send, status, error, address, connected: Boolean(wallet.publicKey) };
}
