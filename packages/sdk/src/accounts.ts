import * as anchor from "@coral-xyz/anchor";
import { type Address, address } from "@solana/kit";
import type { ResilientRpcPool } from "solana-resilience-kit";

type Rpc = ReturnType<ResilientRpcPool["rpc"]>;

const camel = (s: string): string => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** Shallow-camelCase top-level keys (BorshAccountsCoder returns raw snake_case IDL names). */
function camelizeTop(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[camel(k)] = v;
  return out;
}

/** Decode an account name with either IDL casing (PascalCase) or the camelCase accessor. */
function decode<T>(coder: anchor.BorshAccountsCoder, names: string[], data: Buffer): T {
  for (const name of names) {
    try {
      return camelizeTop(coder.decode(name, data) as Record<string, unknown>) as T;
    } catch {
      /* try next casing */
    }
  }
  throw new Error(`Could not decode account as any of: ${names.join(", ")}`);
}

async function getAccountData(rpc: Rpc, addr: Address): Promise<Buffer | null> {
  const { value } = await rpc.getAccountInfo(addr, { encoding: "base64" }).send();
  if (!value) return null;
  return Buffer.from(value.data[0], "base64");
}

export interface MarketAccount {
  authority: anchor.web3.PublicKey;
  usdcMint: anchor.web3.PublicKey;
  escrow: anchor.web3.PublicKey;
  nonce: anchor.BN;
  fixtureId: anchor.BN;
  seq: number;
  statKey: number;
  statKey2: number | null;
  op: Record<string, unknown> | null;
  period: number;
  threshold: number;
  comparison: Record<string, unknown>;
  closeTs: anchor.BN;
  yesPool: anchor.BN;
  noPool: anchor.BN;
  feeBps: number;
  status: Record<string, unknown>;
  winningSide: number;
  settleTs: anchor.BN;
  settleSlot: anchor.BN;
  feeCollected: anchor.BN;
  totalPayoutPool: anchor.BN;
  totalClaimed: anchor.BN;
  title: string;
}

export interface PositionAccount {
  market: anchor.web3.PublicKey;
  owner: anchor.web3.PublicKey;
  yesAmount: anchor.BN;
  noAmount: anchor.BN;
  claimed: boolean;
}

export function makeAccountsCoder(idl: anchor.Idl): anchor.BorshAccountsCoder {
  return new anchor.BorshAccountsCoder(idl);
}

/** The active variant of a decoded Anchor enum, as camelCase (e.g. `{GreaterThan:{}}` → "greaterThan"). */
export function enumKey(value: Record<string, unknown>): string {
  const key = Object.keys(value)[0] ?? "unknown";
  return key.charAt(0).toLowerCase() + key.slice(1);
}

export async function fetchMarket(
  rpc: Rpc,
  coder: anchor.BorshAccountsCoder,
  marketAddress: string,
): Promise<MarketAccount | null> {
  const data = await getAccountData(rpc, address(marketAddress));
  return data ? decode<MarketAccount>(coder, ["market", "Market"], data) : null;
}

export async function fetchPosition(
  rpc: Rpc,
  coder: anchor.BorshAccountsCoder,
  positionAddress: string,
): Promise<PositionAccount | null> {
  const data = await getAccountData(rpc, address(positionAddress));
  return data ? decode<PositionAccount>(coder, ["position", "Position"], data) : null;
}

/** List every FinalWhistle market via the resilient pool and decode it (positions skipped). */
export async function scanMarkets(
  rpc: Rpc,
  coder: anchor.BorshAccountsCoder,
  programId: string,
): Promise<{ address: string; market: MarketAccount }[]> {
  const accounts = await rpc.getProgramAccounts(address(programId), { encoding: "base64" }).send();
  const out: { address: string; market: MarketAccount }[] = [];
  for (const { pubkey, account } of accounts) {
    const data = Buffer.from(account.data[0], "base64");
    try {
      out.push({
        address: pubkey.toString(),
        market: decode<MarketAccount>(coder, ["market", "Market"], data),
      });
    } catch {
      /* not a market (e.g. a position) */
    }
  }
  return out;
}

/** A UI/API-friendly, JSON-serialisable view of a market. */
export interface MarketSummary {
  address: string;
  title: string;
  status: string;
  fixtureId: number;
  seq: number;
  statKey: number;
  statKey2: number | null;
  op: "add" | "subtract" | null;
  period: number;
  threshold: number;
  comparison: "greaterThan" | "lessThan";
  closeTs: number;
  yesPool: string;
  noPool: string;
  feeBps: number;
  winningSide: number;
  settleTs: number;
  settleSlot: number;
  usdcMint: string;
}

export function summarizeMarket(address: string, m: MarketAccount): MarketSummary {
  return {
    address,
    title: m.title,
    status: enumKey(m.status),
    fixtureId: m.fixtureId.toNumber(),
    seq: m.seq,
    statKey: m.statKey,
    statKey2: m.statKey2,
    op: m.op ? (enumKey(m.op) === "add" ? "add" : "subtract") : null,
    period: m.period,
    threshold: m.threshold,
    comparison: enumKey(m.comparison) === "greaterThan" ? "greaterThan" : "lessThan",
    closeTs: m.closeTs.toNumber(),
    yesPool: m.yesPool.toString(),
    noPool: m.noPool.toString(),
    feeBps: m.feeBps,
    winningSide: m.winningSide,
    settleTs: m.settleTs.toNumber(),
    settleSlot: m.settleSlot.toNumber(),
    usdcMint: m.usdcMint.toBase58(),
  };
}
