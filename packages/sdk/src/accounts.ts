import * as anchor from "@coral-xyz/anchor";
import { type Address, address } from "@solana/kit";
import type { ResilientRpcPool } from "solana-resilience-kit";

type Rpc = ReturnType<ResilientRpcPool["rpc"]>;

/** Decode an account name with either IDL casing (PascalCase) or the camelCase accessor. */
function decode<T>(coder: anchor.BorshAccountsCoder, names: string[], data: Buffer): T {
  for (const name of names) {
    try {
      return coder.decode(name, data) as T;
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
