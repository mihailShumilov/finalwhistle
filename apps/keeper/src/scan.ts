import type * as anchor from "@coral-xyz/anchor";
import { FINALWHISTLE_PROGRAM, type MarketAccount } from "@finalwhistle/sdk";
import { address } from "@solana/kit";
import type { ResilientRpcPool } from "solana-resilience-kit";

export interface ScannedMarket {
  address: string;
  market: MarketAccount;
}

/**
 * List every FinalWhistle market via the resilient RPC pool and decode it. Positions (a
 * different discriminator) fail to decode and are skipped. For the hackathon a full
 * `getProgramAccounts` scan on devnet is fine; a production index would use the read API's D1.
 */
export async function scanMarkets(
  pool: ResilientRpcPool,
  coder: anchor.BorshAccountsCoder,
): Promise<ScannedMarket[]> {
  const rpc = pool.rpc();
  const accounts = await rpc
    .getProgramAccounts(address(FINALWHISTLE_PROGRAM.toBase58()), { encoding: "base64" })
    .send();

  const out: ScannedMarket[] = [];
  for (const { pubkey, account } of accounts) {
    const data = Buffer.from(account.data[0], "base64");
    for (const name of ["market", "Market"]) {
      try {
        out.push({ address: pubkey.toString(), market: coder.decode(name, data) as MarketAccount });
        break;
      } catch {
        /* not a market */
      }
    }
  }
  return out;
}

/** Markets that are open and whose betting window has closed → ready to settle. */
export function dueForSettlement(markets: ScannedMarket[], nowSec = Math.floor(Date.now() / 1000)) {
  return markets.filter((m) => "open" in m.market.status && nowSec >= m.market.closeTs.toNumber());
}
