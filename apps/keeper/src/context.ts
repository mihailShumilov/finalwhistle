import * as anchor from "@coral-xyz/anchor";
import {
  type Cluster,
  createProgram,
  createRpcPool,
  FINALWHISTLE_IDL,
  type Finalwhistle,
  makeAccountsCoder,
  ResilientSender,
  signerFromSecretKey,
  type TxlineSession,
} from "@finalwhistle/sdk";
import { PublicKey } from "@solana/web3.js";
import { LifecycleEmitter, type ResilientRpcPool } from "solana-resilience-kit";

export interface KeeperEnv {
  CLUSTER?: string;
  RPC_PRIMARY?: string;
  RPC_BACKUP?: string;
  KEEPER_SECRET_KEY?: string;
  TXLINE_PROGRAM_ID?: string;
  TXLINE_API_BASE?: string;
  TXLINE_JWT?: string;
  TXLINE_API_TOKEN?: string;
  SETTLED?: KVNamespaceLike;
}

/** Minimal KV surface (Cloudflare KVNamespace or a stub) used for idempotency. */
export interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  list?(opts?: { prefix?: string }): Promise<{ keys: { name: string }[] }>;
}

/** Parse a secret key from a JSON byte array or a base58 string. */
export function parseSecretKey(raw: string): Uint8Array {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) return Uint8Array.from(JSON.parse(trimmed) as number[]);
  // base58 (lazy import to keep the hot path light)
  const bs58 = (anchor.utils.bytes.bs58 ?? null) as { decode(s: string): Uint8Array } | null;
  if (!bs58) throw new Error("base58 decoder unavailable");
  return bs58.decode(trimmed);
}

export interface KeeperContext {
  cluster: Cluster;
  pool: ResilientRpcPool;
  sender: ResilientSender;
  program: anchor.Program<Finalwhistle>;
  coder: anchor.BorshAccountsCoder;
  session: TxlineSession;
  txlineProgram: PublicKey;
  events: LifecycleEmitter;
  settled: KVNamespaceLike | undefined;
}

export async function buildContext(env: KeeperEnv): Promise<KeeperContext> {
  const cluster: Cluster = env.CLUSTER === "mainnet-beta" ? "mainnet-beta" : "devnet";
  const endpoints = [env.RPC_PRIMARY, env.RPC_BACKUP].filter((u): u is string => Boolean(u));
  if (endpoints.length === 0) endpoints.push("https://api.devnet.solana.com");

  const events = new LifecycleEmitter();
  const pool = createRpcPool({ endpoints, events });

  if (!env.KEEPER_SECRET_KEY) throw new Error("KEEPER_SECRET_KEY is required");
  const signer = await signerFromSecretKey(parseSecretKey(env.KEEPER_SECRET_KEY));
  const sender = new ResilientSender(pool, signer, { cluster, events });

  const program = createProgram();
  const coder = makeAccountsCoder(FINALWHISTLE_IDL as anchor.Idl);

  const apiBase =
    env.TXLINE_API_BASE ??
    (cluster === "mainnet-beta" ? "https://txline.txodds.com" : "https://txline-dev.txodds.com");
  const session: TxlineSession = {
    jwt: env.TXLINE_JWT ?? "",
    apiToken: env.TXLINE_API_TOKEN ?? "",
    apiBase,
  };

  const txlineProgram = new PublicKey(
    env.TXLINE_PROGRAM_ID ?? "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
  );

  return {
    cluster,
    pool,
    sender,
    program,
    coder,
    session,
    txlineProgram,
    events,
    settled: env.SETTLED,
  };
}
