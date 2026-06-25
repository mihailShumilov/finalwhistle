import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  type Instruction,
  type KeyPairSigner,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import type { TransactionInstruction } from "@solana/web3.js";
import {
  type LifecycleEmitter,
  type Metrics,
  type ResilientRpcPool,
  type SendResult,
  TransactionSender,
} from "solana-resilience-kit";

export type Cluster = "devnet" | "mainnet-beta";

/** Convert an Anchor/web3.js TransactionInstruction into a `@solana/kit` instruction. */
export function web3ToKitInstruction(ix: TransactionInstruction): Instruction {
  return {
    programAddress: address(ix.programId.toBase58()),
    accounts: ix.keys.map((k) => ({
      address: address(k.pubkey.toBase58()),
      role: k.isSigner
        ? k.isWritable
          ? AccountRole.WRITABLE_SIGNER
          : AccountRole.READONLY_SIGNER
        : k.isWritable
          ? AccountRole.WRITABLE
          : AccountRole.READONLY,
    })),
    data: new Uint8Array(ix.data),
  };
}

export async function signerFromSecretKey(secretKey: Uint8Array): Promise<KeyPairSigner> {
  return createKeyPairSignerFromBytes(secretKey);
}

export interface ResilientSenderOptions {
  cluster: Cluster;
  events?: LifecycleEmitter;
  metrics?: Metrics;
  commitment?: "confirmed" | "finalized";
}

/**
 * Sends FinalWhistle transactions through `solana-resilience-kit`'s `TransactionSender`:
 * `maxRetries:0` + bounded rebroadcast of the same signed bytes (never re-signs → no
 * double-pay), outcome decided by `lastValidBlockHeight`, with a cluster guard that blocks a
 * mainnet-intended send from landing on devnet (and vice versa).
 */
export class ResilientSender {
  private readonly rpc: ReturnType<ResilientRpcPool["rpc"]>;
  private readonly sender: TransactionSender;
  private readonly commitment: "confirmed" | "finalized";

  constructor(
    pool: ResilientRpcPool,
    private readonly signer: KeyPairSigner,
    opts: ResilientSenderOptions,
  ) {
    this.rpc = pool.rpc();
    this.commitment = opts.commitment ?? "confirmed";
    this.sender = new TransactionSender(this.rpc, {
      clusterGuard: { expected: opts.cluster, mode: "throw" },
      ...(opts.events ? { events: opts.events } : {}),
      ...(opts.metrics ? { metrics: opts.metrics } : {}),
    });
  }

  get feePayer(): KeyPairSigner {
    return this.signer;
  }

  /** Build, sign and send a transaction from web3.js/Anchor instructions. */
  async send(instructions: TransactionInstruction[]): Promise<SendResult> {
    const kitIxs = instructions.map(web3ToKitInstruction);
    const { value: blockhash } = await this.rpc.getLatestBlockhash().send();

    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(this.signer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstructions(kitIxs, m),
    );

    const signed = await signTransactionMessageWithSigners(message);
    return this.sender.sendAndConfirm({
      wireTransaction: getBase64EncodedWireTransaction(signed),
      signature: getSignatureFromTransaction(signed),
      lastValidBlockHeight: blockhash.lastValidBlockHeight,
      commitment: this.commitment,
    });
  }
}
