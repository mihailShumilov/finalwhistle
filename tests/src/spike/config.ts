import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { Keypair } from "@solana/web3.js";

/**
 * Phase-1 spike configuration. The spike deliberately uses @coral-xyz/anchor +
 * @solana/web3.js (the stack the TxLINE example is written for) — it is a one-off
 * de-risking step to land a real `validate_stat` tx and capture a golden vector. The
 * production SDK / keeper / frontend use @solana/kit + solana-resilience-kit per the
 * project mandate.
 */

export const CLUSTER = "devnet" as const;

/** TxLINE (txoracle) devnet program id — the CPI target. */
export const TXLINE_DEVNET_PROGRAM_ID = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";

/** Devnet TxL utility-token mint (used only for the free-tier subscribe; never wagered). */
export const TXL_DEVNET_MINT = "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG";

// Auth + activation live on the txline(-dev) host, NOT oracle(-dev).txodds.com (which the
// on-chain example references but whose DNS is flaky). The worldcup quickstart is correct.
export const ORACLE_BASE = "https://txline-dev.txodds.com";
export const API_BASE = "https://txline-dev.txodds.com";
export const RPC_URL = process.env.RPC_PRIMARY ?? "https://api.devnet.solana.com";

/** Free World Cup tier: SL 1 = 60s delay (0 TxL). Subscriptions are multiples of 4 weeks. */
export const SERVICE_LEVEL_ID = Number(process.env.TXLINE_SERVICE_LEVEL ?? 1);
export const SUBSCRIPTION_WEEKS = Number(process.env.TXLINE_WEEKS ?? 4);
export const SELECTED_LEAGUES: number[] = [];

/**
 * Target fixture/seq/stat for the proof. Defaults mirror the TxLINE on-chain example;
 * override via env when devnet data coverage moves.
 */
export const TARGET = {
  fixtureId: Number(process.env.SPIKE_FIXTURE_ID ?? 17271370),
  seq: Number(process.env.SPIKE_SEQ ?? 401),
  statKey: Number(process.env.SPIKE_STAT_KEY ?? 1),
  statKey2: Number(process.env.SPIKE_STAT_KEY2 ?? 2),
};

export function loadKeeperKeypair(): Keypair {
  const path = process.env.KEEPER_KEYPAIR ?? resolve(process.cwd(), "../.keys/keeper-devnet.json");
  const raw = readFileSync(path.replace("~", homedir()), "utf8");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
}
