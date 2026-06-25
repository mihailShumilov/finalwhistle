"use client";

import type * as anchor from "@coral-xyz/anchor";
import { createProgram, createRpcPool, type Finalwhistle } from "@finalwhistle/sdk";
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
    const { value } = await pool().rpc().getLatestBlockhash().send();
    const message = new TransactionMessage({
      payerKey: new PublicKey(wallet.publicKey.toBase58()),
      recentBlockhash: value.blockhash,
      instructions,
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    return signAndSend(tx, { lastValidBlockHeight: value.lastValidBlockHeight });
  }

  return { send, status, error, address, connected: Boolean(wallet.publicKey) };
}
