import type * as anchor from "@coral-xyz/anchor";
import {
  enumKey,
  FINALWHISTLE_PROGRAM,
  type MarketAccount,
  scanMarkets as sdkScanMarkets,
} from "@finalwhistle/sdk";
import type { ResilientRpcPool } from "solana-resilience-kit";

export interface ScannedMarket {
  address: string;
  market: MarketAccount;
}

/**
 * List every FinalWhistle market via the resilient RPC pool. Delegates to the SDK's
 * `scanMarkets`, which decodes and camelCases the account fields (the BorshAccountsCoder
 * otherwise returns raw snake_case keys). Positions are skipped.
 */
export async function scanMarkets(
  pool: ResilientRpcPool,
  coder: anchor.BorshAccountsCoder,
): Promise<ScannedMarket[]> {
  return sdkScanMarkets(pool.rpc(), coder, FINALWHISTLE_PROGRAM.toBase58());
}

/** Markets that are open and whose betting window has closed → ready to settle. */
export function dueForSettlement(markets: ScannedMarket[], nowSec = Math.floor(Date.now() / 1000)) {
  return markets.filter(
    (m) => enumKey(m.market.status) === "open" && nowSec >= m.market.closeTs.toNumber(),
  );
}
